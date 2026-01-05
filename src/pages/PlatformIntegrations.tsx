import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WhatsAppOperatorSettings } from "@/components/integrations/WhatsAppOperatorSettings";
import { SystemEmailSettings } from "@/components/integrations/SystemEmailSettings";
import { PlatformSecretsStatus } from "@/components/integrations/PlatformSecretsStatus";
import { SmokeTestDialog } from "@/components/integrations/SmokeTestDialog";
import { Shield, MessageCircle, Mail, AlertTriangle, Send, Key } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { Navigate } from "react-router-dom";

/**
 * Platform Admin page for managing operator-level integrations.
 * Only accessible by platform operators (respeiteohomem@gmail.com).
 * 
 * Contains:
 * - Credenciais: Global platform secrets status (Focus NFe, SendGrid, Cloudflare, Loggi, Firecrawl, Lovable AI)
 * - WhatsApp: Z-API credentials per tenant (operator manages, tenant connects)
 * - Email: SendGrid system configuration
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

      <Tabs defaultValue="credenciais" className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="credenciais" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Credenciais Globais</span>
            <span className="sm:hidden">Credenciais</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credenciais" className="space-y-4">
          <PlatformSecretsStatus />
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
      </Tabs>

      <SmokeTestDialog open={smokeTestOpen} onOpenChange={setSmokeTestOpen} />
    </div>
  );
}
