import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PlatformIntegrationsDashboard } from "@/components/integrations/PlatformIntegrationsDashboard";
import { EmailAndDomainsPlatformSettings } from "@/components/integrations/EmailAndDomainsPlatformSettings";
import { WhatsAppPlatformSettings } from "@/components/integrations/WhatsAppPlatformSettings";
import { FiscalPlatformSettings } from "@/components/integrations/FiscalPlatformSettings";
import { LogisticsPlatformSettings } from "@/components/integrations/LogisticsPlatformSettings";
import { AIPlatformSettings } from "@/components/integrations/AIPlatformSettings";
import { MeliPlatformSettings } from "@/components/integrations/MeliPlatformSettings";
import { ShopeePlatformSettings } from "@/components/integrations/ShopeePlatformSettings";
import { SmokeTestDialog } from "@/components/integrations/SmokeTestDialog";
import { MetaPlatformSettings } from "@/components/integrations/platform/MetaPlatformSettings";
import { GooglePlatformSettings } from "@/components/integrations/platform/GooglePlatformSettings";
import { TikTokPlatformSettings } from "@/components/integrations/platform/TikTokPlatformSettings";
import { Shield, MessageCircle, Mail, FileText, Truck, Bot, LayoutGrid, Send, ShoppingBag, Store, CreditCard, Globe, Music2 } from "lucide-react";
import { MercadoPagoPlatformSettings } from "@/components/integrations/platform/MercadoPagoPlatformSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { Navigate } from "react-router-dom";

/**
 * Platform Admin page for managing operator-level integrations.
 * Only accessible by platform operators.
 * 
 * Contains tabs for each integration:
 * - Resumo: Dashboard with status cards for all integrations
 * - Email e Domínios: SendGrid + Cloudflare unified settings
 * - WhatsApp: Z-API manager account configuration
 * - Fiscal: Focus NFe token configuration
 * - Logística: Loggi OAuth configuration
 * - IA: Firecrawl and Lovable AI configuration
 */
export default function PlatformIntegrations() {
  const { isPlatformOperator, isLoading } = usePlatformOperator();
  const [activeTab, setActiveTab] = useState("overview");
  const [smokeTestOpen, setSmokeTestOpen] = useState(false);

  // Block access for non-platform operators
  if (!isLoading && !isPlatformOperator) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Integrações da Plataforma"
          description="Gerencie as credenciais globais e integrações da plataforma"
        />
        <Button variant="outline" onClick={() => setSmokeTestOpen(true)}>
          <Send className="h-4 w-4 mr-2" />
          Testar Pipeline
        </Button>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Shield className="h-4 w-4 text-primary" />
        <AlertDescription>
          <strong>Área do Operador:</strong> Aqui você gerencia as credenciais globais que você configurou como integrador 
          para fornecer serviços a todos os tenants.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="emaildomains" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email e Domínios</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Fiscal</span>
          </TabsTrigger>
          <TabsTrigger value="logistics" className="gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Logística</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">IA</span>
          </TabsTrigger>
          <TabsTrigger value="meta" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Meta</span>
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Google</span>
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2">
            <Music2 className="h-4 w-4" />
            <span className="hidden sm:inline">TikTok</span>
          </TabsTrigger>
          <TabsTrigger value="mercadolivre" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Mercado Livre</span>
          </TabsTrigger>
          <TabsTrigger value="mercadopago" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">MP Billing</span>
          </TabsTrigger>
          <TabsTrigger value="shopee" className="gap-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Shopee</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PlatformIntegrationsDashboard onNavigateToTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="emaildomains">
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

        <TabsContent value="meta">
          <MetaPlatformSettings />
        </TabsContent>

        <TabsContent value="google">
          <GooglePlatformSettings />
        </TabsContent>

        <TabsContent value="tiktok">
          <TikTokPlatformSettings />
        </TabsContent>


        <TabsContent value="mercadolivre">
          <MeliPlatformSettings />
        </TabsContent>

        <TabsContent value="mercadopago">
          <MercadoPagoPlatformSettings />
        </TabsContent>

        <TabsContent value="shopee">
          <ShopeePlatformSettings />
        </TabsContent>
      </Tabs>

      <SmokeTestDialog open={smokeTestOpen} onOpenChange={setSmokeTestOpen} />
    </div>
  );
}
