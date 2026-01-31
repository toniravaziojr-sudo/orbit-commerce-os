/**
 * VoiceSelector — Seleção de voz para TTS
 * 
 * Duas opções:
 * 1. Vozes públicas (system-owned com ref_audio_url)
 * 2. Upload de áudio próprio (clonagem de voz)
 * 
 * Os áudios de presets estão em bucket privado para impedir download.
 * O preview usa URLs assinadas geradas pela edge function voice-preset-audio.
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  Upload, 
  Play, 
  Pause,
  Loader2,
  Volume2,
  User,
  CheckCircle2,
  X,
  Library,
} from 'lucide-react';
import { useAvailableVoicePresets, type VoicePreset } from '@/hooks/useVoicePresets';
import { useSystemUpload } from '@/hooks/useSystemUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type VoiceMode = 'preset' | 'custom';

interface VoiceSelectorProps {
  value: string;
  onChange: (voicePresetId: string | null, customAudioUrl?: string) => void;
  customAudioUrl?: string;
  onCustomAudioChange?: (url: string | null) => void;
}

export function VoiceSelector({ 
  value, 
  onChange,
  customAudioUrl,
  onCustomAudioChange,
}: VoiceSelectorProps) {
  const [mode, setMode] = useState<VoiceMode>(customAudioUrl ? 'custom' : 'preset');
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: presets, isLoading } = useAvailableVoicePresets();
  const { upload } = useSystemUpload({ source: 'voice_sample', subPath: 'voice-samples' });

  // Agrupar presets por categoria
  const femalePresets = presets?.filter(p => p.category === 'female') || [];
  const malePresets = presets?.filter(p => p.category === 'male') || [];
  const neutralPresets = presets?.filter(p => p.category === 'neutral') || [];

  const handleModeChange = (newMode: VoiceMode) => {
    setMode(newMode);
    if (newMode === 'custom') {
      onChange(null); // Limpa preset selecionado
    } else {
      onCustomAudioChange?.(null); // Limpa áudio custom
    }
  };

  const handlePresetSelect = (presetId: string) => {
    onChange(presetId);
    onCustomAudioChange?.(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('audio/')) {
      toast.error('Selecione um arquivo de áudio válido');
      return;
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 10MB');
      return;
    }

    setIsUploading(true);
    try {
      const result = await upload(file);
      if (result?.publicUrl) {
        onCustomAudioChange?.(result.publicUrl);
        onChange(null); // Limpa preset
        toast.success('Áudio enviado com sucesso!');
      } else {
        toast.error('Erro ao enviar áudio');
      }
    } catch (error) {
      console.error('Error uploading audio:', error);
      toast.error('Erro ao enviar áudio');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePlayPreview = async (audioUrlOrPresetId: string, id: string, isPreset = false) => {
    if (isPlaying === id) {
      audioRef.current?.pause();
      setIsPlaying(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    let audioUrl = audioUrlOrPresetId;

    // Para presets, buscar URL assinada via edge function
    if (isPreset) {
      try {
        setIsPlaying(id); // Mostrar loading
        const { data, error } = await supabase.functions.invoke('voice-preset-audio', {
          body: { preset_id: id }
        });

        if (error || !data?.success) {
          console.error('[VoiceSelector] Error getting signed URL:', error || data?.error);
          toast.error('Erro ao carregar áudio');
          setIsPlaying(null);
          return;
        }

        audioUrl = data.signed_url;
      } catch (err) {
        console.error('[VoiceSelector] Error:', err);
        toast.error('Erro ao carregar áudio');
        setIsPlaying(null);
        return;
      }
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play();
    setIsPlaying(id);
    
    audio.onended = () => setIsPlaying(null);
    audio.onerror = () => {
      setIsPlaying(null);
      toast.error('Erro ao reproduzir áudio');
    };
  };

  const handleRemoveCustomAudio = () => {
    onCustomAudioChange?.(null);
  };

  const renderPresetItem = (preset: VoicePreset) => (
    <div
      key={preset.id}
      className={`
        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
        ${value === preset.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'}
      `}
      onClick={() => handlePresetSelect(preset.id)}
    >
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center
        ${value === preset.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}
      `}>
        {value === preset.id ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <User className="h-4 w-4" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{preset.name}</p>
        {preset.description && (
          <p className="text-xs text-muted-foreground truncate">{preset.description}</p>
        )}
      </div>

      {preset.ref_audio_url && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            handlePlayPreview(preset.id, preset.id, true);
          }}
        >
          {isPlaying === preset.id ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Modo de seleção */}
      <RadioGroup value={mode} onValueChange={(v) => handleModeChange(v as VoiceMode)}>
        <div className="grid grid-cols-2 gap-3">
          <div 
            className={`
              flex items-center gap-3 p-3 rounded-lg border cursor-pointer
              ${mode === 'preset' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}
            `}
            onClick={() => handleModeChange('preset')}
          >
            <RadioGroupItem value="preset" id="voice-preset" />
            <Label htmlFor="voice-preset" className="flex items-center gap-2 cursor-pointer">
              <Library className="h-4 w-4" />
              Vozes Prontas
            </Label>
          </div>
          
          <div 
            className={`
              flex items-center gap-3 p-3 rounded-lg border cursor-pointer
              ${mode === 'custom' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}
            `}
            onClick={() => handleModeChange('custom')}
          >
            <RadioGroupItem value="custom" id="voice-custom" />
            <Label htmlFor="voice-custom" className="flex items-center gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              Minha Voz
            </Label>
          </div>
        </div>
      </RadioGroup>

      {/* Vozes prontas */}
      {mode === 'preset' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando vozes...
            </div>
          ) : presets?.length === 0 ? (
            <Alert>
              <Volume2 className="h-4 w-4" />
              <AlertDescription>
                Nenhuma voz disponível. Use a opção "Minha Voz" para fazer upload de um áudio.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Vozes Femininas */}
              {femalePresets.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Femininas</Label>
                  <div className="space-y-2">
                    {femalePresets.map(renderPresetItem)}
                  </div>
                </div>
              )}

              {/* Vozes Masculinas */}
              {malePresets.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Masculinas</Label>
                  <div className="space-y-2">
                    {malePresets.map(renderPresetItem)}
                  </div>
                </div>
              )}

              {/* Vozes Neutras */}
              {neutralPresets.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Neutras</Label>
                  <div className="space-y-2">
                    {neutralPresets.map(renderPresetItem)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Upload de áudio próprio */}
      {mode === 'custom' && (
        <div className="space-y-3">
          <Alert className="bg-muted/50 border-muted-foreground/20">
            <Mic className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Envie um áudio de <strong>10 a 30 segundos</strong> falando naturalmente.
              O modelo irá clonar essa voz para a narração.
            </AlertDescription>
          </Alert>

          {customAudioUrl ? (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-primary bg-primary/5">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Áudio carregado</p>
                <p className="text-xs text-muted-foreground truncate">
                  Pronto para usar na narração
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handlePlayPreview(customAudioUrl, 'custom')}
              >
                {isPlaying === 'custom' ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleRemoveCustomAudio}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div 
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Enviando áudio...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Clique para enviar áudio</p>
                  <p className="text-xs text-muted-foreground">
                    MP3, WAV, M4A • Máx 10MB • 10-30 segundos
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
