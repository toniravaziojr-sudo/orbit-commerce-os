/**
 * Creative Jobs List — Lista de jobs de geração (v2.0)
 * 
 * Exibe scores de QA, fallback info e seleção automática
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  RotateCcw,
  Eye,
  Download,
  FolderOpen,
  Shield,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStatusColor, getStatusLabel, useRetryCreativeJob } from '@/hooks/useCreatives';
import type { CreativeJob, CreativeType } from '@/types/creatives';

interface CreativeJobsListProps {
  jobs: CreativeJob[];
  isLoading: boolean;
  type: CreativeType;
  highlightNew?: boolean;
}

export function CreativeJobsList({ jobs, isLoading, type, highlightNew }: CreativeJobsListProps) {
  const retryJob = useRetryCreativeJob();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8">
        <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Nenhuma geração ainda.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Preencha o formulário ao lado para começar.
        </p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued': return <Clock className="h-4 w-4" />;
      case 'running': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'succeeded': return <CheckCircle2 className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const getQAScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <ScrollArea className="h-[550px] pr-4">
      <div className="space-y-3">
        {jobs.map((job, index) => {
          const isActive = job.status === 'queued' || job.status === 'running';
          const isFirst = index === 0;
          
          // Extrair info de QA do settings
          const settings = job.settings as any;
          const qaResults = settings?.qa_results;
          const bestScore = settings?.best_score;
          const bestVariantIndex = settings?.best_variant_index;
          const actualVariants = settings?.actual_variants;
          const pipelineVersion = settings?.pipeline_version;
          
          return (
            <div 
              key={job.id} 
              className={`p-3 rounded-lg border transition-all ${
                isActive 
                  ? 'bg-primary/5 border-primary/30 shadow-sm' 
                  : 'bg-card hover:bg-accent/50'
              } ${isFirst && highlightNew ? 'ring-2 ring-primary ring-offset-1 animate-pulse' : ''}`}
            >
              <div className="space-y-2">
                {/* Header com status e tempo */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`${getStatusColor(job.status)} shrink-0`}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(job.status)}
                        {getStatusLabel(job.status)}
                      </span>
                    </Badge>
                    
                    {/* Badge de versão da pipeline */}
                    {pipelineVersion && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        v{pipelineVersion}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(job.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </p>
                </div>
                
                {/* Título/Prompt */}
                <p className="text-sm font-medium break-words line-clamp-2">
                  {job.prompt || job.product_name || 'Criativo sem título'}
                </p>
                
                {/* QA Score Badge (quando disponível) */}
                {job.status === 'succeeded' && bestScore !== undefined && (
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge 
                          variant="outline" 
                          className={`${getQAScoreColor(bestScore)} text-xs flex items-center gap-1`}
                        >
                          <Shield className="h-3 w-3" />
                          QA: {(bestScore * 100).toFixed(0)}%
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Score de qualidade automático</p>
                        <p className="text-xs text-muted-foreground">
                          Avalia fidelidade do rótulo e similaridade
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    
                    {bestVariantIndex && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            Melhor: #{bestVariantIndex}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Variação selecionada automaticamente</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {actualVariants !== undefined && job.output_urls && (
                      <span className="text-xs text-muted-foreground">
                        {actualVariants}/{job.output_urls.length} aprovadas
                      </span>
                    )}
                  </div>
                )}

                {/* Progress for running jobs */}
                {job.status === 'running' && job.pipeline_steps && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Etapa {(job.current_step || 0) + 1} de {job.pipeline_steps.length}</span>
                      <span>{Math.round(((job.current_step || 0) + 1) / job.pipeline_steps.length * 100)}%</span>
                    </div>
                    <Progress 
                      value={((job.current_step || 0) + 1) / job.pipeline_steps.length * 100}
                      className="h-1.5"
                    />
                    {job.pipeline_steps[(job.current_step || 0)] && (
                      <p className="text-[10px] text-muted-foreground">
                        {job.pipeline_steps[(job.current_step || 0)].step_id === 'cutout' && '🔲 Recortando produto...'}
                        {job.pipeline_steps[(job.current_step || 0)].step_id?.startsWith('image_') && '🎨 Gerando variação...'}
                        {job.pipeline_steps[(job.current_step || 0)].step_id === 'qa' && '🔍 Avaliando qualidade...'}
                        {job.pipeline_steps[(job.current_step || 0)].step_id === 'select' && '⭐ Selecionando melhor...'}
                      </p>
                    )}
                  </div>
                )}

                {/* Error message */}
                {job.status === 'failed' && job.error_message && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <p>{job.error_message}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {job.status === 'succeeded' && job.output_urls && job.output_urls.length > 0 && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => window.open(job.output_urls![0], '_blank')}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {job.output_urls.length > 1 ? `Ver ${job.output_urls.length}` : 'Ver'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            const url = job.output_urls![0];
                            const response = await fetch(url);
                            const blob = await response.blob();
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            const ext = url.includes('.mp4') ? 'mp4' : 'png';
                            link.download = `criativo-${job.id.slice(0, 8)}.${ext}`;
                            link.click();
                            URL.revokeObjectURL(link.href);
                          } catch (error) {
                            console.error('Download failed:', error);
                            window.open(job.output_urls![0], '_blank');
                          }
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Baixar
                      </Button>
                    </>
                  )}
                  {job.status === 'failed' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={() => retryJob.mutate(job.id)}
                      disabled={retryJob.isPending}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Tentar Novamente
                    </Button>
                  )}
                  {job.cost_cents && job.cost_cents > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      R$ {(job.cost_cents / 100).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
