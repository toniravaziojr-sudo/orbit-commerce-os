import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2 
} from 'lucide-react';
import { 
  usePlans, 
  useTenantSubscription, 
  useTenantMonthlyUsage, 
  useTenantInvoices,
  useOrderLimitCheck,
  formatCurrency,
  formatPercentage,
  Plan
} from '@/hooks/usePlans';
import { useAuth } from '@/hooks/useAuth';
import { PlanCard } from '@/components/billing/PlanCard';
import { PlanCheckoutForm } from '@/components/billing/PlanCheckoutForm';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function BillingSettings() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: subscription, isLoading: subLoading } = useTenantSubscription();
  const { data: monthlyUsage } = useTenantMonthlyUsage();
  const { data: invoices } = useTenantInvoices();
  const { data: limitCheck } = useOrderLimitCheck();

  const currentPlan = plans?.find(p => p.plan_key === subscription?.plan_key);
  const usagePercent = limitCheck?.order_limit 
    ? Math.min((limitCheck.current_count / limitCheck.order_limit) * 100, 100)
    : 0;

  const handleSelectPlan = (planKey: string) => {
    const plan = plans?.find(p => p.plan_key === planKey);
    if (plan) {
      setSelectedPlan(plan);
      setShowCheckout(true);
    }
  };

  const handleCheckoutSuccess = () => {
    setShowCheckout(false);
    setSelectedPlan(null);
  };

  if (plansLoading || subLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Mostrar checkout se um plano foi selecionado
  if (showCheckout && selectedPlan && currentTenant) {
    return (
      <div className="container max-w-3xl py-8">
        <PlanCheckoutForm
          plan={selectedPlan}
          tenantId={currentTenant.id}
          onSuccess={handleCheckoutSuccess}
          onCancel={() => {
            setShowCheckout(false);
            setSelectedPlan(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Faturamento</h1>
        <p className="text-muted-foreground">Gerencie seu plano e acompanhe suas faturas</p>
      </div>

      {/* Status da assinatura */}
      {subscription && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plano {currentPlan?.name || subscription.plan_key}
                  <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                    {subscription.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {subscription.status === 'pending_payment_method' && <Clock className="h-3 w-3 mr-1" />}
                    {subscription.status === 'suspended' && <XCircle className="h-3 w-3 mr-1" />}
                    {subscription.status === 'active' ? 'Ativo' : 
                     subscription.status === 'pending_payment_method' ? 'Pendente' :
                     subscription.status === 'suspended' ? 'Suspenso' : subscription.status}
                  </Badge>
                </CardTitle>
                {currentPlan && (
                  <CardDescription>
                    {formatCurrency(currentPlan.monthly_fee_cents)}/mês + {formatPercentage(currentPlan.fee_bps)} por venda
                  </CardDescription>
                )}
              </div>
              {subscription.card_last_four && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {subscription.card_brand} •••• {subscription.card_last_four}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Uso do mês */}
            {limitCheck && limitCheck.order_limit && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Pedidos este mês</span>
                  <span className="font-medium">{limitCheck.current_count} / {limitCheck.order_limit}</span>
                </div>
                <Progress value={usagePercent} className="h-2" />
                {limitCheck.is_over_limit && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Você ultrapassou o limite do seu plano. Considere fazer upgrade.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Estimativa do mês */}
            {monthlyUsage && currentPlan && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Estimativa do mês atual
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Mensalidade</p>
                    <p className="font-medium">{formatCurrency(currentPlan.monthly_fee_cents)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taxa sobre vendas</p>
                    <p className="font-medium">
                      {formatCurrency(Math.floor((monthlyUsage.gmv_cents * currentPlan.fee_bps) / 10000))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Consumo IA</p>
                    <p className="font-medium">{formatCurrency(monthlyUsage.ai_usage_cents)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total estimado</p>
                    <p className="font-bold text-primary">
                      {formatCurrency(
                        currentPlan.monthly_fee_cents + 
                        Math.floor((monthlyUsage.gmv_cents * currentPlan.fee_bps) / 10000) +
                        monthlyUsage.ai_usage_cents
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sem assinatura */}
      {!subscription && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você ainda não possui um plano ativo. Escolha um plano abaixo para começar.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Planos</TabsTrigger>
          <TabsTrigger value="invoices">Faturas</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-6">
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {plans?.filter(p => !p.is_custom).map((plan) => (
              <PlanCard
                key={plan.plan_key}
                plan={plan}
                isCurrentPlan={subscription?.plan_key === plan.plan_key}
                isPopular={plan.plan_key === 'scale'}
                onSelect={handleSelectPlan}
              />
            ))}
          </div>

          {/* Plano Custom */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Precisa de mais?</CardTitle>
              <CardDescription>
                Para operações com mais de 3.000 pedidos/mês ou necessidades específicas, 
                entre em contato para um plano personalizado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => window.open('https://wa.me/5511999999999', '_blank')}>
                Falar com Comercial
                <ArrowUpRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Histórico de Faturas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div 
                      key={invoice.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {format(new Date(invoice.year_month + '-01'), 'MMMM yyyy', { locale: ptBR })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Vencimento: {invoice.due_date 
                            ? format(new Date(invoice.due_date), 'dd/MM/yyyy')
                            : '-'
                          }
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(invoice.total_cents)}</p>
                        <Badge variant={
                          invoice.status === 'paid' ? 'default' :
                          invoice.status === 'open' ? 'secondary' :
                          invoice.status === 'failed' ? 'destructive' : 'outline'
                        }>
                          {invoice.status === 'paid' ? 'Pago' :
                           invoice.status === 'open' ? 'Em aberto' :
                           invoice.status === 'failed' ? 'Falhou' :
                           invoice.status === 'draft' ? 'Rascunho' : invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma fatura encontrada
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
