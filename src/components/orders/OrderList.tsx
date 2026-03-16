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
  Link2,
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
  normalizeOrderStatus,
  normalizePaymentStatus,
  normalizeShippingStatus,
} from '@/types/orderStatus';

interface OrderListProps {
  orders: Order[];
  isLoading: boolean;
  onView: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onDelete?: (orderId: string) => void;
}

const orderStatusIcons: Record<OrderStatus, typeof Clock> = {
  awaiting_confirmation: Clock,
  ready_to_invoice: CreditCard,
  invoice_pending_sefaz: Clock,
  invoice_authorized: CheckCircle,
  invoice_issued: CheckCircle,
  dispatched: Tag,
  completed: PackageCheck,
  returning: RotateCcw,
  payment_expired: XCircle,
  invoice_rejected: AlertTriangle,
  invoice_cancelled: PackageX,
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

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão',
    debit_card: 'Débito',
    boleto: 'Boleto',
    mercado_pago: 'Mercado Pago',
    pagarme: 'Pagar.me',
  };

  return (
    <TooltipProvider>
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Pedido</TableHead>
              <TableHead className="min-w-[180px]">Cliente</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[120px]">Envio</TableHead>
              <TableHead className="w-[90px]">Método</TableHead>
              <TableHead className="w-[120px]">Pagamento</TableHead>
              <TableHead className="w-[110px] text-right">Total</TableHead>
              <TableHead className="w-[130px]">Data</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const normalizedOrderStatus = normalizeOrderStatus(order.status);
              const normalizedPaymentStatus = normalizePaymentStatus(order.payment_status);
              const normalizedShippingStatus = normalizeShippingStatus(order.shipping_status);
              
              const orderStatusCfg = ORDER_STATUS_CONFIG[normalizedOrderStatus];
              const paymentStatusCfg = PAYMENT_STATUS_CONFIG[normalizedPaymentStatus];
              const StatusIcon = orderStatusIcons[normalizedOrderStatus] || Clock;
              const shippingStatusCfg = SHIPPING_STATUS_CONFIG[normalizedShippingStatus];
              const ShippingIcon = shippingStatusIcons[normalizedShippingStatus] || Package;

              return (
                <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={() => onView(order)} className="py-3">
                    <div className="flex items-center gap-2">
                      <OrderSourceBadge 
                        marketplaceSource={order.marketplace_source} 
                        size="sm"
                      />
                      <span className="font-semibold text-sm">{order.order_number}</span>
                      {order.retry_from_order_id && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link2 className="h-3.5 w-3.5 text-info shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Retentativa de pagamento
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={() => onView(order)} className="py-3">
                    <p className="font-medium text-sm truncate max-w-[200px]">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{order.customer_email}</p>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant={orderStatusCfg.variant} className="gap-1 text-xs whitespace-nowrap">
                      <StatusIcon className="h-3 w-3 shrink-0" />
                      {orderStatusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={shippingStatusCfg.variant} className="gap-1 text-xs cursor-help whitespace-nowrap">
                          <ShippingIcon className="h-3 w-3 shrink-0" />
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
                  <TableCell className="py-3">
                    <span className="text-xs font-medium">
                      {order.payment_method ? PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant={paymentStatusCfg.variant} className="text-xs whitespace-nowrap">
                      {paymentStatusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right py-3">
                    <span className="font-semibold text-sm">{formatCurrency(order.total)}</span>
                    {order.is_first_sale && (
                      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 whitespace-nowrap">
                        1ª
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(order.created_at)}
                  </TableCell>
                  <TableCell className="py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
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
