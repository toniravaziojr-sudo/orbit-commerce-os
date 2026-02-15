import { useState } from "react";
import {
  CreditCard,
  Share2,
  Boxes,
  Globe,
  MoreHorizontal,
  Youtube,
  Music2,
} from "lucide-react";
// Google icon inline SVG used in tab
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentGatewaySettings } from "@/components/payments/PaymentGatewaySettings";
import { MetaUnifiedSettings } from "@/components/integrations/MetaUnifiedSettings";
import { YouTubeSettings } from "@/components/integrations/YouTubeSettings";
import { MarketplacesIntegrationTab } from "@/components/integrations/MarketplacesIntegrationTab";
import { DomainAndEmailSettings } from "@/components/integrations/DomainAndEmailSettings";
import { TikTokUnifiedSettings } from "@/components/integrations/TikTokUnifiedSettings";
import { GoogleUnifiedSettings } from "@/components/integrations/GoogleUnifiedSettings";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import { usePaymentProviders } from "@/hooks/usePaymentProviders";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { useMeliConnection } from "@/hooks/useMeliConnection";
import { useYouTubeConnection } from "@/hooks/useYouTubeConnection";
import { useTikTokAdsConnection } from "@/hooks/useTikTokAdsConnection";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useAdminModeSafe } from "@/contexts/AdminModeContext";
import { StatusBadge } from "@/components/ui/status-badge";

// Future ERP integrations
const ERP_INTEGRATIONS = [
  {
    id: "bling",
    name: "Bling ERP",
    description: "Sincronize estoque, pedidos e notas fiscais",
    status: "coming_soon",
    icon: "📊",
  },
];

export default function Integrations() {
  const { providers: paymentProviders, isLoading: loadingPayments } = usePaymentProviders();
  const { isConnected: metaConnected } = useMetaConnection();
  const { isConnected: meliConnected } = useMeliConnection();
  const { isConnected: youtubeConnected } = useYouTubeConnection();
  const { isConnected: googleConnected } = useGoogleConnection();
  const { connectionStatus: tiktokStatus } = useTikTokAdsConnection();
  const { isPlatformOperator } = usePlatformOperator();
  const { isStoreMode } = useAdminModeSafe();
  const [activeTab, setActiveTab] = useState("payments");

  // YouTube standalone tab only visible for platform operators (legacy; will be inside Google Hub)
  const showYouTube = isPlatformOperator && isStoreMode;
  
  const activePaymentGateways = paymentProviders.filter(p => p.is_enabled).length;
  const socialAccountsCount = (metaConnected ? 1 : 0) + (showYouTube && youtubeConnected ? 1 : 0);
  const googleCount = googleConnected ? 1 : 0;
  const marketplacesCount = meliConnected ? 1 : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Integrações"
        description="Hub central de integrações e serviços externos"
      />

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("payments")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagamentos</p>
                <p className="text-2xl font-bold">
                  {loadingPayments ? '...' : activePaymentGateways}
                  <span className="text-sm font-normal text-muted-foreground ml-1">ativos</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("social")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Share2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meta</p>
                <p className="text-2xl font-bold">
                  {socialAccountsCount}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    {socialAccountsCount === 1 ? "conectado" : socialAccountsCount > 0 ? "conectados" : "pendente"}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("marketplaces")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Boxes className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marketplaces</p>
                <p className="text-2xl font-bold">
                  {marketplacesCount}
                  <span className="text-sm font-normal text-muted-foreground ml-1">{meliConnected ? "conectado" : "pendente"}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Meta</span>
          </TabsTrigger>
          {showYouTube && (
            <TabsTrigger value="youtube" className="gap-2">
              <Youtube className="h-4 w-4" />
              <span className="hidden sm:inline">YouTube</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="google" className="gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="hidden sm:inline">Google</span>
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2">
            <Music2 className="h-4 w-4" />
            <span className="hidden sm:inline">TikTok</span>
          </TabsTrigger>
          <TabsTrigger value="marketplaces" className="gap-2">
            <Boxes className="h-4 w-4" />
            <span className="hidden sm:inline">Marketplaces</span>
          </TabsTrigger>
          <TabsTrigger value="domain-email" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Domínio/Email</span>
          </TabsTrigger>
          <TabsTrigger value="outros" className="gap-2">
            <MoreHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Outros</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <PaymentGatewaySettings />
        </TabsContent>

        <TabsContent value="social" className="space-y-6">
          <MetaUnifiedSettings />
        </TabsContent>

        {showYouTube && (
          <TabsContent value="youtube" className="space-y-6">
            <YouTubeSettings />
          </TabsContent>
        )}

        <TabsContent value="google" className="space-y-6">
          <GoogleUnifiedSettings />
        </TabsContent>

        <TabsContent value="tiktok" className="space-y-6">
          <TikTokUnifiedSettings />
        </TabsContent>

        <TabsContent value="marketplaces" className="space-y-6">
          <MarketplacesIntegrationTab />
        </TabsContent>

        <TabsContent value="domain-email" className="space-y-6">
          <DomainAndEmailSettings />
        </TabsContent>

        <TabsContent value="outros" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integrações ERP</CardTitle>
              <CardDescription>
                Em breve você poderá conectar seu ERP
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ERP_INTEGRATIONS.map((integration) => (
              <Card
                key={integration.id}
                className="transition-all opacity-70"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                      {integration.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">
                          {integration.name}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <StatusBadge variant="default">Em breve</StatusBadge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
