/**
 * UGC Client Tab — Transformar vídeo gravado pelo cliente
 * 
 * Pipeline: PixVerse Swap (pessoa/fundo) + ChatterboxHD (voz) + Sync LipSync
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Info,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';

export function UGCClientTab() {
  const [swapPerson, setSwapPerson] = useState(false);
  const [swapBackground, setSwapBackground] = useState(false);
  const [swapVoice, setSwapVoice] = useState(false);
  const [hasAuthorization, setHasAuthorization] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');

  const { data: jobs, isLoading } = useCreativeJobs('ugc_client_video');
  const createJob = useCreateCreativeJob();

  const models = CREATIVE_MODELS.ugc_client_video;
  const needsAuthorization = swapPerson || swapVoice;

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
                  Upload de imagem ou descreva o cenário desejado
                </p>
              </div>
            </div>

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
                  Upload de áudio de referência ou escolha um preset
                </p>
              </div>
            </div>
          </div>

          {/* Campos condicionais */}
          {swapPerson && (
            <div className="space-y-2 p-4 rounded-lg bg-muted/50">
              <Label>Fotos de Referência (1-3)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer">
                <User className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Clique para adicionar fotos</p>
              </div>
            </div>
          )}

          {swapBackground && (
            <div className="space-y-2 p-4 rounded-lg bg-muted/50">
              <Label>Referência de Fundo</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer mb-2">
                <ImageIcon className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Upload de imagem (opcional)</p>
              </div>
              <Textarea placeholder="Ou descreva o cenário: ex. 'banheiro moderno com iluminação natural'" />
            </div>
          )}

          {swapVoice && (
            <div className="space-y-2 p-4 rounded-lg bg-muted/50">
              <Label>Voz de Referência</Label>
              <Select defaultValue="preset-1">
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preset-1">Voz Masculina Jovem</SelectItem>
                  <SelectItem value="preset-2">Voz Masculina Madura</SelectItem>
                  <SelectItem value="preset-3">Voz Feminina Jovem</SelectItem>
                  <SelectItem value="preset-4">Voz Feminina Madura</SelectItem>
                  <SelectItem value="custom">Upload de Áudio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aspect Ratio */}
          <div className="space-y-2">
            <Label>Proporção do Vídeo</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">9:16 (Vertical - Stories/Reels)</SelectItem>
                <SelectItem value="16:9">16:9 (Horizontal - YouTube)</SelectItem>
                <SelectItem value="1:1">1:1 (Quadrado - Feed)</SelectItem>
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
            disabled={!swapPerson && !swapBackground && !swapVoice || (needsAuthorization && !hasAuthorization)}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar UGC Transformado
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
