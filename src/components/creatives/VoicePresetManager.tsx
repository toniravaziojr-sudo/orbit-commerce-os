/**
 * VoicePresetManager — Gerenciamento de presets de voz (Admin)
 * 
 * Permite fazer upload de áudios de referência para cada preset.
 * Os áudios são armazenados no bucket system-voice-presets.
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Upload, 
  Play, 
  Pause, 
  Check,
  AlertCircle,
  Loader2,
  Volume2,
  Mic,
  RefreshCw,
} from 'lucide-react';

interface VoicePresetRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: 'female' | 'male' | 'neutral';
  language: string;
  ref_audio_url: string | null;
  ref_text: string | null;
  is_active: boolean;
}

export function VoicePresetManager() {
  const queryClient = useQueryClient();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Buscar todos os presets ativos
  const { data: presets, isLoading } = useQuery({
    queryKey: ['voice-presets-admin'],
    queryFn: async (): Promise<VoicePresetRow[]> => {
      const { data, error } = await supabase
        .from('voice_presets')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (error) throw error;
      return (data || []) as VoicePresetRow[];
    },
  });

  // Mutation para atualizar ref_audio_url
  const updatePreset = useMutation({
    mutationFn: async ({ id, ref_audio_url }: { id: string; ref_audio_url: string }) => {
      const { error } = await supabase
        .from('voice_presets')
        .update({ ref_audio_url })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-presets-admin'] });
      queryClient.invalidateQueries({ queryKey: ['voice-presets'] });
      toast.success('Áudio atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating preset:', error);
      toast.error('Erro ao atualizar preset');
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPresetId) return;

    // Validar tipo
    if (!file.type.startsWith('audio/')) {
      toast.error('Selecione um arquivo de áudio válido');
      return;
    }

    // Validar tamanho (máx 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 50MB');
      return;
    }

    // Encontrar o preset
    const preset = presets?.find(p => p.id === selectedPresetId);
    if (!preset) return;

    setUploadingId(selectedPresetId);
    try {
      // Nome do arquivo: slug.ext
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      const storagePath = `${preset.slug}.${ext}`;

      // Deletar arquivo anterior se existir (upsert manual)
      await supabase.storage
        .from('system-voice-presets')
        .remove([storagePath]);

      // Upload novo arquivo
      const { error: uploadError } = await supabase.storage
        .from('system-voice-presets')
        .upload(storagePath, file, { 
          upsert: true,
          cacheControl: '31536000', // 1 ano
        });

      if (uploadError) throw uploadError;

      // Pegar URL pública
      const { data: publicUrlData } = supabase.storage
        .from('system-voice-presets')
        .getPublicUrl(storagePath);

      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) throw new Error('Erro ao obter URL pública');

      // Atualizar preset no banco
      await updatePreset.mutateAsync({ id: selectedPresetId, ref_audio_url: publicUrl });

    } catch (error) {
      console.error('Error uploading audio:', error);
      toast.error('Erro ao enviar áudio');
    } finally {
      setUploadingId(null);
      setSelectedPresetId(null);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePlay = (audioUrl: string, id: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play();
    setPlayingId(id);
    
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      toast.error('Erro ao reproduzir áudio (URL pode estar inacessível)');
    };
  };

  const handleUploadClick = (presetId: string) => {
    setSelectedPresetId(presetId);
    fileInputRef.current?.click();
  };

  // Agrupar por categoria
  const femalePresets = presets?.filter(p => p.category === 'female') || [];
  const malePresets = presets?.filter(p => p.category === 'male') || [];
  const neutralPresets = presets?.filter(p => p.category === 'neutral') || [];

  const configuredCount = presets?.filter(p => p.ref_audio_url).length || 0;
  const totalCount = presets?.length || 0;

  const renderPresetCard = (preset: VoicePresetRow) => {
    const isConfigured = !!preset.ref_audio_url;
    const isUploading = uploadingId === preset.id;
    const isPlaying = playingId === preset.id;

    return (
      <div
        key={preset.id}
        className={`
          flex items-start gap-4 p-4 rounded-lg border
          ${isConfigured ? 'border-green-500/30 bg-green-500/5' : 'border-orange-500/30 bg-orange-500/5'}
        `}
      >
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center shrink-0
          ${isConfigured ? 'bg-green-500/20' : 'bg-orange-500/20'}
        `}>
          {isConfigured ? (
            <Check className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-orange-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{preset.name}</h4>
            <Badge variant="outline" className="text-xs">
              {preset.slug}
            </Badge>
          </div>
          {preset.description && (
            <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
          )}
          
          {/* Script de referência */}
          {preset.ref_text && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Ver script para gravar
              </summary>
              <p className="mt-1 text-xs bg-muted/50 p-2 rounded italic">
                "{preset.ref_text}"
              </p>
            </details>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isConfigured && preset.ref_audio_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePlay(preset.ref_audio_url!, preset.id)}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          )}
          
          <Button
            variant={isConfigured ? 'outline' : 'default'}
            size="sm"
            onClick={() => handleUploadClick(preset.id)}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                {isConfigured ? 'Trocar' : 'Enviar'}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Biblioteca de Vozes PT-BR
            </CardTitle>
            <CardDescription>
              Faça upload dos áudios de referência para cada preset (10-30 segundos, voz limpa)
            </CardDescription>
          </div>
          <Badge variant={configuredCount === totalCount ? 'default' : 'secondary'}>
            {configuredCount}/{totalCount} configurados
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Input hidden para upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Alerta se faltam presets */}
        {configuredCount < totalCount && (
          <Alert className="bg-orange-500/10 border-orange-500/30">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription>
              <strong>{totalCount - configuredCount} vozes</strong> ainda precisam de áudio de referência.
              Grave ou contrate locuções PT-BR de 10-30 segundos usando os scripts fornecidos.
            </AlertDescription>
          </Alert>
        )}

        {/* Vozes Femininas */}
        {femalePresets.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Vozes Femininas ({femalePresets.filter(p => p.ref_audio_url).length}/{femalePresets.length})
            </h3>
            <div className="space-y-2">
              {femalePresets.map(renderPresetCard)}
            </div>
          </div>
        )}

        {/* Vozes Masculinas */}
        {malePresets.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Vozes Masculinas ({malePresets.filter(p => p.ref_audio_url).length}/{malePresets.length})
            </h3>
            <div className="space-y-2">
              {malePresets.map(renderPresetCard)}
            </div>
          </div>
        )}

        {/* Vozes Neutras */}
        {neutralPresets.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Vozes Neutras ({neutralPresets.filter(p => p.ref_audio_url).length}/{neutralPresets.length})
            </h3>
            <div className="space-y-2">
              {neutralPresets.map(renderPresetCard)}
            </div>
          </div>
        )}

        {/* Instruções */}
        <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
          <h4 className="font-medium">📝 Instruções para gravar:</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
            <li>Use um ambiente silencioso (sem ruídos de fundo)</li>
            <li>Grave 10-30 segundos lendo o script fornecido</li>
            <li>Fale naturalmente, sem pressa, articulando bem</li>
            <li>Formatos aceitos: MP3, WAV, M4A, OGG</li>
            <li>O áudio será usado pelo F5-TTS para clonar a voz</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
