import { 
  Plug, 
  CreditCard, 
  Truck, 
  Globe
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentGatewaySettings } from "@/components/payments/PaymentGatewaySettings";
import { ShippingCarrierSettings } from "@/components/shipping/ShippingCarrierSettings";
import { EmailProviderSettings } from "@/components/integrations/EmailProviderSettings";
import { WhatsAppSettings } from "@/components/integrations/WhatsAppSettings";
import { WhatsAppOperatorSettings } from "@/components/integrations/WhatsAppOperatorSettings";
import { usePaymentProviders } from "@/hooks/usePaymentProviders";
import { useShippingProviders } from "@/hooks/useShippingProviders";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";

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
  const { providers: shippingProviders, isLoading: loadingShipping } = useShippingProviders();
  const { isPlatformOperator } = usePlatformOperator();

  const activePaymentGateways = paymentProviders.filter(p => p.is_enabled).length;
  const activeShippingCarriers = shippingProviders.filter(p => p.is_enabled).length;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Integrações"
        description="Configure pagamentos, frete e serviços externos"
      />

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
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

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Truck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transportadoras</p>
                <p className="text-2xl font-bold">
                  {loadingShipping ? '...' : activeShippingCarriers}
                  <span className="text-sm font-normal text-muted-foreground ml-1">ativos</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Globe className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outros</p>
                <p className="text-2xl font-bold">
                  0
                  <span className="text-sm font-normal text-muted-foreground ml-1">em breve</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="shipping" className="gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Frete</span>
          </TabsTrigger>
          <TabsTrigger value="others" className="gap-2">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">Outros</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <PaymentGatewaySettings />
        </TabsContent>

        <TabsContent value="shipping">
          <ShippingCarrierSettings />
        </TabsContent>

        <TabsContent value="others" className="space-y-6">
          {/* WhatsApp Operator Settings - only visible to platform admin */}
          {isPlatformOperator && <WhatsAppOperatorSettings />}

          {/* Email Provider Settings */}
          <EmailProviderSettings />

          {/* WhatsApp Settings - for tenants */}
          <WhatsAppSettings />

          {/* Future Integrations */}
          <Card>
            <CardHeader>
              <CardTitle>Outras Integrações</CardTitle>
              <CardDescription>
                Em breve você poderá conectar mais serviços
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
      </Tabs>
    </div>
  );
}
