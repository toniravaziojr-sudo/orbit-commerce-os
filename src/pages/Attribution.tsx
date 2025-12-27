// =============================================
// ATTRIBUTION PAGE
// Shows conversion sources and attribution stats
// =============================================

import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAttributionStats } from '@/hooks/useOrderAttribution';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { 
  BarChart3, 
  TrendingUp, 
  Info, 
  ExternalLink,
  Globe,
  Facebook,
  Youtube,
  Search,
  Mail,
  MousePointerClick,
  CircleDollarSign,
  ShoppingCart,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Icons for attribution sources
const SOURCE_ICONS: Record<string, React.ReactNode> = {
  google_ads: <span className="text-blue-500">G</span>,
  google: <Search className="h-4 w-4 text-blue-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-600" />,
  instagram: <span className="text-pink-500">📷</span>,
  tiktok: <span>🎵</span>,
  youtube: <Youtube className="h-4 w-4 text-red-500" />,
  twitter: <span>𝕏</span>,
  linkedin: <span className="text-blue-700">in</span>,
  email: <Mail className="h-4 w-4 text-gray-600" />,
  whatsapp: <span className="text-green-500">💬</span>,
  direct: <MousePointerClick className="h-4 w-4 text-gray-400" />,
  bing: <Search className="h-4 w-4 text-teal-500" />,
  bing_ads: <span className="text-teal-500">B</span>,
};

// Labels for sources
const SOURCE_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  google: 'Google Orgânico',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  direct: 'Acesso Direto',
  bing: 'Bing Orgânico',
  bing_ads: 'Bing Ads',
  unknown: 'Desconhecido',
};

