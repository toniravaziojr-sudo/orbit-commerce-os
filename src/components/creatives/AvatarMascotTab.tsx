/**
 * Avatar Mascote Tab — Avatar/Mascote animado (tipo Magalu)
 * 
 * Pipeline: 
 *   1. TTS (F5 TTS) ou Voice S2S (Chatterbox) para gerar áudio
 *   2. Kling AI Avatar v2 Pro (primário) / Standard (fallback)
 *   3. Sync LipSync v2 Pro (pós-processo opcional)
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';

type VoiceSource = 'tts' | 'upload' | 'reference';
type AvatarStyle = 'cartoon' | '3d' | 'realistic' | 'anime';
type Tone = 'corporate' | 'friendly' | 'expert' | 'casual' | 'energetic';

const TONE_LABELS: Record<Tone, string> = {
  corporate: 'Corporativo (formal)',
  friendly: 'Amigável (próximo)',
  expert: 'Especialista (educativo)',
  casual: 'Casual (descontraído)',
  energetic: 'Enérgico (empolgado)',
};

const AVATAR_STYLE_LABELS: Record<AvatarStyle, string> = {
  cartoon: 'Cartoon 2D',
  '3d': '3D Renderizado',
  realistic: 'Realista',
  anime: 'Anime/Mangá',
};

const VOICE_PRESETS = [
  { id: 'female-young-br', label: 'Feminina Jovem (BR)', lang: 'pt-BR' },
  { id: 'female-mature-br', label: 'Feminina Madura (BR)', lang: 'pt-BR' },
  { id: 'male-young-br', label: 'Masculina Jovem (BR)', lang: 'pt-BR' },
  { id: 'male-mature-br', label: 'Masculina Madura (BR)', lang: 'pt-BR' },
  { id: 'female-young-en', label: 'Female Young (EN)', lang: 'en-US' },
  { id: 'male-young-en', label: 'Male Young (EN)', lang: 'en-US' },
];

export function AvatarMascotTab() {
  // Form state
  const [avatarImage, setAvatarImage] = useState<File | null>(null);
  const [avatarImagePreview, setAvatarImagePreview] = useState<string | null>(null);
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('3d');
  const [script, setScript] = useState('');
  const [voiceSource, setVoiceSource] = useState<VoiceSource>('tts');
  const [voiceAudio, setVoiceAudio] = useState<File | null>(null);
  const [voicePreset, setVoicePreset] = useState('female-young-br');
  const [tone, setTone] = useState<Tone>('friendly');
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [duration, setDuration] = useState<string>('15');
  const [applyLipsyncPost, setApplyLipsyncPost] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const { data: jobs, isLoading } = useCreativeJobs('avatar_mascot');
  const createJob = useCreateCreativeJob();

  const models = CREATIVE_MODELS.avatar_mascot;
  const primaryModel = models.find(m => m.isDefault);
  const fallbackModel = models.find(m => m.id === 'kling-avatar-mascot-std');

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

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    // TODO: Upload files and create job
    console.log('Creating avatar mascot job...', {
      avatarImage,
      avatarStyle,
      script,
      voiceSource,
      voiceAudio,
      voicePreset,
      tone,
      aspectRatio,
      duration,
      applyLipsyncPost,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Novo Avatar Mascote
          </CardTitle>
          <CardDescription>
            Crie vídeos com seu mascote/personagem animado falando (tipo Lu da Magalu)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Faça upload de uma imagem do seu mascote/avatar (2D, 3D ou realista). 
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
                  PNG, JPG ou WEBP (recomendado: fundo transparente)
                </p>
              </div>
            )}
          </div>

          {/* Avatar Style */}
          <div className="space-y-2">
            <Label>Estilo do Avatar</Label>
            <Select value={avatarStyle} onValueChange={(v) => setAvatarStyle(v as AvatarStyle)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AVATAR_STYLE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ajuda a IA a entender melhor como animar seu personagem
            </p>
          </div>

          {/* Script */}
          <div className="space-y-2">
            <Label>Script/Fala do Mascote *</Label>
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`Digite o que o mascote vai falar...

Exemplo:
"Olá, pessoal! Hoje vim apresentar um produto incrível que vai transformar sua rotina de cuidados. É super fácil de usar e os resultados são visíveis em poucos dias!"`}
              rows={5}
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
                <RadioGroupItem value="tts" id="voice-tts" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="voice-tts" className="flex items-center gap-2 cursor-pointer">
                    <Type className="h-4 w-4" />
                    Gerar voz do texto (TTS)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    A IA gera a voz automaticamente a partir do script
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="upload" id="voice-upload" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="voice-upload" className="flex items-center gap-2 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Enviar áudio pronto
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use um áudio já gravado com a fala completa
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="reference" id="voice-ref" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="voice-ref" className="flex items-center gap-2 cursor-pointer">
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

          {(voiceSource === 'upload' || voiceSource === 'reference') && (
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
              
              <p className="text-xs text-muted-foreground">
                {voiceSource === 'upload' 
                  ? 'MP3 ou WAV com a fala completa'
                  : 'MP3 ou WAV de 10-30s para clonagem de voz'}
              </p>
            </div>
          )}

          {/* Tone */}
          <div className="space-y-2">
            <Label>Tom da Apresentação</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TONE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                  <SelectItem value="25">25 segundos</SelectItem>
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

          {/* Lipsync Post-Process */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="lipsync-toggle" className="cursor-pointer">
                Aplicar LipSync Pós-Processo
              </Label>
              <p className="text-xs text-muted-foreground">
                Melhora a sincronia labial (pode adicionar ~30s ao tempo)
              </p>
            </div>
            <Switch
              id="lipsync-toggle"
              checked={applyLipsyncPost}
              onCheckedChange={setApplyLipsyncPost}
            />
          </div>

          {/* Pipeline Info */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Pipeline de modelos:</Label>
            <div className="flex flex-wrap gap-1">
              {voiceSource === 'tts' && (
                <Badge variant="outline" className="text-xs">F5 TTS</Badge>
              )}
              {voiceSource === 'reference' && (
                <Badge variant="outline" className="text-xs">ChatterboxHD</Badge>
              )}
              <Badge variant="outline" className="text-xs bg-primary/5">
                {primaryModel?.name}
              </Badge>
              {applyLipsyncPost && (
                <Badge variant="outline" className="text-xs">Sync LipSync</Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Fallback automático: {fallbackModel?.name}
            </p>
          </div>

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!canSubmit || createJob.isPending}
            onClick={handleSubmit}
          >
            {createJob.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Gerar Avatar Falando
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription>Acompanhe o status dos seus avatares</CardDescription>
        </CardHeader>
        <CardContent>
          <CreativeJobsList jobs={jobs || []} isLoading={isLoading} type="avatar_mascot" />
        </CardContent>
      </Card>
    </div>
  );
}
