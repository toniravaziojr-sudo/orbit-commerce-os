import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Download, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { OrderList } from '@/components/orders/OrderList';
import { OrderImport } from '@/components/orders/OrderImport';
import { useOrders, type Order, type OrderStatus } from '@/hooks/useOrders';

const PAGE_SIZE = 50;

export default function Orders() {
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

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

  const { 
    orders, 
    totalCount, 
    isLoading, 
    updateOrderStatus,
    refetch,
  } = useOrders({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    status: statusFilter,
    paymentStatus: paymentFilter,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleView = (order: Order) => {
    navigate(`/orders/${order.id}`);
  };

  const handleUpdateStatus = (orderId: string, status: OrderStatus) => {
    updateOrderStatus.mutate({ orderId, status });
  };

  // Calculate stats from current page
  const pendingCount = orders.filter(o => o.status === 'pending' || o.status === 'awaiting_payment').length;
  const processingCount = orders.filter(o => o.status === 'processing' || o.status === 'paid').length;
  const shippedCount = orders.filter(o => o.status === 'shipped' || o.status === 'in_transit').length;

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
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button className="gap-2" onClick={() => navigate('/orders/new')}>
              <Plus className="h-4 w-4" />
              Novo Pedido
            </Button>
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
          title="Pendentes"
          value={pendingCount.toString()}
          icon={Package}
          description="Aguardando ação"
        />
        <StatCard
          title="Em Processamento"
          value={processingCount.toString()}
          icon={Package}
          description="Pagos ou em separação"
        />
        <StatCard
          title="Enviados"
          value={shippedCount.toString()}
          icon={Package}
          description="Em trânsito"
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
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="awaiting_payment">Aguardando Pgto</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="processing">Em Separação</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="in_transit">Em Trânsito</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="returned">Devolvido</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={handlePaymentChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="declined">Recusado</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
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
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * PAGE_SIZE) + 1} a {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount} pedidos
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
                <div className="flex items-center gap-1">
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

      {/* Import Modal */}
      <OrderImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
