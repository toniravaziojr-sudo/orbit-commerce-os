import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PlatformIntegrationsDashboard } from "@/components/integrations/PlatformIntegrationsDashboard";
import { SystemEmailSettings } from "@/components/integrations/SystemEmailSettings";
import { WhatsAppPlatformSettings } from "@/components/integrations/WhatsAppPlatformSettings";
import { FiscalPlatformSettings } from "@/components/integrations/FiscalPlatformSettings";
import { DomainsPlatformSettings } from "@/components/integrations/DomainsPlatformSettings";
import { LogisticsPlatformSettings } from "@/components/integrations/LogisticsPlatformSettings";
import { AIPlatformSettings } from "@/components/integrations/AIPlatformSettings";
import { SmokeTestDialog } from "@/components/integrations/SmokeTestDialog";
import { Shield, MessageCircle, Mail, FileText, Globe, Truck, Bot, LayoutGrid, Send } from "lucide-react";
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
 * - Email: SendGrid system configuration
 * - WhatsApp: Z-API manager account configuration
 * - Fiscal: Focus NFe token configuration
 * - Domínios: Cloudflare for SaaS configuration
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
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Fiscal</span>
          </TabsTrigger>
          <TabsTrigger value="domains" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Domínios</span>
          </TabsTrigger>
          <TabsTrigger value="logistics" className="gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Logística</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">IA</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PlatformIntegrationsDashboard onNavigateToTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="email">
          <SystemEmailSettings />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppPlatformSettings />
        </TabsContent>

        <TabsContent value="fiscal">
          <FiscalPlatformSettings />
        </TabsContent>

        <TabsContent value="domains">
          <DomainsPlatformSettings />
        </TabsContent>

        <TabsContent value="logistics">
          <LogisticsPlatformSettings />
        </TabsContent>

        <TabsContent value="ai">
          <AIPlatformSettings />
        </TabsContent>
      </Tabs>

      <SmokeTestDialog open={smokeTestOpen} onOpenChange={setSmokeTestOpen} />
    </div>
  );
}
