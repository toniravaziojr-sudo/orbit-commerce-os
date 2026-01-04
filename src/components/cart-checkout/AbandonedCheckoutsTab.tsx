// =============================================
// ABANDONED CHECKOUTS TAB - Wrapper for abandoned checkouts content
// =============================================

import { useState } from 'react';
import { useCheckoutSessions, useCheckoutSessionsStats, CheckoutSession } from '@/hooks/useCheckoutSessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { 
  Search, 
  RefreshCw, 
  ShoppingBag, 
  Clock, 
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  Package,
  DollarSign
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BRAZILIAN_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

function formatCurrency(value: number | null): string {
  if (value === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
}

function getStatusBadge(status: CheckoutSession['status']) {
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Ativo', variant: 'default' },
    abandoned: { label: 'Abandonado', variant: 'destructive' },
    converted: { label: 'Convertido', variant: 'secondary' },
    recovered: { label: 'Recuperado', variant: 'outline' },
    canceled: { label: 'Cancelado', variant: 'outline' },
  };
  const config = statusMap[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function AbandonedCheckoutsTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedSession, setSelectedSession] = useState<CheckoutSession | null>(null);

  const { data: sessions = [], isLoading, refetch } = useCheckoutSessions({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    region: regionFilter !== 'all' ? regionFilter : undefined,
    startDate,
    endDate,
  });

  const { data: stats, isLoading: statsLoading } = useCheckoutSessionsStats();

  const filteredSessions = sessions.filter(session => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      session.customer_email?.toLowerCase().includes(searchLower) ||
      session.customer_name?.toLowerCase().includes(searchLower) ||
      session.customer_phone?.includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Abandonados</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.abandoned || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Potencial</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalValue || 0)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recuperados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.recovered || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Recuperação</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {stats && stats.total > 0 
                  ? ((stats.recovered / stats.total) * 100).toFixed(1) 
                  : 0}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por email, nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="abandoned">Abandonado</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="recovered">Recuperado</SelectItem>
                <SelectItem value="converted">Convertido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {BRAZILIAN_STATES.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
            />
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum checkout encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredSessions.map(session => (
                <div
                  key={session.id}
                  className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {session.customer_name || session.customer_email || 'Visitante'}
                        </span>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        {session.customer_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {session.customer_email}
                          </span>
                        )}
                        {session.region && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.region}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(session.total_estimated)}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(session.last_seen_at)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Detail Sheet */}
      <Sheet open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedSession && (
            <>
              <SheetHeader>
                <SheetTitle>Detalhes do Checkout</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(selectedSession.status)}
                </div>

                <Separator />

                {/* Customer Info */}
                <div className="space-y-3">
                  <h4 className="font-medium">Cliente</h4>
                  {selectedSession.customer_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Nome:</span>
                      <span>{selectedSession.customer_name}</span>
                    </div>
                  )}
                  {selectedSession.customer_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedSession.customer_email}</span>
                    </div>
                  )}
                  {selectedSession.customer_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedSession.customer_phone}</span>
                    </div>
                  )}
                  {selectedSession.region && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedSession.region}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Cart Items */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Itens do Carrinho
                  </h4>
                  {selectedSession.items_snapshot ? (
                    <div className="space-y-2">
                      {(selectedSession.items_snapshot as any[]).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.name || item.product_name} x{item.quantity}</span>
                          <span>{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem itens registrados</p>
                  )}
                </div>

                <Separator />

                {/* Value */}
                <div className="flex items-center justify-between">
                  <span className="font-medium">Valor Estimado</span>
                  <span className="text-lg font-bold">{formatCurrency(selectedSession.total_estimated)}</span>
                </div>

                <Separator />

                {/* Timestamps */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Iniciado em</span>
                    <span>{format(new Date(selectedSession.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última atividade</span>
                    <span>{format(new Date(selectedSession.last_seen_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                  </div>
                  {selectedSession.abandoned_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Abandonado em</span>
                      <span>{format(new Date(selectedSession.abandoned_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                    </div>
                  )}
                  {selectedSession.recovered_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recuperado em</span>
                      <span>{format(new Date(selectedSession.recovered_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
