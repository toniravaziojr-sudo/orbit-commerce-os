import { Plug, CheckCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const INTEGRATIONS = [
  {
    id: "pagarme",
    name: "Pagar.me",
    category: "Pagamentos",
    description: "Processe pagamentos com cartão, boleto e PIX",
    status: "disconnected",
    icon: "💳",
  },
  {
    id: "mercadopago",
    name: "Mercado Pago",
    category: "Pagamentos",
    description: "Receba pagamentos via Mercado Pago",
    status: "disconnected",
    icon: "💰",
  },
  {
    id: "correios",
    name: "Correios",
    category: "Logística",
    description: "Calcule fretes e rastreie envios",
    status: "disconnected",
    icon: "📦",
  },
  {
    id: "loggi",
    name: "Loggi",
    category: "Logística",
    description: "Entregas rápidas em grandes cidades",
    status: "disconnected",
    icon: "🚚",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: "Comunicação",
    description: "Envie notificações automáticas via WhatsApp",
    status: "disconnected",
    icon: "💬",
  },
  {
    id: "email",
    name: "Email (SMTP)",
    category: "Comunicação",
    description: "Configure envio de emails transacionais",
    status: "disconnected",
    icon: "📧",
  },
];

const groupedIntegrations = INTEGRATIONS.reduce((acc, integration) => {
  if (!acc[integration.category]) {
    acc[integration.category] = [];
  }
  acc[integration.category].push(integration);
  return acc;
}, {} as Record<string, typeof INTEGRATIONS>);

export default function Integrations() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Integrações"
        description="Conecte serviços externos de pagamento, logística e comunicação"
        actions={
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Verificar Conexões
          </Button>
        }
      />

      {/* Integration Categories */}
      {Object.entries(groupedIntegrations).map(([category, integrations]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{category}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <Card
                key={integration.id}
                className="transition-all hover:shadow-md"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
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
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <StatusBadge
                      variant={
                        integration.status === "connected"
                          ? "success"
                          : "default"
                      }
                      dot
                    >
                      {integration.status === "connected"
                        ? "Conectado"
                        : "Desconectado"}
                    </StatusBadge>
                    <Button variant="outline" size="sm">
                      Configurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Health Monitor Card */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">
                Monitor de Saúde
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Verifique o status de todas as integrações em tempo real. Alertas
                automáticos quando houver falhas de conexão.
              </p>
            </div>
            <Button variant="outline">Ver Dashboard</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
