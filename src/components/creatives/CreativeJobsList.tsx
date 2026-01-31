/**
 * Creative Jobs List — Lista de jobs de geração
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  RotateCcw,
  Eye,
  Download,
  FolderOpen,
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

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-3">
        {jobs.map((job, index) => {
          const isActive = job.status === 'queued' || job.status === 'running';
          const isFirst = index === 0;
          
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
              <div className="flex items-start justify-between gap-2">
                <Badge variant="outline" className={`${getStatusColor(job.status)} shrink-0`}>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(job.status)}
                    {getStatusLabel(job.status)}
                  </span>
                </Badge>
                <p className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(job.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </p>
              </div>
              <p className="text-sm font-medium break-words line-clamp-2">
                {job.prompt || job.product_name || 'Criativo sem título'}
              </p>
            </div>

            {/* Progress for running jobs */}
            {job.status === 'running' && job.pipeline_steps && (
              <div className="mt-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Etapa {(job.current_step || 0) + 1} de {job.pipeline_steps.length}</span>
                </div>
                <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ 
                      width: `${((job.current_step || 0) + 1) / job.pipeline_steps.length * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Error message */}
            {job.status === 'failed' && job.error_message && (
              <p className="mt-2 text-xs text-destructive">
                {job.error_message}
              </p>
            )}

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2">
              {job.status === 'succeeded' && job.output_urls && job.output_urls.length > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs"
                    onClick={() => window.open(job.output_urls![0], '_blank')}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Ver
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
          );
        })}
      </div>
    </ScrollArea>
  );
}
