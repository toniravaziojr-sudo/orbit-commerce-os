/**
 * Unified Video Tab — Aba unificada para geração de vídeos via fal.ai
 * 
 * Stack v3.0:
 * - Premium: Kling v3 Pro I2V (fidelidade máxima de produto)
 * - Com Áudio: Veo 3.1 (qualidade cinema + áudio nativo)
 * - Econômico: Wan 2.6 I2V (custo reduzido para escala)
 * - Lipsync: Kling Lipsync (pós-processamento com TTS ElevenLabs)
 * - Fallback: Imagem estática via stack atual
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Video, 
  Sparkles,
  ArrowRight,
} from 'lucide-react';

import { VideoGeneratorForm } from './video-forms/VideoGeneratorForm';

const PIPELINE_TOOLS = ['fal.ai', 'ElevenLabs', 'Kling Lipsync'];

export function UnifiedVideoTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Gerar Vídeo com IA</CardTitle>
                <CardDescription>
                  Selecione o produto, configure a qualidade e gere vídeos profissionais
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Pipeline Info */}
          <Alert className="bg-muted/50">
            <Sparkles className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">Pipeline:</span>
              {PIPELINE_TOOLS.map((tool, index) => (
                <span key={tool} className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    {tool}
                  </Badge>
                  {index < PIPELINE_TOOLS.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </span>
              ))}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Separator />

      {/* Formulário unificado */}
      <VideoGeneratorForm />
    </div>
  );
}
