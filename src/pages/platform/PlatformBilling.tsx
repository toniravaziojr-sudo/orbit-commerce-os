import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlatformAdminGate } from "@/components/auth/PlatformAdminGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, CreditCard, Users, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
  tenant_id: string;
  plan_key: string;
  billing_cycle: string;
  status: string;
  current_period_end: string | null;
  updated_at: string;
  tenants: {
    name: string;
    slug: string;
  } | null;
}

interface BillingEvent {
  id: string;
  tenant_id: string | null;
  event_type: string;
  event_id: string;
  created_at: string;
  payload: Record<string, unknown>;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function getStatusBadge(status: string) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    trial: 'secondary',
    past_due: 'destructive',
    canceled: 'outline',
    inactive: 'outline',
    pending: 'secondary',
  };
  
  const labels: Record<string, string> = {
    active: 'Ativo',
    trial: 'Trial',
    past_due: 'Inadimplente',
    canceled: 'Cancelado',
    inactive: 'Inativo',
    pending: 'Pendente',
  };

  return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
}

export default function PlatformBilling() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("subscriptions");

  // Fetch all subscriptions
  const { data: subscriptions, isLoading: loadingSubscriptions } = useQuery({
    queryKey: ['platform-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select(`
          tenant_id,
          plan_key,
          billing_cycle,
          status,
          current_period_end,
          updated_at,
          tenants (name, slug)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Subscription[];
    },
  });

  // Fetch billing events
  const { data: events, isLoading: loadingEvents } = useQuery({
    queryKey: ['platform-billing-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as BillingEvent[];
    },
  });

  // Fetch billing plans
  const { data: plans } = useQuery({
    queryKey: ['billing-plans-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      return data;
    },
  });

  // Stats
  const stats = {
    total: subscriptions?.length || 0,
    active: subscriptions?.filter(s => s.status === 'active').length || 0,
    pastDue: subscriptions?.filter(s => s.status === 'past_due').length || 0,
    mrr: subscriptions?.reduce((acc, s) => {
      if (s.status !== 'active') return acc;
      const plan = plans?.find(p => p.plan_key === s.plan_key);
      if (!plan) return acc;
      const monthly = s.billing_cycle === 'annual' 
        ? plan.price_annual_cents / 12 
        : plan.price_monthly_cents;
      return acc + monthly;
    }, 0) || 0,
  };

  const filteredSubscriptions = subscriptions?.filter(sub => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      sub.tenants?.name?.toLowerCase().includes(search) ||
      sub.tenants?.slug?.toLowerCase().includes(search) ||
      sub.plan_key.toLowerCase().includes(search)
    );
  });

  return (
    <PlatformAdminGate>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Assinaturas</h1>
          <p className="text-muted-foreground">Gerencie assinaturas e pagamentos dos tenants</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Assinaturas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inadimplentes</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.pastDue}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MRR Estimado</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.mrr)}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="events">Eventos</TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por tenant ou plano..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Ciclo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Atualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSubscriptions ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredSubscriptions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma assinatura encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubscriptions?.map((sub) => (
                      <TableRow key={sub.tenant_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{sub.tenants?.name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">{sub.tenants?.slug}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sub.plan_key}</Badge>
                        </TableCell>
                        <TableCell>
                          {sub.billing_cycle === 'annual' ? 'Anual' : 'Mensal'}
                        </TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell>
                          {sub.current_period_end
                            ? format(new Date(sub.current_period_end), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(sub.updated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Planos Disponíveis</CardTitle>
                <CardDescription>Configure os planos disponíveis para assinatura</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead>Preço Mensal</TableHead>
                      <TableHead>Preço Anual</TableHead>
                      <TableHead>Limite Pedidos</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans?.map((plan) => (
                      <TableRow key={plan.plan_key}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{plan.name}</div>
                            <div className="text-sm text-muted-foreground">{plan.plan_key}</div>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(plan.price_monthly_cents)}</TableCell>
                        <TableCell>{formatCurrency(plan.price_annual_cents)}</TableCell>
                        <TableCell>
                          {plan.included_orders_per_month 
                            ? plan.included_orders_per_month.toLocaleString() 
                            : 'Ilimitado'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={plan.is_active ? 'default' : 'outline'}>
                            {plan.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Eventos de Billing</CardTitle>
                <CardDescription>Webhooks recebidos do Mercado Pago</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Event ID</TableHead>
                      <TableHead>Tenant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingEvents ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : events?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Nenhum evento registrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      events?.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>
                            {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{event.event_type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {event.event_id.substring(0, 20)}...
                          </TableCell>
                          <TableCell>
                            {event.tenant_id ? event.tenant_id.substring(0, 8) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PlatformAdminGate>
  );
}
