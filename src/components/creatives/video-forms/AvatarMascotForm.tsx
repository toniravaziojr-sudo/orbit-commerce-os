/**
 * Avatar Mascot Form — Avatar/Mascote animado falante
 * 
 * Pipeline: HeyGen (avatar nativo com voz PT-BR)
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Sparkles,
  Upload,
  Mic,
  Volume2,
  Type,
  Image as ImageIcon,
  Info,
  Loader2,
  X,
  Video,
  Construction,
} from 'lucide-react';

type VoiceSource = 'tts' | 'upload' | 'clone';

const VOICE_PRESETS = [
  { id: 'female-young-br', label: 'Feminina Jovem (BR)', lang: 'pt-BR' },
  { id: 'female-mature-br', label: 'Feminina Madura (BR)', lang: 'pt-BR' },
  { id: 'male-young-br', label: 'Masculina Jovem (BR)', lang: 'pt-BR' },
  { id: 'male-mature-br', label: 'Masculina Madura (BR)', lang: 'pt-BR' },
];

export function AvatarMascotForm() {
  // Form state
  const [avatarImage, setAvatarImage] = useState<File | null>(null);
  const [avatarImagePreview, setAvatarImagePreview] = useState<string | null>(null);
  const [script, setScript] = useState('');
  const [voiceSource, setVoiceSource] = useState<VoiceSource>('tts');
  const [voiceAudio, setVoiceAudio] = useState<File | null>(null);
  const [voicePreset, setVoicePreset] = useState('female-young-br');
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [duration, setDuration] = useState<string>('15');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarImage(file);
      const reader = new FileReader();
      reader.onload = () => setAvatarImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVoiceAudio(file);
    }
  };

  const removeAvatarImage = () => {
    setAvatarImage(null);
    setAvatarImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAudioFile = () => {
    setVoiceAudio(null);
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  const canSubmit = avatarImage && script.trim().length > 10 && (voiceSource === 'tts' || voiceAudio);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Avatar / Mascote
          </CardTitle>
          <CardDescription>
            Avatar animado falando (estilo Lu da Magalu)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Em desenvolvimento */}
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <Construction className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              <strong>Em desenvolvimento:</strong> Integração com HeyGen em andamento.
            </AlertDescription>
          </Alert>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Upload de imagem do seu mascote/avatar (2D, 3D ou realista). 
              A IA vai animá-lo para falar o script fornecido.
            </AlertDescription>
          </Alert>

          {/* Avatar Image Upload */}
          <div className="space-y-2">
            <Label>Imagem do Avatar/Mascote *</Label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            
            {avatarImagePreview ? (
              <div className="relative inline-block">
                <img
                  src={avatarImagePreview}
                  alt="Avatar"
                  className="w-32 h-32 object-cover rounded-lg border"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={removeAvatarImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Clique para enviar</p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG ou WEBP (fundo transparente recomendado)
                </p>
              </div>
            )}
          </div>

          {/* Script */}
          <div className="space-y-2">
            <Label>Script/Fala do Mascote *</Label>
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`Digite o que o mascote vai falar...

Exemplo:
"Olá, pessoal! Hoje vim apresentar um produto incrível que vai transformar sua rotina!"`}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {script.length} caracteres • Recomendado: 100-300 para vídeos de 10-20s
            </p>
          </div>

          {/* Voice Source */}
          <div className="space-y-3">
            <Label>Fonte da Voz</Label>
            <RadioGroup value={voiceSource} onValueChange={(v) => setVoiceSource(v as VoiceSource)}>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="tts" id="voice-tts-avatar" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="voice-tts-avatar" className="flex items-center gap-2 cursor-pointer">
                    <Type className="h-4 w-4" />
                    Gerar voz do texto (TTS)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    A IA gera a voz automaticamente a partir do script
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="upload" id="voice-upload-avatar" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="voice-upload-avatar" className="flex items-center gap-2 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Enviar áudio pronto
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use um áudio já gravado com a fala completa
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="clone" id="voice-clone-avatar" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="voice-clone-avatar" className="flex items-center gap-2 cursor-pointer">
                    <Mic className="h-4 w-4" />
                    Clonar voz de referência
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Envie um áudio de 10-30s para clonar a voz
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Voice Settings based on source */}
          {voiceSource === 'tts' && (
            <div className="space-y-2">
              <Label>Preset de Voz</Label>
              <Select value={voicePreset} onValueChange={setVoicePreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(voiceSource === 'upload' || voiceSource === 'clone') && (
            <div className="space-y-2">
              <Label>
                {voiceSource === 'upload' ? 'Áudio da Fala' : 'Áudio de Referência'} *
              </Label>
              <input
                type="file"
                ref={audioInputRef}
                accept="audio/*"
                onChange={handleAudioUpload}
                className="hidden"
              />
              
              {voiceAudio ? (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Volume2 className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 truncate">
                    <p className="text-sm font-medium truncate">{voiceAudio.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(voiceAudio.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={removeAudioFile}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => audioInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Áudio
                </Button>
              )}
            </div>
          )}

          {/* Duration & Aspect Ratio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 segundos</SelectItem>
                  <SelectItem value="15">15 segundos</SelectItem>
                  <SelectItem value="20">20 segundos</SelectItem>
                  <SelectItem value="30">30 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Proporção</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                  <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                  <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!canSubmit}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar Avatar Falando
          </Button>
        </CardContent>
      </Card>

      {/* Placeholder para lista de jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription>Acompanhe o status dos seus avatares</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma geração ainda</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
