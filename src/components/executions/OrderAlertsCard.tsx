import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChargebackOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  customer_name: string;
  customer_email: string;
  chargeback_detected_at: string | null;
  chargeback_deadline_at: string | null;
  created_at: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateString: string) {
  return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function timeRemaining(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (d < new Date()) return 'Prazo expirado';
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: false }) + ' restante(s)';
}

export function OrderAlertsCard() {
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const tenantId = currentTenant?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['order-alerts-chargebacks', tenantId],
    queryFn: async () => {
      if (!tenantId) return { detected: [], lost: [], recovered: [] };

      const [detectedRes, lostRes, recoveredRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, payment_status, total, customer_name, customer_email, chargeback_detected_at, chargeback_deadline_at, created_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'chargeback_detected')
          .order('chargeback_detected_at', { ascending: false })
          .limit(50),
        supabase
          .from('orders')
          .select('id, order_number, status, payment_status, total, customer_name, customer_email, chargeback_detected_at, chargeback_deadline_at, created_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'chargeback_lost')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('orders')
          .select('id, order_number, status, payment_status, total, customer_name, customer_email, chargeback_detected_at, chargeback_deadline_at, created_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'chargeback_recovered')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      return {
        detected: (detectedRes.data || []) as ChargebackOrder[],
        lost: (lostRes.data || []) as ChargebackOrder[],
        recovered: (recoveredRes.data || []) as ChargebackOrder[],
      };
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  const detected = data?.detected || [];
  const lost = data?.lost || [];
  const recovered = data?.recovered || [];

  const totalAtRisk = detected.reduce((sum, o) => sum + o.total, 0);
  const totalLost = lost.reduce((sum, o) => sum + o.total, 0);
  const totalRecovered = recovered.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Em análise"
          value={isLoading ? '—' : String(detected.length)}
          description={isLoading ? '' : `${formatCurrency(totalAtRisk)} em risco`}
          icon={ShieldAlert}
          variant="warning"
        />
        <StatCard
          title="Perdidos"
          value={isLoading ? '—' : String(lost.length)}
          description={isLoading ? '' : `${formatCurrency(totalLost)} perdidos`}
          icon={ShieldX}
          variant="destructive"
        />
        <StatCard
          title="Recuperados"
          value={isLoading ? '—' : String(recovered.length)}
          description={isLoading ? '' : `${formatCurrency(totalRecovered)} recuperados`}
          icon={ShieldCheck}
          variant="success"
        />
        <StatCard
          title="Taxa de recuperação"
          value={isLoading ? '—' : (lost.length + recovered.length > 0 
            ? `${Math.round((recovered.length / (lost.length + recovered.length)) * 100)}%` 
            : '—')}
          icon={CheckCircle}
          variant="primary"
        />
      </div>

      {/* Active Chargebacks - Priority Alert */}
      <Card className={detected.length > 0 ? "border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-950/10" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`rounded-lg p-2 ${detected.length > 0 ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-muted"}`}>
                <ShieldAlert className={`h-4 w-4 ${detected.length > 0 ? "text-yellow-700 dark:text-yellow-400" : "text-muted-foreground"}`} />
              </div>
              <CardTitle className="text-base font-semibold">Chargebacks em análise</CardTitle>
              {detected.length > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 border-yellow-400/50 text-yellow-700 bg-yellow-50">
                  {detected.length} ativo{detected.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/orders')}>
              <Package className="h-3 w-3" />
              Ver pedidos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : detected.length === 0 ? (
            <div className="flex items-start gap-2 p-3 rounded-md bg-background border">
              <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Nenhum chargeback em análise</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Todos os pedidos estão sem disputas ativas no momento.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {detected.map((order) => {
                const remaining = timeRemaining(order.chargeback_deadline_at);
                const isUrgent = order.chargeback_deadline_at && new Date(order.chargeback_deadline_at) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                
                return (
                  <div
                    key={order.id}
                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors ${
                      isUrgent ? 'border-destructive/30 bg-destructive/5' : 'border-yellow-300/50 bg-yellow-50/30 dark:bg-yellow-950/5'
                    }`}
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AlertTriangle className={`h-4 w-4 shrink-0 ${isUrgent ? 'text-destructive' : 'text-yellow-600'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">#{order.order_number}</span>
                          <span className="text-xs text-muted-foreground truncate">{order.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            Detectado em {order.chargeback_detected_at ? formatDate(order.chargeback_detected_at) : '—'}
                          </span>
                          {remaining && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isUrgent ? 'border-destructive/50 text-destructive' : 'border-yellow-400/50 text-yellow-700'}`}>
                              <Clock className="h-2.5 w-2.5 mr-0.5" />
                              {remaining}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold">{formatCurrency(order.total)}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Lost & Recovered */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Lost */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm font-semibold">Chargebacks perdidos (recentes)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : lost.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum chargeback perdido registrado.</p>
            ) : (
              <div className="space-y-1.5">
                {lost.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium">#{order.order_number}</span>
                      <span className="text-xs text-muted-foreground truncate">{order.customer_name}</span>
                    </div>
                    <span className="text-xs font-semibold text-destructive">{formatCurrency(order.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recovered */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <CardTitle className="text-sm font-semibold">Chargebacks recuperados (recentes)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : recovered.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum chargeback recuperado registrado.</p>
            ) : (
              <div className="space-y-1.5">
                {recovered.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium">#{order.order_number}</span>
                      <span className="text-xs text-muted-foreground truncate">{order.customer_name}</span>
                    </div>
                    <span className="text-xs font-semibold text-success">{formatCurrency(order.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
