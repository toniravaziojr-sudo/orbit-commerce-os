import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Package, 
  User, 
  MapPin, 
  CreditCard, 
  Truck,
  Clock,
  MessageSquare,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrderDetails, useOrders, type OrderStatus } from '@/hooks/useOrders';

const orderStatusConfig: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  awaiting_payment: { label: 'Aguardando Pagamento', variant: 'outline' },
  paid: { label: 'Pago', variant: 'default' },
  processing: { label: 'Em Separação', variant: 'default' },
  shipped: { label: 'Enviado', variant: 'default' },
  in_transit: { label: 'Em Trânsito', variant: 'default' },
  delivered: { label: 'Entregue', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  returned: { label: 'Devolvido', variant: 'destructive' },
};

const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  boleto: 'Boleto',
  mercado_pago: 'Mercado Pago',
  pagarme: 'PaggarMe',
};

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

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [newNote, setNewNote] = useState('');

  const { order, items, history, isLoading, addNote } = useOrderDetails(id);
  const { updateOrderStatus } = useOrders();

  const handleStatusChange = (status: OrderStatus) => {
    if (id) {
      updateOrderStatus.mutate({ orderId: id, status });
    }
  };

  const handleAddNote = () => {
    if (id && newNote.trim()) {
      addNote.mutate({ orderId: id, note: newNote.trim() });
      setNewNote('');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Pedido não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/orders')}>
          Voltar para Pedidos
        </Button>
      </div>
    );
  }

  const statusConfig = orderStatusConfig[order.status];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{order.order_number}</h1>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
            <p className="text-muted-foreground">
              Criado em {formatDate(order.created_at)}
            </p>
          </div>
        </div>
        <Select value={order.status} onValueChange={(v) => handleStatusChange(v as OrderStatus)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Alterar status" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(orderStatusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Itens do Pedido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg border">
                    {item.product_image_url ? (
                      <img 
                        src={item.product_image_url} 
                        alt={item.product_name}
                        className="h-16 w-16 object-cover rounded"
                      />
                    ) : (
                      <div className="h-16 w-16 bg-muted rounded flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                      <p className="text-sm text-muted-foreground">Qtd: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(item.total_price)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.unit_price)} cada
                      </p>
                    </div>
                  </div>
                ))}

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount_total > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Desconto</span>
                      <span>-{formatCurrency(order.discount_total)}</span>
                    </div>
                  )}
                  {order.shipping_total > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete</span>
                      <span>{formatCurrency(order.shipping_total)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhum histórico</p>
              ) : (
                <div className="space-y-4">
                  {history.map((entry) => (
                    <div key={entry.id} className="flex gap-4">
                      <div className="h-2 w-2 mt-2 rounded-full bg-primary shrink-0" />
                      <div>
                        <p className="text-sm">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Notas Internas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.internal_notes && (
                <div className="p-3 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                  {order.internal_notes}
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Adicionar nota..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[80px]"
                />
                <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                {order.customer_phone && (
                  <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                )}
              </div>
              {order.customer_id && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => navigate(`/customers/${order.customer_id}`)}
                >
                  Ver perfil do cliente
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Método</span>
                <span>{order.payment_method ? paymentMethodLabels[order.payment_method] : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={order.payment_status === 'approved' ? 'default' : 'secondary'}>
                  {order.payment_status === 'pending' && 'Pendente'}
                  {order.payment_status === 'processing' && 'Processando'}
                  {order.payment_status === 'approved' && 'Aprovado'}
                  {order.payment_status === 'declined' && 'Recusado'}
                  {order.payment_status === 'refunded' && 'Reembolsado'}
                  {order.payment_status === 'cancelled' && 'Cancelado'}
                </Badge>
              </div>
              {order.payment_gateway && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gateway</span>
                  <span className="capitalize">{order.payment_gateway}</span>
                </div>
              )}
              {order.paid_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pago em</span>
                  <span className="text-sm">{formatDate(order.paid_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.shipping_street ? (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="text-sm">
                    <p>{order.shipping_street}, {order.shipping_number}</p>
                    {order.shipping_complement && <p>{order.shipping_complement}</p>}
                    <p>{order.shipping_neighborhood}</p>
                    <p>{order.shipping_city} - {order.shipping_state}</p>
                    <p>{order.shipping_postal_code}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Endereço não informado</p>
              )}

              {order.tracking_code && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">Código de rastreio</p>
                  <p className="font-mono">{order.tracking_code}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer notes */}
          {order.customer_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observações do Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.customer_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
