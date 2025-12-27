import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WhatsAppOperatorSettings } from "@/components/integrations/WhatsAppOperatorSettings";
import { SystemEmailSettings } from "@/components/integrations/SystemEmailSettings";
import { IntegrationReadinessPanel } from "@/components/integrations/IntegrationReadinessPanel";
import { SmokeTestDialog } from "@/components/integrations/SmokeTestDialog";
import { Shield, MessageCircle, Mail, AlertTriangle, Send, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { Navigate } from "react-router-dom";

/**
 * Platform Admin page for managing operator-level integrations.
 * Only accessible by platform operators (respeiteohomem@gmail.com).
 * 
 * This is separate from tenant-level integrations to avoid confusion.
 * 
 * Contains:
 * - WhatsApp Operator Settings (Z-API credentials per tenant)
 * - System Email Settings (platform-wide email configuration)
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

      {/* Integration Readiness Panel */}
      <IntegrationReadinessPanel />

      <Tabs defaultValue="whatsapp" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp (Z-API)</span>
            <span className="sm:hidden">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email do Sistema</span>
            <span className="sm:hidden">Email</span>
          </TabsTrigger>
        </TabsList>

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
