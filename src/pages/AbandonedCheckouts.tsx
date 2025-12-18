import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Filter, Calendar, MapPin, ShoppingCart, Eye, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAbandonedCheckouts, useAbandonedCheckoutStats, AbandonedCheckout } from '@/hooks/useAbandonedCheckouts';
import { StatCard } from '@/components/ui/stat-card';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

function formatCurrency(value: number | null) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return format(date, 'HH:mm', { locale: ptBR });
  } else if (diffDays === 1) {
    return `Ontem às ${format(date, 'HH:mm', { locale: ptBR })}`;
  } else if (diffDays < 7) {
    return format(date, "EEEE 'às' HH:mm", { locale: ptBR });
  }
  return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

function getStatusBadge(status: string | null, recoveryStatus: string) {
  if (status === 'completed' || recoveryStatus === 'recovered') {
    return <Badge variant="default" className="bg-green-600">Convertido</Badge>;
  }
  if (status === 'abandoned') {
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Abandonado</Badge>;
  }
  return <Badge variant="outline">Em progresso</Badge>;
}

function getRecoveryBadge(recoveryStatus: string) {
  if (recoveryStatus === 'recovered') {
    return <Badge variant="default" className="bg-green-100 text-green-800">Recuperado</Badge>;
  }
  return <Badge variant="secondary" className="bg-red-100 text-red-800">Não recuperado</Badge>;
}

export default function AbandonedCheckouts() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [recoveryStatus, setRecoveryStatus] = useState('all');
  const [region, setRegion] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedCheckout, setSelectedCheckout] = useState<AbandonedCheckout | null>(null);

  const { data: checkouts, isLoading } = useAbandonedCheckouts({
    search,
    status,
    recoveryStatus,
    startDate,
    endDate,
    region,
  });

  const { data: stats } = useAbandonedCheckoutStats();

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setRecoveryStatus('all');
    setRegion('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasActiveFilters = search || status !== 'all' || recoveryStatus !== 'all' || region !== 'all' || startDate || endDate;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checkouts Abandonados"
        description="Acompanhe e recupere vendas não finalizadas"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total"
          value={stats?.total || 0}
          icon={ShoppingCart}
        />
        <StatCard
          title="Abandonados"
          value={stats?.abandoned || 0}
          icon={ShoppingCart}
        />
        <StatCard
          title="Não recuperados"
          value={stats?.notRecovered || 0}
          icon={ShoppingCart}
        />
        <StatCard
          title="Valor total"
          value={formatCurrency(stats?.totalValue || 0)}
          icon={ShoppingCart}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por email, nome, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Em progresso</SelectItem>
            <SelectItem value="abandoned">Abandonado</SelectItem>
            <SelectItem value="completed">Convertido</SelectItem>
          </SelectContent>
        </Select>

        <Select value={recoveryStatus} onValueChange={setRecoveryStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Recuperação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="not_recovered">Não recuperado</SelectItem>
            <SelectItem value="recovered">Recuperado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-[120px]">
            <MapPin className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Região" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {BRAZILIAN_STATES.map(state => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              {startDate ? format(startDate, 'dd/MM') : 'Período'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={{ from: startDate, to: endDate }}
              onSelect={(range) => {
                setStartDate(range?.from);
                setEndDate(range?.to);
              }}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Checkout</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recuperação</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                </TableRow>
              ))
            ) : checkouts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum checkout encontrado
                </TableCell>
              </TableRow>
            ) : (
              checkouts?.map((checkout) => (
                <TableRow key={checkout.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCheckout(checkout)}>
                  <TableCell className="font-mono text-sm">
                    #{checkout.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(checkout.updated_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{checkout.customer_name || '-'}</span>
                      <span className="text-sm text-muted-foreground">{checkout.customer_email || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {checkout.shipping_state || checkout.shipping_country || 'Brasil'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(checkout.status, checkout.recovery_status)}
                  </TableCell>
                  <TableCell>
                    {getRecoveryBadge(checkout.recovery_status)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(checkout.total)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedCheckout} onOpenChange={() => setSelectedCheckout(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do Checkout</SheetTitle>
          </SheetHeader>
          
          {selectedCheckout && (
            <div className="space-y-6 mt-6">
              {/* Customer Info */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">CLIENTE</h3>
                <div className="space-y-1">
                  <p className="font-medium">{selectedCheckout.customer_name || 'Nome não informado'}</p>
                  <p className="text-sm text-muted-foreground">{selectedCheckout.customer_email || 'Email não informado'}</p>
                  {selectedCheckout.customer_phone && (
                    <p className="text-sm text-muted-foreground">{selectedCheckout.customer_phone}</p>
                  )}
                </div>
              </div>

              {/* Address */}
              {(selectedCheckout.shipping_city || selectedCheckout.shipping_state) && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">ENDEREÇO</h3>
                  <p className="text-sm">
                    {[selectedCheckout.shipping_city, selectedCheckout.shipping_state].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}

              {/* Items */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">ITENS DO CARRINHO</h3>
                {selectedCheckout.items_snapshot && selectedCheckout.items_snapshot.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCheckout.items_snapshot.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          {item.image && (
                            <img src={item.image} alt={item.title} className="w-10 h-10 object-cover rounded" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{item.title || item.name}</p>
                            <p className="text-xs text-muted-foreground">Qtd: {item.quantity || item.qty}</p>
                          </div>
                        </div>
                        <span className="text-sm font-medium">{formatCurrency(item.price)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Itens não disponíveis</p>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedCheckout.subtotal)}</span>
                </div>
                {selectedCheckout.shipping_total && selectedCheckout.shipping_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Frete</span>
                    <span>{formatCurrency(selectedCheckout.shipping_total)}</span>
                  </div>
                )}
                {selectedCheckout.discount_total && selectedCheckout.discount_total > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto</span>
                    <span>-{formatCurrency(selectedCheckout.discount_total)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(selectedCheckout.total)}</span>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">HISTÓRICO</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Iniciado em {format(new Date(selectedCheckout.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <span>Última atividade em {format(new Date(selectedCheckout.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                  {selectedCheckout.abandoned_at && (
                    <div className="flex items-center gap-3 text-sm text-amber-600">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Abandonado em {format(new Date(selectedCheckout.abandoned_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                  {selectedCheckout.completed_at && (
                    <div className="flex items-center gap-3 text-sm text-green-600">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Convertido em {format(new Date(selectedCheckout.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex gap-2">
                {getStatusBadge(selectedCheckout.status, selectedCheckout.recovery_status)}
                {getRecoveryBadge(selectedCheckout.recovery_status)}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
