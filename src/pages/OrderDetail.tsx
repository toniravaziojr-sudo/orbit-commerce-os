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
  Send,
  Save,
  ExternalLink,
  Bell,
  Pencil,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOrderDetails, useOrders } from '@/hooks/useOrders';
import { 
  OrderStatus, 
  PaymentStatus, 
  ShippingStatus,
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  SHIPPING_STATUS_CONFIG,
} from '@/types/orderStatus';
import { ShipmentSection } from '@/components/orders/ShipmentSection';
import { NotificationLogsPanel } from '@/components/notifications/NotificationLogsPanel';

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
  const [trackingCode, setTrackingCode] = useState('');
  const [isEditingTracking, setIsEditingTracking] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressData, setAddressData] = useState({
    shipping_street: '',
    shipping_number: '',
    shipping_complement: '',
    shipping_neighborhood: '',
    shipping_city: '',
    shipping_state: '',
    shipping_postal_code: '',
  });

  const { order, items, history, isLoading, addNote, updateTrackingCode, updatePaymentStatus, updateShippingAddress, updateShippingStatus } = useOrderDetails(id);
  const { updateOrderStatus } = useOrders();

  const handleStatusChange = (status: OrderStatus) => {
    if (id) {
      updateOrderStatus.mutate({ orderId: id, status });
    }
  };

  const handleShippingStatusChange = (status: ShippingStatus) => {
    if (id) {
      updateShippingStatus.mutate({ orderId: id, shippingStatus: status });
    }
  };

  const handlePaymentStatusChange = (status: PaymentStatus) => {
    if (id) {
      updatePaymentStatus.mutate({ orderId: id, paymentStatus: status });
    }
  };

  const handleAddNote = () => {
    if (id && newNote.trim()) {
      addNote.mutate({ orderId: id, note: newNote.trim() });
      setNewNote('');
    }
  };

  const handleSaveTracking = () => {
    if (id && trackingCode.trim()) {
      updateTrackingCode.mutate({ orderId: id, trackingCode: trackingCode.trim() });
      setIsEditingTracking(false);
    }
  };

  const startEditTracking = () => {
    setTrackingCode(order?.tracking_code || '');
    setIsEditingTracking(true);
  };

  const startEditAddress = () => {
    setAddressData({
      shipping_street: order?.shipping_street || '',
      shipping_number: order?.shipping_number || '',
      shipping_complement: order?.shipping_complement || '',
      shipping_neighborhood: order?.shipping_neighborhood || '',
      shipping_city: order?.shipping_city || '',
      shipping_state: order?.shipping_state || '',
      shipping_postal_code: order?.shipping_postal_code || '',
    });
    setIsEditingAddress(true);
  };

  const handleSaveAddress = () => {
    if (id) {
      updateShippingAddress.mutate({ orderId: id, address: addressData });
      setIsEditingAddress(false);
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

  const orderStatusCfg = ORDER_STATUS_CONFIG[order.status as OrderStatus] || ORDER_STATUS_CONFIG.pending;

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
              <Badge variant={orderStatusCfg.variant}>{orderStatusCfg.label}</Badge>
            </div>
            <p className="text-muted-foreground">
              Criado em {formatDate(order.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={order.status} onValueChange={(v) => handleStatusChange(v as OrderStatus)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Alterar status" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ORDER_STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  {cfg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details" className="gap-2">
            <Package className="h-4 w-4" />
            Detalhes
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
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
              {order.customer_id ? (
                <button 
                  onClick={() => navigate(`/customers/${order.customer_id}`)}
                  className="text-left w-full hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors group"
                >
                  <p className="font-medium group-hover:text-primary transition-colors">
                    {order.customer_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                  {order.customer_phone && (
                    <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                  )}
                  {order.customer_cpf && (
                    <p className="text-sm text-muted-foreground">CPF/CNPJ: {order.customer_cpf}</p>
                  )}
                  <span className="text-xs text-primary flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="h-3 w-3" />
                    Ver cadastro completo
                  </span>
                </button>
              ) : (
                <div>
                  <p className="font-medium">{order.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                  {order.customer_phone && (
                    <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                  )}
                  {order.customer_cpf && (
                    <p className="text-sm text-muted-foreground">CPF/CNPJ: {order.customer_cpf}</p>
                  )}
                  <p className="text-xs text-muted-foreground italic mt-2">
                    Cliente não cadastrado
                  </p>
                </div>
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
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Select 
                  value={order.payment_status} 
                  onValueChange={(v) => handlePaymentStatusChange(v as PaymentStatus)}
                >
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

          {/* Shipments Section with Shipping Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Remessa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status de Envio</span>
                <Select 
                  value={order.shipping_status} 
                  onValueChange={(v) => handleShippingStatusChange(v as ShippingStatus)}
                >
                  <SelectTrigger className="w-44 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SHIPPING_STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {order.shipped_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Enviado em</span>
                  <span className="text-sm">{formatDate(order.shipped_at)}</span>
                </div>
              )}
              {order.delivered_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entregue em</span>
                  <span className="text-sm text-green-600">{formatDate(order.delivered_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipments Tracking Details */}
          <ShipmentSection 
            orderId={order.id} 
            orderTrackingCode={order.tracking_code}
            orderCarrier={order.shipping_carrier}
          />

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Endereço de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.shipping_carrier && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transportadora</span>
                  <span>{order.shipping_carrier}</span>
                </div>
              )}
              {order.shipping_service_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço</span>
                  <span>{order.shipping_service_name}</span>
                </div>
              )}
              {order.shipping_estimated_days && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prazo estimado</span>
                  <span>{order.shipping_estimated_days} dias úteis</span>
                </div>
              )}
              
              {/* Tracking Code - Editable (legado, mantido para compatibilidade) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Código de Rastreio</span>
                  {!isEditingTracking && order.tracking_code && (
                    <a 
                      href={`https://www.google.com/search?q=${order.tracking_code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                
                {isEditingTracking ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite o código de rastreio"
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleSaveTracking}
                      disabled={!trackingCode.trim() || updateTrackingCode.isPending}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setIsEditingTracking(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    {order.tracking_code ? (
                      <span className="font-mono text-sm bg-muted px-2 py-1 rounded flex-1">
                        {order.tracking_code}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm flex-1">
                        Não informado
                      </span>
                    )}
                    <Button size="sm" variant="outline" onClick={startEditTracking}>
                      {order.tracking_code ? 'Editar' : 'Adicionar'}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />
              <div className="flex items-start justify-between gap-2">
                {order.shipping_street ? (
                  <div className="flex items-start gap-2 flex-1">
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
                  <p className="text-muted-foreground text-sm flex-1">Endereço não informado</p>
                )}
                <Button size="sm" variant="outline" onClick={startEditAddress}>
                  <Pencil className="h-4 w-4 mr-1" />
                  {order.shipping_street ? 'Editar' : 'Adicionar'}
                </Button>
              </div>
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
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationLogsPanel
            orderId={order.id}
            title="Notificações do Pedido"
            emptyMessage="Nenhuma notificação registrada para este pedido"
          />
        </TabsContent>
      </Tabs>

      {/* Address Edit Modal */}
      <Dialog open={isEditingAddress} onOpenChange={setIsEditingAddress}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Editar Endereço de Entrega
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Rua/Logradouro</Label>
                <Input 
                  value={addressData.shipping_street} 
                  onChange={(e) => setAddressData({...addressData, shipping_street: e.target.value})}
                  placeholder="Rua, Avenida, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input 
                  value={addressData.shipping_number} 
                  onChange={(e) => setAddressData({...addressData, shipping_number: e.target.value})}
                  placeholder="123"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input 
                value={addressData.shipping_complement} 
                onChange={(e) => setAddressData({...addressData, shipping_complement: e.target.value})}
                placeholder="Apto, Bloco, Sala, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input 
                value={addressData.shipping_neighborhood} 
                onChange={(e) => setAddressData({...addressData, shipping_neighborhood: e.target.value})}
                placeholder="Bairro"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Cidade</Label>
                <Input 
                  value={addressData.shipping_city} 
                  onChange={(e) => setAddressData({...addressData, shipping_city: e.target.value})}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input 
                  value={addressData.shipping_state} 
                  onChange={(e) => setAddressData({...addressData, shipping_state: e.target.value})}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input 
                value={addressData.shipping_postal_code} 
                onChange={(e) => setAddressData({...addressData, shipping_postal_code: e.target.value})}
                placeholder="00000-000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingAddress(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSaveAddress} disabled={updateShippingAddress.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateShippingAddress.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
