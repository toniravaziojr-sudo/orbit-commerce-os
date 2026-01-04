import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WhatsAppOperatorSettings } from "@/components/integrations/WhatsAppOperatorSettings";
import { SystemEmailSettings } from "@/components/integrations/SystemEmailSettings";
import { PlatformIntegrationsSummary } from "@/components/integrations/PlatformIntegrationsSummary";
import { PaymentsPlatformStatus } from "@/components/integrations/PaymentsPlatformStatus";
import { FiscalPlatformStatus } from "@/components/integrations/FiscalPlatformStatus";
import { ShippingPlatformStatus } from "@/components/integrations/ShippingPlatformStatus";
import { MarketingPlatformStatus } from "@/components/integrations/MarketingPlatformStatus";
import { DomainsPlatformStatus } from "@/components/integrations/DomainsPlatformStatus";
import { SmokeTestDialog } from "@/components/integrations/SmokeTestDialog";
import { Shield, MessageCircle, Mail, AlertTriangle, Send, CreditCard, FileText, Truck, BarChart3, Globe, LayoutDashboard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { Navigate } from "react-router-dom";

/**
 * Platform Admin page for managing operator-level integrations.
 * Only accessible by platform operators (respeiteohomem@gmail.com).
 * 
 * Contains all external service integrations:
 * - Summary overview of all integrations
 * - WhatsApp (Z-API credentials per tenant)
 * - Email (SendGrid system configuration)
 * - Payments (Pagar.me, MercadoPago status)
 * - Fiscal (Focus NFe status)
 * - Shipping (Frenet, Correios, Loggi status)
 * - Marketing (Meta, Google, TikTok pixels)
 * - Domains (Custom domains and SSL status)
 */
export default function PlatformIntegrations() {
  const { isPlatformOperator, isLoading } = usePlatformOperator();
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
          description="Gerencie as integrações e credenciais de todos os tenants"
        />
        <Button variant="outline" onClick={() => setSmokeTestOpen(true)}>
          <Send className="h-4 w-4 mr-2" />
          Testar Pipeline
        </Button>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Shield className="h-4 w-4 text-primary" />
        <AlertDescription>
          <strong>Área do Operador:</strong> Aqui você configura credenciais usadas pelos tenants. 
          Essas configurações não são visíveis para os clientes finais.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="resumo" className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="resumo" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Fiscal</span>
          </TabsTrigger>
          <TabsTrigger value="logistica" className="gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Logística</span>
          </TabsTrigger>
          <TabsTrigger value="marketing" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Marketing</span>
          </TabsTrigger>
          <TabsTrigger value="dominios" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Domínios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <PlatformIntegrationsSummary />
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Como funciona:</p>
                  <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                    <li>Crie uma instância na Z-API para cada tenant</li>
                    <li>Copie o Instance ID e Token e salve aqui</li>
                    <li>O tenant poderá conectar escaneando o QR Code na tela dele</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          <WhatsAppOperatorSettings />
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Email do Sistema:</p>
                  <p className="text-muted-foreground">
                    Configure o remetente padrão para emails de autenticação, convites e 
                    comunicações do sistema. Este email é usado quando o tenant não tem 
                    domínio próprio configurado.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <SystemEmailSettings />
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Gateways de Pagamento:</p>
                  <p className="text-muted-foreground">
                    Visualize os gateways configurados por cada tenant. As credenciais são 
                    gerenciadas pelos próprios tenants na tela de Configurações → Pagamentos.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <PaymentsPlatformStatus />
        </TabsContent>

        <TabsContent value="fiscal" className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Integração Fiscal (Focus NFe):</p>
                  <p className="text-muted-foreground">
                    Visualize o status da integração com Focus NFe de cada tenant. 
                    Token e certificado são configurados pelos tenants em Fiscal → Configurações.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <FiscalPlatformStatus />
        </TabsContent>

        <TabsContent value="logistica" className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Transportadoras:</p>
                  <p className="text-muted-foreground">
                    Visualize as transportadoras configuradas por tenant. Suporta Frenet, 
                    Correios, Loggi e outras integrações de frete.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <ShippingPlatformStatus />
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Integrações de Marketing:</p>
                  <p className="text-muted-foreground">
                    Visualize os pixels e analytics configurados por tenant: Meta Pixel, 
                    Google Analytics, Google Ads e TikTok Pixel.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <MarketingPlatformStatus />
        </TabsContent>

        <TabsContent value="dominios" className="space-y-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Domínios Personalizados:</p>
                  <p className="text-muted-foreground">
                    Visualize os domínios custom configurados por tenant e status do SSL. 
                    Integração com Cloudflare for SaaS para gestão automática de certificados.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <DomainsPlatformStatus />
        </TabsContent>
      </Tabs>

      <SmokeTestDialog open={smokeTestOpen} onOpenChange={setSmokeTestOpen} />
    </div>
  );
}
