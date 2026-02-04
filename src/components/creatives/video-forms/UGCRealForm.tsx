/**
 * UGC Real Form — Transformar vídeo gravado pelo cliente
 * 
 * Pipeline: Akool (face swap) + ElevenLabs (voice) + Sync Labs (lipsync)
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Construction,
} from 'lucide-react';

export function UGCRealForm() {
  // Toggles principais
  const [swapFace, setSwapFace] = useState(false);
  const [swapBackground, setSwapBackground] = useState(false);
  const [swapVoice, setSwapVoice] = useState(false);
  const [hasAuthorization, setHasAuthorization] = useState(false);
  
  // Configurações gerais
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  
  const needsAuthorization = swapFace || swapVoice;
  const canSubmit = (swapFace || swapBackground || swapVoice) && 
                    (!needsAuthorization || hasAuthorization);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            UGC Transformado
          </CardTitle>
          <CardDescription>
            Transforme vídeos existentes: trocar rosto, voz ou fundo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Em desenvolvimento */}
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <Construction className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              <strong>Em desenvolvimento:</strong> Integração com Akool para face swap em andamento.
            </AlertDescription>
          </Alert>

          {/* Upload do Vídeo Base */}
          <div className="space-y-2">
            <Label>Vídeo Base *</Label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer opacity-50">
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
            
            {/* Trocar Rosto (Akool) */}
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox 
                id="swap-face" 
                checked={swapFace} 
                onCheckedChange={(c) => setSwapFace(c === true)} 
              />
              <div className="flex-1">
                <Label htmlFor="swap-face" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  Trocar Rosto
                  <Badge variant="outline" className="text-[10px]">Akool</Badge>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload de 1-3 fotos do novo rosto
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

            {/* Trocar Voz (ElevenLabs) */}
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
                  <Badge variant="outline" className="text-[10px]">ElevenLabs</Badge>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Gerar nova voz via TTS ou clonar uma voz de referência
                </p>
              </div>
            </div>
          </div>

          {/* Proporção */}
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
                  </Label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!canSubmit}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar UGC Transformado
          </Button>
        </CardContent>
      </Card>

      {/* Placeholder para lista de jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription>Acompanhe o status dos seus vídeos</CardDescription>
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
