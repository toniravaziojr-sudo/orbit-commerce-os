import { useState } from 'react';
import { 
  CreditCard, 
  Settings, 
  History, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { usePayments, type Payment } from '@/hooks/usePayments';
import { PaymentGatewaySettings } from '@/components/payments/PaymentGatewaySettings';

const PAGE_SIZE = 20;

const paymentStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  processing: { label: 'Processando', variant: 'outline', icon: RefreshCw },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  declined: { label: 'Recusado', variant: 'destructive', icon: XCircle },
  refunded: { label: 'Reembolsado', variant: 'outline', icon: RotateCcw },
  cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
};

const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  boleto: 'Boleto',
  mercado_pago: 'Mercado Pago',
  pagarme: 'PagarMe',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export default function Payments() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { payments, stats, totalCount, isLoading } = usePayments({
    page: currentPage,
    pageSize: PAGE_SIZE,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Pagamentos"
        description="Gestão de transações, gateways e conciliação"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Recebido (Mês)"
          value={formatCurrency(stats.totalReceived)}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Aguardando Pagamento"
          value={formatCurrency(stats.totalPending)}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Transações Aprovadas"
          value={stats.approvedCount.toString()}
          icon={CreditCard}
          variant="primary"
        />
        <StatCard
          title="Taxa de Aprovação"
          value={`${stats.approvalRate.toFixed(1)}%`}
          icon={CheckCircle}
          variant="info"
        />
      </div>

      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="transactions" className="gap-2">
            <History className="h-4 w-4" />
            Transações
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                >
                  Todos
                </Button>
                {Object.entries(paymentStatusConfig).map(([key, config]) => (
                  <Button
                    key={key}
                    variant={statusFilter === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
                  >
                    {config.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Transactions List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Transações
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({totalCount} {totalCount === 1 ? 'transação' : 'transações'})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma transação encontrada</p>
                  <p className="text-sm mt-1">As transações dos pedidos aparecerão aqui</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => {
                    const statusConfig = paymentStatusConfig[payment.payment_status] || paymentStatusConfig.pending;
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <div 
                        key={payment.id} 
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/orders/${payment.id}`)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${
                            payment.payment_status === 'approved' ? 'bg-green-100 text-green-600' :
                            payment.payment_status === 'pending' || payment.payment_status === 'processing' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            <StatusIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{payment.order_number}</span>
                              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {payment.customer_name} • {payment.payment_method ? paymentMethodLabels[payment.payment_method] || payment.payment_method : 'Não definido'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(payment.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div>
                            <p className="font-medium">{formatCurrency(payment.total)}</p>
                            {payment.payment_gateway && (
                              <p className="text-xs text-muted-foreground capitalize">
                                via {payment.payment_gateway}
                              </p>
                            )}
                          </div>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * PAGE_SIZE) + 1} a {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || isLoading}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <PaymentGatewaySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
