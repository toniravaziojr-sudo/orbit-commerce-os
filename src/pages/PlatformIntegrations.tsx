import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WhatsAppOperatorSettings } from "@/components/integrations/WhatsAppOperatorSettings";
import { SystemEmailSettings } from "@/components/integrations/SystemEmailSettings";
import { Shield, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Platform Admin page for managing operator-level integrations.
 * Only accessible by platform operators (respeiteohomem@gmail.com).
 * 
 * This is separate from tenant-level integrations to avoid confusion.
 */
export default function PlatformIntegrations() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Integrações da Plataforma"
        description="Gerencie as integrações e credenciais de todos os tenants"
      />

      <Alert className="border-primary/30 bg-primary/5">
        <Settings className="h-4 w-4 text-primary" />
        <AlertDescription>
          <strong>Área do Operador:</strong> Aqui você configura as credenciais que serão usadas 
          pelos tenants. Essas configurações não são visíveis para os clientes finais.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* WhatsApp Operator Settings */}
        <WhatsAppOperatorSettings />

        {/* System Email Settings - if applicable */}
        <SystemEmailSettings />
      </div>
    </div>
  );
}
