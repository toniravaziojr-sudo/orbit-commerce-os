import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  ShoppingBag, 
  TrendingUp,
  Crown,
  Tag,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Bell,
  Package,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerNotes, useCustomerAddresses, type Customer, type CustomerNote, type CustomerAddress } from '@/hooks/useCustomers';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { toast } from 'sonner';
import { NotificationLogsPanel } from '@/components/notifications/NotificationLogsPanel';

const statusConfig = {
  active: { label: 'Ativo', variant: 'default' as const },
  inactive: { label: 'Inativo', variant: 'secondary' as const },
  blocked: { label: 'Bloqueado', variant: 'destructive' as const },
};

const tierConfig = {
  bronze: { label: 'Bronze', color: 'bg-amber-700', icon: '🥉' },
  silver: { label: 'Prata', color: 'bg-slate-400', icon: '🥈' },
  gold: { label: 'Ouro', color: 'bg-yellow-500', icon: '🥇' },
  platinum: { label: 'Platina', color: 'bg-violet-500', icon: '💎' },
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
  }).format(new Date(dateString));
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

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  const { notes, isLoading: notesLoading, createNote } = useCustomerNotes(id);
  const { addresses, isLoading: addressesLoading } = useCustomerAddresses(id);
  // Pass customer email (not id) to useCustomerOrders - the hook filters by customer_email
  const { orders, isLoading: ordersLoading } = useCustomerOrders(customer?.email);

  useEffect(() => {
    async function fetchCustomer() {
      if (!id || !currentTenant?.id) return;
      
      setIsLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching customer:', error);
        toast.error('Erro ao carregar cliente');
        navigate('/customers');
        return;
      }

      if (!data) {
        toast.error('Cliente não encontrado');
        navigate('/customers');
        return;
      }

      setCustomer(data as Customer);
      setIsLoading(false);
    }

    fetchCustomer();
  }, [id, currentTenant?.id, navigate]);

  const handleAddNote = () => {
    if (!newNote.trim() || !id) return;
    createNote.mutate({ content: newNote, customerId: id }, {
      onSuccess: () => setNewNote(''),
    });
  };

  const handleUpdateCustomer = async (data: any) => {
    if (!id) return;
    
    const { error } = await supabase
      .from('customers')
      .update(data)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar cliente');
      return;
    }

    // Refresh customer data
    const { data: updated } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (updated) {
      setCustomer(updated as Customer);
    }
    setEditOpen(false);
    toast.success('Cliente atualizado!');
  };

  if (isLoading || !customer) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
              {getInitials(customer.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{customer.full_name}</h1>
              <Badge variant={statusConfig[customer.status].variant}>
                {statusConfig[customer.status].label}
              </Badge>
              <div className="flex items-center gap-1 text-sm">
                <span>{tierConfig[customer.loyalty_tier].icon}</span>
                <span>{tierConfig[customer.loyalty_tier].label}</span>
              </div>
            </div>
            <p className="text-muted-foreground">
              Cliente desde {formatDate(customer.created_at)}
            </p>
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total de Pedidos"
          value={customer.total_orders.toString()}
          icon={ShoppingBag}
        />
        <StatCard
          title="Total Gasto"
          value={formatCurrency(customer.total_spent)}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(customer.average_ticket)}
          icon={TrendingUp}
        />
        <StatCard
          title="Pontos de Fidelidade"
          value={customer.loyalty_points.toString()}
          icon={Crown}
          variant="primary"
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{customer.email}</span>
              {customer.email_verified && (
                <Badge variant="outline" className="text-xs">Verificado</Badge>
              )}
            </div>
            {customer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{customer.phone}</span>
              </div>
            )}
            {customer.cpf && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4">CPF</span>
                <span className="text-sm">{customer.cpf}</span>
              </div>
            )}
            {customer.birth_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{formatDate(customer.birth_date)}</span>
              </div>
            )}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Preferências de Marketing</p>
              <Badge variant={customer.accepts_marketing ? 'default' : 'secondary'}>
                {customer.accepts_marketing ? 'Aceita emails' : 'Não aceita emails'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="orders" className="space-y-4">
            <TabsList>
              <TabsTrigger value="orders" className="gap-2">
                <Package className="h-4 w-4" />
                Pedidos ({orders.length})
              </TabsTrigger>
              <TabsTrigger value="addresses" className="gap-2">
                <MapPin className="h-4 w-4" />
                Endereços ({addresses.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Notas ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="h-4 w-4" />
                Notificações
              </TabsTrigger>
            </TabsList>

            {/* Orders Tab */}
            <TabsContent value="orders" className="space-y-4">
              {ordersLoading ? (
                <Skeleton className="h-32" />
              ) : orders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum pedido encontrado</p>
                  </CardContent>
                </Card>
              ) : (
                orders.map((order) => (
                  <Card key={order.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-medium">{order.order_number}</span>
                            <Badge variant={
                              order.status === 'delivered' ? 'default' :
                              order.status === 'cancelled' ? 'destructive' :
                              order.status === 'shipped' || order.status === 'in_transit' ? 'default' :
                              'secondary'
                            }>
                              {order.status === 'pending' && 'Pendente'}
                              {order.status === 'awaiting_payment' && 'Aguardando Pgto'}
                              {order.status === 'paid' && 'Pago'}
                              {order.status === 'processing' && 'Em Separação'}
                              {order.status === 'shipped' && 'Enviado'}
                              {order.status === 'in_transit' && 'Em Trânsito'}
                              {order.status === 'delivered' && 'Entregue'}
                              {order.status === 'cancelled' && 'Cancelado'}
                              {order.status === 'returned' && 'Devolvido'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(order.created_at)}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div>
                            <p className="font-medium">{formatCurrency(order.total)}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.items_count} {order.items_count === 1 ? 'item' : 'itens'}
                            </p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Addresses Tab */}
            <TabsContent value="addresses" className="space-y-4">
              {addressesLoading ? (
                <Skeleton className="h-32" />
              ) : addresses.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum endereço cadastrado</p>
                  </CardContent>
                </Card>
              ) : (
                addresses.map((address) => (
                  <Card key={address.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{address.label}</span>
                            {address.is_default && (
                              <Badge variant="outline" className="text-xs">Principal</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {address.recipient_name}
                          </p>
                          <p className="text-sm">
                            {address.street}, {address.number}
                            {address.complement && ` - ${address.complement}`}
                          </p>
                          <p className="text-sm">
                            {address.neighborhood && `${address.neighborhood}, `}
                            {address.city} - {address.state}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            CEP: {address.postal_code}
                          </p>
                          {address.reference && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Ref: {address.reference}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <Textarea
                    placeholder="Adicionar uma nota sobre este cliente..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="mb-2"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || createNote.isPending}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Nota
                  </Button>
                </CardContent>
              </Card>

              {notesLoading ? (
                <Skeleton className="h-24" />
              ) : notes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma nota adicionada</p>
                  </CardContent>
                </Card>
              ) : (
                notes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="pt-4">
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDateTime(note.created_at)}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <NotificationLogsPanel
                customerId={customer.id}
                title="Notificações do Cliente"
                emptyMessage="Nenhuma notificação registrada para este cliente"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Customer Modal */}
      <CustomerForm
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
        onSubmit={handleUpdateCustomer}
      />
    </div>
  );
}
