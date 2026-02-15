import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, BarChart3, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import { useTikTokContent } from '@/hooks/useTikTokContent';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TikTokContentAnalyticsTab() {
  const { analytics, analyticsLoading, syncAnalytics } = useTikTokContent();

  // Aggregate totals
  const totals = analytics.reduce(
    (acc: any, a: any) => ({
      views: acc.views + (a.views || 0),
      likes: acc.likes + (a.likes || 0),
      comments: acc.comments + (a.comments || 0),
      shares: acc.shares + (a.shares || 0),
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {analytics.length} registro(s) de analytics
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncAnalytics.mutate()}
          disabled={syncAnalytics.isPending}
        >
          {syncAnalytics.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sincronizar
        </Button>
      </div>

      {/* Summary cards */}
      {analytics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 border rounded-lg text-center">
            <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-semibold">{totals.views.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Views</p>
          </div>
          <div className="p-3 border rounded-lg text-center">
            <Heart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-semibold">{totals.likes.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Curtidas</p>
          </div>
          <div className="p-3 border rounded-lg text-center">
            <MessageCircle className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-semibold">{totals.comments.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Comentários</p>
          </div>
          <div className="p-3 border rounded-lg text-center">
            <Share2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-semibold">{totals.shares.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Compartilhamentos</p>
          </div>
        </div>
      )}

      {analyticsLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : analytics.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum dado de analytics</p>
          <p className="text-xs mt-1">Sincronize vídeos primeiro, depois clique em "Sincronizar" aqui</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Vídeo</th>
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-right font-medium">Views</th>
                <th className="px-3 py-2 text-right font-medium">Curtidas</th>
                <th className="px-3 py-2 text-right font-medium">Coment.</th>
                <th className="px-3 py-2 text-right font-medium">Shares</th>
              </tr>
            </thead>
            <tbody>
              {analytics.map((a: any) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs truncate max-w-[120px]">
                    {a.tiktok_video_id?.substring(0, 12)}...
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {format(new Date(a.date), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                  <td className="px-3 py-2 text-right">{(a.views || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{(a.likes || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{(a.comments || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{(a.shares || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
