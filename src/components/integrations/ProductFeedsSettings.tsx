// =============================================
// PRODUCT FEEDS SETTINGS
// UI for displaying catalog feed URLs for Google Merchant and Meta Catalog
// =============================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Copy, 
  ExternalLink, 
  Rss,
  ShoppingBag,
  Facebook,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function ProductFeedsSettings() {
  const { currentTenant } = useAuth();

  const getFeedUrl = (format: 'google' | 'meta') => {
    if (!currentTenant?.slug) return '';
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-feed`;
    return `${baseUrl}?tenant=${currentTenant.slug}&format=${format}`;
  };

  const copyFeedUrl = (format: 'google' | 'meta') => {
    const url = getFeedUrl(format);
    navigator.clipboard.writeText(url);
    toast.success('URL copiada para a área de transferência!');
  };

  const openFeedUrl = (format: 'google' | 'meta') => {
    const url = getFeedUrl(format);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Rss className="h-4 w-4" />
        <AlertDescription>
          Os feeds de produtos são atualizados automaticamente sempre que você adiciona, edita ou remove produtos. 
          Use essas URLs nas plataformas de anúncios para sincronizar seu catálogo.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Google Merchant Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-blue-600" />
              Google Merchant Center
            </CardTitle>
            <CardDescription>
              Feed XML para exibir produtos no Google Shopping
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Feed (XML)</Label>
              <div className="flex gap-2">
                <Input 
                  value={getFeedUrl('google')} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={() => copyFeedUrl('google')} title="Copiar URL">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => openFeedUrl('google')} title="Visualizar feed">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                Como configurar:
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Acesse o <a href="https://merchants.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Merchant Center</a></li>
                <li>Vá em Produtos → Feeds</li>
                <li>Adicione um novo feed e escolha "Buscar programado"</li>
                <li>Cole a URL acima</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Meta Catalog Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Facebook className="h-5 w-5 text-blue-600" />
              Meta Catalog
            </CardTitle>
            <CardDescription>
              Feed CSV para anúncios dinâmicos no Facebook e Instagram
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Feed (CSV)</Label>
              <div className="flex gap-2">
                <Input 
                  value={getFeedUrl('meta')} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={() => copyFeedUrl('meta')} title="Copiar URL">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => openFeedUrl('meta')} title="Visualizar feed">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                Como configurar:
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Acesse o <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Gerenciador de Comércio</a></li>
                <li>Vá em Catálogo → Origens de Dados</li>
                <li>Adicione nova origem via "Feed programado"</li>
                <li>Cole a URL acima</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Informações do Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">Automático</div>
              <div className="text-sm text-muted-foreground">Atualização em tempo real</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">Apenas ativos</div>
              <div className="text-sm text-muted-foreground">Produtos ativos no feed</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">URLs canônicas</div>
              <div className="text-sm text-muted-foreground">Links para domínio personalizado</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
