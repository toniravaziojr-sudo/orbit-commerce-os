// =============================================
// VERSION HISTORY - Dialog to view/restore versions
// =============================================

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, RotateCcw, Upload, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePageVersionHistory, useRestoreVersion, usePublish } from '@/hooks/useBuilderData';
import type { BlockNode, PageVersion } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'page' | 'template';
  pageId?: string;
  pageType?: PageType;
  onRestore?: (content: BlockNode) => void;
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  entityType,
  pageId,
  pageType,
  onRestore,
}: VersionHistoryDialogProps) {
  const { data: versions, isLoading } = usePageVersionHistory(entityType, pageId, pageType);
  const restoreVersion = useRestoreVersion();
  const publish = usePublish();

  const handleRestore = async (version: PageVersion) => {
    try {
      const result = await restoreVersion.mutateAsync({ versionId: version.id });
      if (onRestore && result.content) {
        onRestore(result.content);
      }
      onOpenChange(false);
      toast.success(`Versão ${version.version} restaurada como novo rascunho`);
    } catch (error) {
      toast.error('Erro ao restaurar versão');
    }
  };

  const handlePublishVersion = async (version: PageVersion) => {
    try {
      await publish.mutateAsync({
        entityType,
        pageId,
        pageType,
        content: version.content as BlockNode,
      });
      onOpenChange(false);
      toast.success(`Versão ${version.version} publicada`);
    } catch (error) {
      toast.error('Erro ao publicar versão');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Publicado</Badge>;
      case 'draft':
        return <Badge variant="secondary">Rascunho</Badge>;
      case 'archived':
        return <Badge variant="outline" className="text-muted-foreground">Arquivado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Versões
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : versions?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma versão encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions?.map((version, index) => (
                <div
                  key={version.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg border',
                    version.status === 'published' && 'border-green-500/30 bg-green-500/5',
                    version.status === 'draft' && 'border-primary/30 bg-primary/5'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold">v{version.version}</div>
                      <div className="text-xs text-muted-foreground">
                        {index === 0 ? 'Atual' : ''}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(version.status)}
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(version.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {version.status !== 'published' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePublishVersion(version)}
                        disabled={publish.isPending}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Publicar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(version)}
                      disabled={restoreVersion.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restaurar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