// Medium labels
const MEDIUM_LABELS: Record<string, string> = {
  cpc: 'Pago (CPC)',
  organic: 'Orgânico',
  social: 'Social',
  referral: 'Referência',
  email: 'E-mail',
  none: 'Direto',
  unknown: 'Desconhecido',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function AttributionStatsTable() {
  const dateFrom = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const { data: stats, isLoading } = useAttributionStats(dateFrom);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!stats?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma conversão registrada nos últimos 30 dias.</p>
        <p className="text-sm mt-2">
          As conversões serão rastreadas automaticamente quando clientes fizerem compras.
        </p>
      </div>
    );
  }
  
  const totalRevenue = stats.reduce((sum, s) => sum + s.total_revenue, 0);
  const totalOrders = stats.reduce((sum, s) => sum + s.orders_count, 0);
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CircleDollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(totalOrders > 0 ? totalRevenue / totalOrders : 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fontes de Conversão</CardTitle>
          <CardDescription>Últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Fonte</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Meio</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Pedidos</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Receita</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Ticket Médio</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">% Receita</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat, index) => (
                  <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {SOURCE_ICONS[stat.source] || <Globe className="h-4 w-4" />}
                        <span>{SOURCE_LABELS[stat.source] || stat.source}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant="outline" className="font-normal">
                        {MEDIUM_LABELS[stat.medium] || stat.medium}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right font-medium">{stat.orders_count}</td>
                    <td className="py-3 px-2 text-right font-medium">{formatCurrency(stat.total_revenue)}</td>
                    <td className="py-3 px-2 text-right">{formatCurrency(stat.avg_order_value)}</td>
                    <td className="py-3 px-2 text-right">
                      <Badge variant={stat.total_revenue / totalRevenue > 0.2 ? 'default' : 'secondary'}>
                        {((stat.total_revenue / totalRevenue) * 100).toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SetupInstructions() {
  const [copied, setCopied] = useState<string | null>(null);
  
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copiado!');
    setTimeout(() => setCopied(null), 2000);
  };
  
  const utmExample = 'https://sualoja.com.br?utm_source=facebook&utm_medium=cpc&utm_campaign=black_friday';
  
  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Rastreamento Automático Ativo</AlertTitle>
        <AlertDescription>
          O sistema já está capturando automaticamente a origem de cada visitante que chega à sua loja.
          Porém, para obter dados mais precisos, siga as instruções abaixo ao criar suas campanhas.
        </AlertDescription>
      </Alert>
      
      {/* UTM Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Parâmetros UTM
          </CardTitle>
          <CardDescription>
            Adicione parâmetros UTM aos links das suas campanhas para rastreamento preciso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Parâmetro</th>
                  <th className="text-left py-2 font-medium">Descrição</th>
                  <th className="text-left py-2 font-medium">Exemplo</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2"><code className="bg-muted px-1 rounded">utm_source</code></td>
                  <td className="py-2">Origem do tráfego</td>
                  <td className="py-2">facebook, google, instagram, tiktok</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2"><code className="bg-muted px-1 rounded">utm_medium</code></td>
                  <td className="py-2">Meio/tipo de tráfego</td>
                  <td className="py-2">cpc, organic, social, email</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2"><code className="bg-muted px-1 rounded">utm_campaign</code></td>
                  <td className="py-2">Nome da campanha</td>
                  <td className="py-2">black_friday_2024, lancamento_verao</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2"><code className="bg-muted px-1 rounded">utm_content</code></td>
                  <td className="py-2">Variação do anúncio</td>
                  <td className="py-2">banner_azul, video_produto</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="bg-muted px-1 rounded">utm_term</code></td>
                  <td className="py-2">Palavra-chave (Google Ads)</td>
                  <td className="py-2">comprar_tenis, oferta_sapatos</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Exemplo de URL com UTM:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background p-2 rounded flex-1 overflow-x-auto">
                {utmExample}
              </code>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => copyToClipboard(utmExample, 'utm')}
              >
                {copied === 'utm' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Platform Specific Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Ads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-blue-500 font-bold">G</span>
              Google Ads
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-muted-foreground">
              O <code className="bg-muted px-1 rounded">gclid</code> é capturado automaticamente. Para dados mais ricos:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Ative o rastreamento de conversões no Google Ads</li>
              <li>Use o modelo de URL com parâmetros UTM</li>
              <li>Configure a tag de conversão na página de obrigado</li>
            </ol>
            <Button variant="link" className="h-auto p-0" asChild>
              <a href="https://support.google.com/google-ads/answer/6095821" target="_blank" rel="noopener noreferrer">
                Ver documentação <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </CardContent>
        </Card>
        
        {/* Meta (Facebook/Instagram) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Facebook className="h-5 w-5 text-blue-600" />
              Meta (Facebook/Instagram)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-muted-foreground">
              O <code className="bg-muted px-1 rounded">fbclid</code> é capturado automaticamente. Para melhorar:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Configure o Pixel do Facebook (já feito ✓)</li>
              <li>Ative a API de Conversões (já feito ✓)</li>
              <li>Adicione UTMs aos links dos anúncios</li>
            </ol>
            <Button variant="link" className="h-auto p-0" asChild>
              <a href="https://www.facebook.com/business/help/1016122818401732" target="_blank" rel="noopener noreferrer">
                Ver documentação <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </CardContent>
        </Card>
        
        {/* TikTok */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span>🎵</span>
              TikTok Ads
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-muted-foreground">
              O <code className="bg-muted px-1 rounded">ttclid</code> é capturado automaticamente. Recomendações:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Configure o Pixel do TikTok (já feito ✓)</li>
              <li>Ative a Events API para server-side</li>
              <li>Use UTM: <code className="bg-muted px-1 rounded">utm_source=tiktok</code></li>
            </ol>
            <Button variant="link" className="h-auto p-0" asChild>
              <a href="https://ads.tiktok.com/help/article/tiktok-pixel" target="_blank" rel="noopener noreferrer">
                Ver documentação <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </CardContent>
        </Card>
        
        {/* Google Orgânico */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-500" />
              Google Orgânico (SEO)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-muted-foreground">
              O tráfego orgânico do Google é detectado automaticamente pelo referrer.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Configure o Google Search Console</li>
              <li>Vincule ao Google Analytics</li>
              <li>Otimize suas páginas para SEO</li>
            </ol>
            <Button variant="link" className="h-auto p-0" asChild>
              <a href="https://search.google.com/search-console/about" target="_blank" rel="noopener noreferrer">
                Acessar Search Console <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Boas Práticas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                <strong>Sempre use UTMs em campanhas pagas</strong> - Isso garante rastreamento preciso mesmo quando o navegador bloqueia cookies.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                <strong>Padronize os nomes das campanhas</strong> - Use snake_case (ex: black_friday_2024) para facilitar a análise.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                <strong>Teste os links antes de publicar</strong> - Clique nos links das campanhas e verifique se os parâmetros aparecem na URL.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                <strong>Atenção com encurtadores</strong> - Alguns encurtadores de URL removem os parâmetros UTM. Use apenas os oficiais das plataformas.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Attribution() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 scrollbar-thin">
          <div className="mx-auto max-w-[1600px]">
            <PageHeader
              title="Atribuição de Conversões"
              description="Veja de onde vêm suas vendas e configure o rastreamento"
            />
            
            <div className="mt-6">
              <Tabs defaultValue="stats">
                <TabsList className="mb-6">
                  <TabsTrigger value="stats" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Estatísticas
                  </TabsTrigger>
                  <TabsTrigger value="setup" className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Configuração
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="stats">
                  <AttributionStatsTable />
                </TabsContent>
                
                <TabsContent value="setup">
                  <SetupInstructions />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
