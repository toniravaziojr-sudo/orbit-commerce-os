import { useState } from "react";
import {
  Plug,
  CreditCard,
  Share2,
  Boxes,
  MessageSquare,
  TrendingUp,
  Truck,
  FileText,
  Shield,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PaymentGatewaySettings } from "@/components/payments/PaymentGatewaySettings";
import { WhatsAppProviderTabs } from "@/components/integrations/WhatsAppProviderTabs";
import { LateConnectionSettings } from "@/components/integrations/LateConnectionSettings";
import { usePaymentProviders } from "@/hooks/usePaymentProviders";
import { useLateConnection } from "@/hooks/useLateConnection";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { PlatformAdminGate } from "@/components/auth/PlatformAdminGate";
import { PlatformIntegrationsDashboard } from "@/components/integrations/PlatformIntegrationsDashboard";
import { EmailAndDomainsPlatformSettings } from "@/components/integrations/EmailAndDomainsPlatformSettings";
import { WhatsAppPlatformSettings } from "@/components/integrations/WhatsAppPlatformSettings";
import { FiscalPlatformSettings } from "@/components/integrations/FiscalPlatformSettings";
import { LogisticsPlatformSettings } from "@/components/integrations/LogisticsPlatformSettings";
import { AIPlatformSettings } from "@/components/integrations/AIPlatformSettings";
import { Link } from "react-router-dom";

// Future integrations
const FUTURE_INTEGRATIONS = [
  {
    id: "erp",
    name: "ERP / Bling",
    category: "ERP",
    description: "Sincronize estoque e pedidos com seu ERP",
    status: "coming_soon",
    icon: "📊",
  },
];

export default function Integrations() {
  const { providers: paymentProviders, isLoading: loadingPayments } = usePaymentProviders();
  const { isConnected: lateConnected } = useLateConnection();
  const { isPlatformOperator } = usePlatformOperator();
  const [activeTab, setActiveTab] = useState("payments");

  const activePaymentGateways = paymentProviders.filter(p => p.is_enabled).length;
  const socialAccountsCount = lateConnected ? 1 : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Integrações"
        description="Hub central de integrações e serviços externos"
      />

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="text-sm text-muted-foreground">Redes Sociais</p>
                <p className="text-2xl font-bold">
                  {socialAccountsCount}
                  <span className="text-sm font-normal text-muted-foreground ml-1">{lateConnected ? "conectado" : "pendente"}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("communication")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comunicação</p>
                <p className="text-2xl font-bold">
                  0
                  <span className="text-sm font-normal text-muted-foreground ml-1">ativos</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab("erp")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Boxes className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ERP</p>
                <p className="text-2xl font-bold">
                  0
                  <span className="text-sm font-normal text-muted-foreground ml-1">em breve</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/marketplaces">
            <Boxes className="h-4 w-4 mr-2" />
            Marketplaces
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/marketing">
            <TrendingUp className="h-4 w-4 mr-2" />
            Marketing / Analytics
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/shipping">
            <Truck className="h-4 w-4 mr-2" />
            Frete / Transportadoras
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/fiscal">
            <FileText className="h-4 w-4 mr-2" />
            Fiscal / NFe
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Redes Sociais</span>
          </TabsTrigger>
          <TabsTrigger value="communication" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Comunicação</span>
          </TabsTrigger>
          <TabsTrigger value="erp" className="gap-2">
            <Boxes className="h-4 w-4" />
            <span className="hidden sm:inline">ERP</span>
          </TabsTrigger>
          {/* Platform Admin Tab */}
          {isPlatformOperator && (
            <TabsTrigger value="platform" className="gap-2 border-l ml-2 pl-4">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Plataforma</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="payments">
          <PaymentGatewaySettings />
        </TabsContent>

        <TabsContent value="social" className="space-y-6">
          <LateConnectionSettings />
        </TabsContent>

        <TabsContent value="communication" className="space-y-6">
          <WhatsAppProviderTabs />
        </TabsContent>

        <TabsContent value="erp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integrações ERP</CardTitle>
              <CardDescription>
                Em breve você poderá conectar seu ERP
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FUTURE_INTEGRATIONS.map((integration) => (
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
                    <Button variant="outline" size="sm" disabled>
                      Configurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Platform Admin Tab Content */}
        {isPlatformOperator && (
          <TabsContent value="platform" className="space-y-6">
            <PlatformAdminGate>
              <Alert className="border-primary/30 bg-primary/5">
                <Shield className="h-4 w-4 text-primary" />
                <AlertDescription>
                  <strong>Área do Operador:</strong> Configurações globais de integração da plataforma.
                </AlertDescription>
              </Alert>

              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="flex flex-wrap gap-1 h-auto p-1">
                  <TabsTrigger value="overview">Resumo</TabsTrigger>
                  <TabsTrigger value="email">Email</TabsTrigger>
                  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                  <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                  <TabsTrigger value="logistics">Logística</TabsTrigger>
                  <TabsTrigger value="ai">IA</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <PlatformIntegrationsDashboard onNavigateToTab={() => {}} />
                </TabsContent>

                <TabsContent value="email">
                  <EmailAndDomainsPlatformSettings />
                </TabsContent>

                <TabsContent value="whatsapp">
                  <WhatsAppPlatformSettings />
                </TabsContent>

                <TabsContent value="fiscal">
                  <FiscalPlatformSettings />
                </TabsContent>

                <TabsContent value="logistics">
                  <LogisticsPlatformSettings />
                </TabsContent>

                <TabsContent value="ai">
                  <AIPlatformSettings />
                </TabsContent>
              </Tabs>
            </PlatformAdminGate>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
