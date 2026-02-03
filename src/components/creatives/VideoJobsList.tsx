/**
 * Video Jobs List — Lista de jobs de vídeo com pipeline v2.0
 * 
 * Exibe scores de QA específicos para vídeo:
 * - Similarity Score
 * - Label OCR Score
 * - Temporal Stability Score
 * - Quality Score
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
  Video,
  Layers,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { VideoJob } from '@/hooks/useVideoCreatives';

interface VideoJobsListProps {
  jobs: VideoJob[];
  isLoading: boolean;
  highlightNew?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  queued: { label: 'Na fila', color: 'bg-muted text-muted-foreground border-border' },
  preprocess: { label: 'Preprocessando', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
  rewrite: { label: 'Otimizando prompt', color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' },
  generate_candidates: { label: 'Gerando variações', color: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' },
  qa_select: { label: 'Avaliando qualidade', color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  retry: { label: 'Tentando novamente', color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
  fallback: { label: 'Fallback composição', color: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800' },
  done: { label: 'Concluído', color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' },
  failed: { label: 'Falhou', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const STEP_LABELS: Record<string, string> = {
  preprocess: '🔲 Preparando produto...',
  rewrite: '✍️ Otimizando prompt...',
  generate_candidates: '🎬 Gerando variações...',
  qa_select: '🔍 Avaliando qualidade...',
  retry: '🔄 Retry com fidelidade rígida...',
  fallback: '🎨 Composição de fallback...',
};

export function VideoJobsList({ jobs, isLoading, highlightNew }: VideoJobsListProps) {
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
      case 'done': return <CheckCircle2 className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getQAScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800';
    return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800';
  };

  const isActiveStatus = (status: string) => {
    return !['queued', 'done', 'failed'].includes(status);
  };

  return (
    <ScrollArea className="h-[550px] pr-4">
      <div className="space-y-3">
        {jobs.map((job, index) => {
          const isActive = isActiveStatus(job.status);
          const isFirst = index === 0;
          const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
          
          // Extrair dados de QA do qa_summary
          const qaSummary = job.qa_summary;
          const bestScore = qaSummary?.best_score;
          const usedFallback = job.fallback_used;
          const candidatesCount = qaSummary?.total_candidates;
          const passedCount = qaSummary?.passed_count;
          
          // Progress para jobs ativos
          const steps = ['preprocess', 'rewrite', 'generate_candidates', 'qa_select'];
          const currentStepIndex = steps.indexOf(job.status);
          const progressPercent = job.progress_percent || (currentStepIndex >= 0 
            ? ((currentStepIndex + 1) / steps.length) * 100 
            : job.status === 'done' ? 100 : 0);
          
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`${config.color} shrink-0`}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(job.status)}
                        {config.label}
                      </span>
                    </Badge>
                    
                    {/* Badge de pipeline version */}
                    <Badge variant="secondary" className="text-[10px] h-5">
                      v2.0
                    </Badge>
                    
                    {/* Badge de duração */}
                    <Badge variant="outline" className="text-[10px] h-5">
                      {job.duration_seconds}s
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(job.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </p>
                </div>
                
                {/* Produto/Preset */}
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium break-words line-clamp-1">
                    {job.user_prompt || 'Vídeo de produto'}
                  </p>
                </div>
                
                {/* QA Score Badge (quando disponível) */}
                {job.status === 'done' && bestScore !== undefined && (
                  <div className="flex items-center gap-2 flex-wrap">
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
                      <TooltipContent className="max-w-[280px]">
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Scores de Qualidade</p>
                          <p className="text-xs text-muted-foreground">
                            {passedCount || 0} de {candidatesCount || 0} variações aprovadas
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    
                    {job.best_candidate_id && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            Selecionado
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Melhor variação selecionada automaticamente pelo QA</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {usedFallback && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-600">
                        <Layers className="h-3 w-3" />
                        Fallback
                      </Badge>
                    )}
                    
                    {candidatesCount && (
                      <span className="text-xs text-muted-foreground">
                        {candidatesCount} variações geradas
                      </span>
                    )}
                  </div>
                )}

                {/* Progress for running jobs */}
                {isActive && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{STEP_LABELS[job.status] || job.current_step || 'Processando...'}</span>
                      <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <Progress 
                      value={progressPercent}
                      className="h-1.5"
                    />
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
                  {job.status === 'done' && job.result_url && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => window.open(job.result_url!, '_blank')}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Ver Vídeo
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            const url = job.result_url!;
                            const response = await fetch(url);
                            const blob = await response.blob();
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = `video-${job.id.slice(0, 8)}.mp4`;
                            link.click();
                            URL.revokeObjectURL(link.href);
                          } catch (error) {
                            console.error('Download failed:', error);
                            window.open(job.result_url!, '_blank');
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
                      disabled
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Tentar Novamente
                    </Button>
                  )}
                  {job.cost_credits > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {job.cost_credits} créditos
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
