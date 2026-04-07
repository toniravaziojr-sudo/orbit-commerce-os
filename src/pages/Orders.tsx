import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Download, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryErrorState } from '@/components/ui/query-error-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { OrderList } from '@/components/orders/OrderList';
import { useOrders, type Order, type OrderStatus } from '@/hooks/useOrders';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { FeatureGate } from '@/components/layout/FeatureGate';
import { FileImportDialog } from '@/components/import/FileImportDialog';

const PAGE_SIZE = 50;

export default function Orders() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [shippingFilter, setShippingFilter] = useState('all');
  const [firstSaleOnly, setFirstSaleOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [dateField, setDateField] = useState('created_at');
  const [importOpen, setImportOpen] = useState(false);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 300);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handlePaymentChange = (value: string) => {
    setPaymentFilter(value);
    setCurrentPage(1);
  };

  const handleShippingChange = (value: string) => {
    setShippingFilter(value);
    setCurrentPage(1);
  };

  const handleDateChange = (start?: Date, end?: Date) => {
    setStartDate(start);
    setEndDate(end);
    setCurrentPage(1);
  };

  const { 
    orders, 
    totalCount, 
    stats,
    isLoading,
    error,
    updateOrderStatus,
    deleteOrder,
    refetch,
  } = useOrders({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    status: statusFilter,
    paymentStatus: paymentFilter,
    shippingStatus: shippingFilter,
    startDate,
    endDate,
    dateField,
    firstSaleOnly,
  });

  if (error) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="Pedidos" description="Gestão de pedidos, pagamentos e envios" />
        <QueryErrorState title="Erro ao carregar pedidos" onRetry={refetch} />
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleView = (order: Order) => {
    navigate(`/orders/${order.id}`);
  };

  const handleUpdateStatus = (orderId: string, status: OrderStatus) => {
    updateOrderStatus.mutate({ orderId, status });
  };

  const handleDelete = (orderId: string) => {
    deleteOrder.mutate(orderId);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Pedidos"
        description="Gestão de pedidos, pagamentos e envios"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <FeatureGate feature="export_orders">
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </FeatureGate>
            <Button className="gap-2" onClick={() => navigate('/orders/new')}>
              <Plus className="h-4 w-4" />
              Novo Pedido
            </Button>
            <FileImportDialog open={importOpen} onOpenChange={setImportOpen} module="orders" />
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total de Pedidos"
          value={totalCount.toString()}
          icon={Package}
        />
        <StatCard
          title="Pedidos Aprovados"
          value={stats.approvedCount.toString()}
          icon={Package}
          description="Pagamento aprovado"
        />
        <StatCard
          title="NF Emitida"
          value={stats.nfIssuedCount.toString()}
          icon={Package}
          description="Nota fiscal emitida"
        />
        <StatCard
          title="Enviados"
          value={stats.shippedCount.toString()}
          icon={Package}
          description="Pedidos enviados"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, cliente ou email..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="flex gap-3 flex-wrap w-full sm:w-auto">
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={handleDateChange}
                label="Data do pedido"
                dateFieldOptions={[
                  { value: 'created_at', label: 'Data do pedido' },
                  { value: 'paid_at', label: 'Data de pagamento' },
                  { value: 'shipped_at', label: 'Data de envio' },
                ]}
                selectedDateField={dateField}
                onDateFieldChange={setDateField}
              />
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Status Pedido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="awaiting_confirmation">Aguardando confirmação</SelectItem>
                  <SelectItem value="ready_to_invoice">Pronto para emitir NF</SelectItem>
                  <SelectItem value="invoice_pending_sefaz">Pendente SEFAZ</SelectItem>
                  <SelectItem value="invoice_authorized">NF Autorizada</SelectItem>
                  <SelectItem value="invoice_issued">NF Emitida</SelectItem>
                  <SelectItem value="dispatched">Despachado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="returning">Em devolução</SelectItem>
                  <SelectItem value="payment_expired">Pgto expirado</SelectItem>
                  <SelectItem value="invoice_rejected">NF Rejeitada</SelectItem>
                  <SelectItem value="invoice_cancelled">NF Cancelada</SelectItem>
                  <SelectItem value="chargeback_detected">Chargeback detectado</SelectItem>
                  <SelectItem value="chargeback_lost">Chargeback perdido</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={handlePaymentChange}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Status Pgto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos pgtos</SelectItem>
                  <SelectItem value="pending">Aguardando</SelectItem>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="declined">Recusado</SelectItem>
                  <SelectItem value="refunded">Estornado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="under_review">Em análise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={shippingFilter} onValueChange={handleShippingChange}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Status Envio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos envios</SelectItem>
                  <SelectItem value="pending">Aguardando envio</SelectItem>
                  <SelectItem value="processing">Preparando</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="in_transit">Em trânsito</SelectItem>
                  <SelectItem value="out_for_delivery">Saiu para entrega</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="returned">Devolvido</SelectItem>
                  <SelectItem value="failed">Problema</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={firstSaleOnly ? "default" : "outline"}
                size="sm"
                className="gap-1.5 whitespace-nowrap"
                onClick={() => { setFirstSaleOnly(!firstSaleOnly); setCurrentPage(1); }}
              >
                🆕 1ª Venda
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Pedidos
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({totalCount} {totalCount === 1 ? 'pedido' : 'pedidos'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <OrderList
            orders={orders}
            isLoading={isLoading}
            onView={handleView}
            onUpdateStatus={handleUpdateStatus}
            onDelete={handleDelete}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Mostrando {((currentPage - 1) * PAGE_SIZE) + 1} a {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount} pedidos
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="w-9"
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={isLoading}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <span className="sm:hidden text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                >
                  <span className="hidden sm:inline">Próximo</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
