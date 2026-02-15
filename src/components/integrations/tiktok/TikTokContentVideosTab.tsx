import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ExternalLink, Trash2, Video, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import { useTikTokContent } from '@/hooks/useTikTokContent';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    published: { label: 'Publicado', className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' },
    draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground border-border' },
    uploading: { label: 'Enviando', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' },
    failed: { label: 'Falhou', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

export function TikTokContentVideosTab() {
  const { videos, videosLoading, syncVideos, deleteVideo } = useTikTokContent();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {videos.length} vídeo(s)
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncVideos.mutate()}
          disabled={syncVideos.isPending}
        >
          {syncVideos.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sincronizar
        </Button>
      </div>

      {videosLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum vídeo encontrado</p>
          <p className="text-xs mt-1">Clique em "Sincronizar" para importar vídeos do TikTok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((video: any) => {
            const meta = video.metadata || {};
            return (
              <div key={video.id} className="flex items-start gap-3 p-3 border rounded-lg">
                {video.cover_url ? (
                  <img
                    src={video.cover_url}
                    alt={video.title}
                    className="w-16 h-16 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{video.title || 'Sem título'}</p>
                    <StatusBadge status={video.status} />
                  </div>
                  {video.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                      {video.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {video.published_at && (
                      <span>{format(new Date(video.published_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                    )}
                    {meta.view_count != null && (
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{meta.view_count?.toLocaleString()}</span>
                    )}
                    {meta.like_count != null && (
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{meta.like_count?.toLocaleString()}</span>
                    )}
                    {meta.comment_count != null && (
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{meta.comment_count?.toLocaleString()}</span>
                    )}
                    {meta.share_count != null && (
                      <span className="flex items-center gap-1"><Share2 className="h-3 w-3" />{meta.share_count?.toLocaleString()}</span>
                    )}
                    {video.duration_seconds && (
                      <span>{video.duration_seconds}s</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {video.share_url && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={video.share_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteVideo.mutate(video.id)}
                    disabled={deleteVideo.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
