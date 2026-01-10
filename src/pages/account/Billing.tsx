import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, FileText, TrendingUp, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";

export default function Billing() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();

  // Get plan - fallback to free if not set
  const tenantPlan = "free"; // Will be connected to actual billing system later

  // Placeholder data - will be connected to billing system
  const currentPlan = {
    name: tenantPlan,
    label: "Gratuito",
    price: "R$ 0/mês",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Planos e Faturamento"
          description="Gerencie seu plano e formas de pagamento"
        />
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Plano Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{currentPlan.label}</h3>
                  <Badge variant="secondary">{currentPlan.price}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Seu plano renova automaticamente
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/settings/billing")}>
                Alterar Plano
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Formas de Pagamento
          </CardTitle>
          <CardDescription>
            Gerencie suas formas de pagamento para cobrança
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma forma de pagamento</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Adicione um cartão de crédito ou configure outra forma de pagamento.
            </p>
            <Button>
              <CreditCard className="h-4 w-4 mr-2" />
              Adicionar Cartão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Faturamento
          </CardTitle>
          <CardDescription>
            Visualize suas faturas anteriores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma fatura</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Seu histórico de faturas aparecerá aqui.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
