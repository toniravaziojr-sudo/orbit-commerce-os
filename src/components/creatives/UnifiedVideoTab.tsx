/**
 * Unified Video Tab — Aba unificada para geração de vídeos via fal.ai
 * 
 * Stack v3.0:
 * - Premium: Kling v3 Pro I2V (fal.ai)
 * - Áudio Nativo: Veo 3.1 (fal.ai)
 * - Econômico: Wan 2.6 I2V (fal.ai)
 * - Fallback: Imagem estática (Gemini/OpenAI/Gateway)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Video, Sparkles, ArrowRight } from 'lucide-react';
import { VideoGeneratorForm } from './video-forms/VideoGeneratorForm';
import { useIsSpecialTenant } from '@/hooks/useIsSpecialTenant';

const PIPELINE = ['fal.ai', 'Kling v3 / Veo 3.1 / Wan 2.6'];

export function UnifiedVideoTab() {
  const isSpecial = useIsSpecialTenant();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Gerar Vídeo com IA</CardTitle>
              <CardDescription>
                Selecione o produto, qualidade e configurações
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        {isSpecial && (
          <CardContent>
            <Alert className="bg-muted/50">
              <Sparkles className="h-4 w-4" />
              <AlertDescription className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium">Pipeline:</span>
                {PIPELINE.map((tool, index) => (
                  <span key={tool} className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">{tool}</Badge>
                    {index < PIPELINE.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Formulário unificado */}
      <VideoGeneratorForm />
    </div>
  );
}
