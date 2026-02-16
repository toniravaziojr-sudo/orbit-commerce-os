import { useState } from 'react';
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
  Trash2,
  Sparkles,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderSourceBadge } from './OrderSourceBadge';
import type { Order } from '@/hooks/useOrders';
import { 
  OrderStatus, 
  PaymentStatus, 
  ShippingStatus,
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  SHIPPING_STATUS_CONFIG,
} from '@/types/orderStatus';

interface OrderListProps {
  orders: Order[];
  isLoading: boolean;
  onView: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onDelete?: (orderId: string) => void;
}

const orderStatusIcons: Record<OrderStatus, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle,
  dispatched: Tag,
  shipping: Truck,
  completed: PackageCheck,
  cancelled: XCircle,
  returned: RotateCcw,
  refunded: RotateCcw,
};

const shippingStatusIcons: Record<ShippingStatus, typeof Truck> = {
  awaiting_shipment: Package,
  label_generated: Tag,
  shipped: Truck,
  in_transit: Truck,
  arriving: MapPin,
  delivered: PackageCheck,
  problem: AlertTriangle,
  awaiting_pickup: Clock,
  returning: RotateCcw,
  returned: RotateCcw,
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
  onDelete,
}: OrderListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setOrderToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (orderToDelete && onDelete) {
      onDelete(orderToDelete);
    }
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
  };
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
              const orderStatusCfg = ORDER_STATUS_CONFIG[order.status as OrderStatus] || ORDER_STATUS_CONFIG.pending;
              const paymentStatusCfg = PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus] || PAYMENT_STATUS_CONFIG.awaiting_payment;
              const StatusIcon = orderStatusIcons[order.status as OrderStatus] || Clock;
              
              // Shipping status with fallback
              const shippingStatusVal = (order.shipping_status || 'awaiting_shipment') as ShippingStatus;
              const shippingStatusCfg = SHIPPING_STATUS_CONFIG[shippingStatusVal] || SHIPPING_STATUS_CONFIG.awaiting_shipment;
              const ShippingIcon = shippingStatusIcons[shippingStatusVal] || Package;

              return (
                <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={() => onView(order)}>
                    <div className="flex items-center gap-3">
                      <OrderSourceBadge 
                        marketplaceSource={order.marketplace_source} 
                        size="md"
                      />
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        {order.marketplace_order_id && (
                          <p className="text-xs text-muted-foreground">
                            #{order.marketplace_order_id}
                          </p>
                        )}
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
                    <Badge variant={orderStatusCfg.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {orderStatusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={shippingStatusCfg.variant} className="gap-1 cursor-help">
                          <ShippingIcon className="h-3 w-3" />
                          {shippingStatusCfg.label}
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
                    <Badge variant={paymentStatusCfg.variant}>
                      {paymentStatusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {formatCurrency(order.total)}
                      {order.is_first_sale && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 whitespace-nowrap">
                          1ª venda
                        </Badge>
                      )}
                    </div>
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
                          {Object.entries(ORDER_STATUS_CONFIG).map(([key, cfg]) => {
                            const Icon = orderStatusIcons[key as OrderStatus] || Clock;
                            return (
                              <DropdownMenuItem
                                key={key}
                                onClick={() => onUpdateStatus(order.id, key as OrderStatus)}
                                disabled={order.status === key}
                              >
                                <Icon className="mr-2 h-4 w-4" />
                                {cfg.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      {onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteClick(order.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O pedido será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
