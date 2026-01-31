/**
 * UGC Client Tab — Transformar vídeo gravado pelo cliente
 * 
 * Pipeline: PixVerse Swap (pessoa/fundo) + F5-TTS (voz) + Sync LipSync
 * 
 * IMPORTANTE: PixVerse NÃO aceita texto para fundo - apenas image_url
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Video, 
  User, 
  Image as ImageIcon, 
  Mic, 
  AlertTriangle,
  Sparkles,
  Info,
  Wand2,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';

// Opções de resolução PixVerse (conforme schema)
const PIXVERSE_RESOLUTIONS = ['360p', '540p', '720p'] as const;

export function UGCClientTab() {
  // Toggles principais
  const [swapPerson, setSwapPerson] = useState(false);
  const [swapBackground, setSwapBackground] = useState(false);
  const [swapVoice, setSwapVoice] = useState(false);
  const [hasAuthorization, setHasAuthorization] = useState(false);
  
  // Configurações gerais
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [resolution, setResolution] = useState<string>('720p');
  
  // Fundo: upload OU gerar por IA (2 passos)
  const [bgMode, setBgMode] = useState<'upload' | 'generate'>('upload');
  const [bgPrompt, setBgPrompt] = useState('');
  const [bgStyle, setBgStyle] = useState<string>('natural');
  
  // Voz: preset OU clonar
  const [voiceMode, setVoiceMode] = useState<'keep' | 'tts' | 'clone'>('keep');
  const [voicePreset, setVoicePreset] = useState<string>('female-young');
  const [voiceScript, setVoiceScript] = useState('');

  const { data: jobs, isLoading } = useCreativeJobs('ugc_client_video');
  const createJob = useCreateCreativeJob();

  const models = CREATIVE_MODELS.ugc_client_video;
  const needsAuthorization = swapPerson || swapVoice;

  // Validação: script obrigatório se trocar voz (TTS/Clone)
  const isVoiceValid = !swapVoice || voiceMode === 'keep' || voiceScript.trim().length > 0;
  
  // Validação: fundo por IA precisa de prompt
  const isBgValid = !swapBackground || bgMode === 'upload' || bgPrompt.trim().length > 0;
  
  const canSubmit = (swapPerson || swapBackground || swapVoice) && 
                    (!needsAuthorization || hasAuthorization) &&
                    isVoiceValid && isBgValid;

  const handleGenerate = async () => {
    createJob.mutate({
      type: 'ugc_client_video',
      prompt: `UGC transformation`,
      settings: {
        swap_person: swapPerson,
        swap_background: swapBackground,
        swap_voice: swapVoice,
        aspect_ratio: aspectRatio,
        resolution,
        // Fundo
        bg_mode: swapBackground ? bgMode : undefined,
        bg_prompt: bgMode === 'generate' ? bgPrompt : undefined,
        bg_style: bgMode === 'generate' ? bgStyle : undefined,
        // Voz
        voice_mode: swapVoice ? voiceMode : undefined,
        voice_preset: voiceMode === 'tts' ? voicePreset : undefined,
        voice_script: voiceMode !== 'keep' ? voiceScript : undefined,
      },
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Novo UGC (Cliente Gravou)
          </CardTitle>
          <CardDescription>
            Transforme vídeos existentes trocando pessoa, fundo ou voz
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload do Vídeo Base */}
          <div className="space-y-2">
            <Label>Vídeo Base *</Label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arraste o vídeo gravado pelo cliente ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">MP4, MOV até 100MB</p>
            </div>
          </div>

          {/* Opções de Transformação */}
          <div className="space-y-4">
            <Label>O que deseja transformar?</Label>
            
            {/* Trocar Pessoa/Rosto */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox 
                id="swap-person" 
                checked={swapPerson} 
                onCheckedChange={(c) => setSwapPerson(c === true)} 
              />
              <div className="flex-1">
                <Label htmlFor="swap-person" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  Trocar Pessoa/Rosto
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload de 1-3 fotos de referência do novo personagem
                </p>
              </div>
            </div>

            {/* Trocar Fundo */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox 
                id="swap-bg" 
                checked={swapBackground} 
                onCheckedChange={(c) => setSwapBackground(c === true)} 
              />
              <div className="flex-1">
                <Label htmlFor="swap-bg" className="flex items-center gap-2 cursor-pointer">
                  <ImageIcon className="h-4 w-4" />
                  Trocar Fundo
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload de imagem ou gere um cenário com IA
                </p>
              </div>
            </div>

            {/* Trocar Voz */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox 
                id="swap-voice" 
                checked={swapVoice} 
                onCheckedChange={(c) => setSwapVoice(c === true)} 
              />
              <div className="flex-1">
                <Label htmlFor="swap-voice" className="flex items-center gap-2 cursor-pointer">
                  <Mic className="h-4 w-4" />
                  Trocar Voz
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Gerar nova voz via TTS ou clonar uma voz de referência
                </p>
              </div>
            </div>
          </div>

          {/* Campos condicionais: Pessoa */}
          {swapPerson && (
            <div className="space-y-2 p-4 rounded-lg bg-muted/50">
              <Label>Fotos de Referência (1-3)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer">
                <User className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Clique para adicionar fotos</p>
              </div>
            </div>
          )}

          {/* Campos condicionais: Fundo (2 modos) */}
          {swapBackground && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <Label>Referência de Fundo</Label>
              
              {/* Tabs: Upload ou Gerar */}
              <Tabs value={bgMode} onValueChange={(v) => setBgMode(v as 'upload' | 'generate')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload
                  </TabsTrigger>
                  <TabsTrigger value="generate" className="gap-2">
                    <Wand2 className="h-4 w-4" />
                    Gerar por IA
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload" className="mt-3">
                  <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer">
                    <ImageIcon className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Upload de imagem de fundo</p>
                  </div>
                </TabsContent>
                
                <TabsContent value="generate" className="mt-3 space-y-3">
                  <Alert className="bg-primary/10 border-primary/20">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      O fundo será gerado primeiro via GPT Image e depois aplicado no vídeo via PixVerse.
                    </AlertDescription>
                  </Alert>
                  <Textarea 
                    value={bgPrompt}
                    onChange={(e) => setBgPrompt(e.target.value)}
                    placeholder="Descreva o cenário: ex. 'banheiro moderno com iluminação natural, parede branca, espelho grande'" 
                    rows={3}
                  />
                  <Select value={bgStyle} onValueChange={setBgStyle}>
                    <SelectTrigger>
                      <SelectValue placeholder="Estilo visual" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="natural">Natural / Realista</SelectItem>
                      <SelectItem value="studio">Estúdio Profissional</SelectItem>
                      <SelectItem value="modern">Moderno / Minimalista</SelectItem>
                      <SelectItem value="luxury">Luxuoso / Premium</SelectItem>
                      <SelectItem value="outdoor">Ar Livre</SelectItem>
                    </SelectContent>
                  </Select>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Campos condicionais: Voz */}
          {swapVoice && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <Label>Configuração de Voz</Label>
              
              {/* Modo de voz */}
              <Select value={voiceMode} onValueChange={(v) => setVoiceMode(v as 'keep' | 'tts' | 'clone')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Manter Voz Original</SelectItem>
                  <SelectItem value="tts">Nova Voz (TTS Preset)</SelectItem>
                  <SelectItem value="clone">Clonar Voz (Referência)</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Script obrigatório para TTS/Clone */}
              {voiceMode !== 'keep' && (
                <>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Script *
                      <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
                    </Label>
                    <Textarea 
                      value={voiceScript}
                      onChange={(e) => setVoiceScript(e.target.value)}
                      placeholder="Digite o texto que será falado no vídeo..." 
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      {voiceScript.length} caracteres • Este texto será sintetizado via F5-TTS e aplicado com LipSync
                    </p>
                  </div>
                  
                  {voiceMode === 'tts' && (
                    <div className="space-y-2">
                      <Label>Preset de Voz</Label>
                      <Select value={voicePreset} onValueChange={setVoicePreset}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female-young">Feminina Jovem (Entusiasta)</SelectItem>
                          <SelectItem value="female-mature">Feminina Madura (Confiante)</SelectItem>
                          <SelectItem value="male-young">Masculina Jovem (Casual)</SelectItem>
                          <SelectItem value="male-mature">Masculina Madura (Profissional)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {voiceMode === 'clone' && (
                    <div className="space-y-2">
                      <Label>Áudio de Referência (10-30s)</Label>
                      <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer">
                        <Mic className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Upload de áudio para clonar voz</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        F5-TTS requer áudio de referência (ref_audio_url) para clonagem
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Resolução (PixVerse) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proporção do Vídeo</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                  <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                  <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                  <SelectItem value="original">Manter Original</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolução (PixVerse)</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIXVERSE_RESOLUTIONS.map(res => (
                    <SelectItem key={res} value={res}>{res}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Authorization Warning */}
          {needsAuthorization && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-start gap-2">
                  <Checkbox 
                    id="authorization"
                    checked={hasAuthorization}
                    onCheckedChange={(c) => setHasAuthorization(c === true)}
                  />
                  <Label htmlFor="authorization" className="text-sm font-normal cursor-pointer">
                    Declaro que tenho autorização e direitos de uso de imagem/voz do material enviado.
                    Entendo que a responsabilidade pelo uso é minha.
                  </Label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Modelos Utilizados */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Modelos IA utilizados neste pipeline:</Label>
            <div className="flex flex-wrap gap-1">
              {models.map(m => (
                <Badge key={m.id} variant="outline" className="text-xs">
                  {m.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!canSubmit || createJob.isPending}
            onClick={handleGenerate}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {createJob.isPending ? 'Processando...' : 'Gerar UGC Transformado'}
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription>Acompanhe o status dos seus criativos</CardDescription>
        </CardHeader>
        <CardContent>
          <CreativeJobsList jobs={jobs || []} isLoading={isLoading} type="ugc_client_video" />
        </CardContent>
      </Card>
    </div>
  );
}
