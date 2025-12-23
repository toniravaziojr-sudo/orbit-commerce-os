import { 
  Package, 
  MoreHorizontal, 
  Eye, 
  Truck,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  MapPin,
  AlertTriangle,
  Tag,
  PackageCheck,
  PackageX,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { Order, OrderStatus, ShippingStatus } from '@/hooks/useOrders';

interface OrderListProps {
  orders: Order[];
  isLoading: boolean;
  onView: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}

const orderStatusConfig: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  awaiting_payment: { label: 'Aguardando Pagamento', variant: 'outline', icon: CreditCard },
  paid: { label: 'Pago', variant: 'default', icon: CheckCircle },
  processing: { label: 'Em Separação', variant: 'default', icon: Package },
  shipped: { label: 'Enviado', variant: 'default', icon: Truck },
  in_transit: { label: 'Em Trânsito', variant: 'default', icon: Truck },
  delivered: { label: 'Entregue', variant: 'default', icon: CheckCircle },
  cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
  returned: { label: 'Devolvido', variant: 'destructive', icon: RotateCcw },
};

const paymentStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  processing: { label: 'Processando', variant: 'outline' },
  approved: { label: 'Aprovado', variant: 'default' },
  declined: { label: 'Recusado', variant: 'destructive' },
  refunded: { label: 'Reembolsado', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

// Extended type to include both database values and UI-specific values
type ExtendedShippingStatus = ShippingStatus | 'unknown' | 'posted';

const shippingStatusConfig: Record<ExtendedShippingStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Truck }> = {
  pending: { label: 'Sem rastreio', variant: 'outline', icon: Package },
  processing: { label: 'Etiqueta gerada', variant: 'secondary', icon: Tag },
  posted: { label: 'Postado', variant: 'default', icon: Truck },
  shipped: { label: 'Postado', variant: 'default', icon: Truck },
  in_transit: { label: 'Em trânsito', variant: 'default', icon: Truck },
  out_for_delivery: { label: 'Saiu p/ entrega', variant: 'default', icon: MapPin },
  delivered: { label: 'Entregue', variant: 'default', icon: PackageCheck },
  returned: { label: 'Devolvido', variant: 'destructive', icon: RotateCcw },
  failed: { label: 'Falha', variant: 'destructive', icon: AlertTriangle },
  unknown: { label: 'Sem rastreio', variant: 'outline', icon: PackageX },
};

function maskTrackingCode(code: string | null): string {
  if (!code) return '—';
  if (code.length <= 4) return code;
  return `...${code.slice(-4)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export function OrderList({
  orders,
  isLoading,
  onView,
  onUpdateStatus,
}: OrderListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Nenhum pedido encontrado"
        description="Pedidos serão exibidos aqui quando forem criados."
      />
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Envio</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const statusConfig = orderStatusConfig[order.status];
              const paymentConfig = paymentStatusConfig[order.payment_status];
              const StatusIcon = statusConfig.icon;
              
              // Shipping status with fallback (cast to extended type to handle all possible values)
              const shippingStatus = (order.shipping_status || 'unknown') as ExtendedShippingStatus;
              const shippingConfig = shippingStatusConfig[shippingStatus] || shippingStatusConfig['unknown'];
              const ShippingIcon = shippingConfig.icon;

              return (
                <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={() => onView(order)}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={shippingConfig.variant} className="gap-1 cursor-help">
                          <ShippingIcon className="h-3 w-3" />
                          {shippingConfig.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <div className="space-y-1">
                          <p><strong>Transportadora:</strong> {order.shipping_carrier || 'Não informada'}</p>
                          <p><strong>Rastreio:</strong> {maskTrackingCode(order.tracking_code)}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentConfig.variant}>
                      {paymentConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.total)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(order.created_at)}
                  </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(order)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          Alterar status
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {Object.entries(orderStatusConfig).map(([key, config]) => (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => onUpdateStatus(order.id, key as OrderStatus)}
                              disabled={order.status === key}
                            >
                              <config.icon className="mr-2 h-4 w-4" />
                              {config.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
