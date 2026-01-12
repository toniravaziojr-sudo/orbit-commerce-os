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
  Save,
  X,
  Building2,
  User
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerNotes, useCustomerAddresses, type Customer, type CustomerNote, type CustomerAddress } from '@/hooks/useCustomers';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { CustomerAddressForm } from '@/components/customers/CustomerAddressForm';
import { toast } from 'sonner';
import { NotificationLogsPanel } from '@/components/notifications/NotificationLogsPanel';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  active: { label: 'Ativo', variant: 'default' },
  inactive: { label: 'Inativo', variant: 'secondary' },
  blocked: { label: 'Bloqueado', variant: 'destructive' },
};

const tierConfig: Record<string, { label: string; color: string; icon: string }> = {
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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Customer>>({});
  const [newNote, setNewNote] = useState('');
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [deleteAddressId, setDeleteAddressId] = useState<string | null>(null);
  
  const { notes, isLoading: notesLoading, createNote } = useCustomerNotes(id);
  const { addresses, isLoading: addressesLoading, createAddress, deleteAddress } = useCustomerAddresses(id);
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
      setEditData(data as Customer);
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

  const handleStartEdit = () => {
    setEditData(customer || {});
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditData(customer || {});
    setIsEditing(false);
  };

  const handleSaveCustomer = async () => {
    if (!id || !customer) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          full_name: editData.full_name,
          email: editData.email,
          phone: editData.phone,
          cpf: editData.cpf,
          birth_date: editData.birth_date,
          gender: editData.gender,
          status: editData.status,
          person_type: editData.person_type,
          cnpj: editData.cnpj,
          company_name: editData.company_name,
          ie: editData.ie,
          rg: editData.rg,
          accepts_marketing: editData.accepts_marketing,
          accepts_email_marketing: editData.accepts_email_marketing,
          accepts_sms_marketing: editData.accepts_sms_marketing,
          accepts_whatsapp_marketing: editData.accepts_whatsapp_marketing,
          notes: editData.notes,
        })
        .eq('id', id);

      if (error) throw error;

      // Refresh customer data
      const { data: updated } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (updated) {
        setCustomer(updated as Customer);
        setEditData(updated as Customer);
      }
      setIsEditing(false);
      toast.success('Cliente atualizado!');
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      toast.error('Erro ao atualizar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAddress = (data: Omit<CustomerAddress, 'id' | 'created_at' | 'updated_at'>) => {
    createAddress.mutate(data, {
      onSuccess: () => {
        setAddressFormOpen(false);
        setEditingAddress(null);
      },
    });
  };

  const handleDeleteAddress = () => {
    if (!deleteAddressId) return;
    deleteAddress.mutate(deleteAddressId, {
      onSuccess: () => setDeleteAddressId(null),
    });
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
              <Badge variant={statusConfig[customer.status ?? 'active']?.variant ?? 'secondary'}>
                {statusConfig[customer.status ?? 'active']?.label ?? customer.status ?? 'Sem status'}
              </Badge>
              {customer.loyalty_tier && tierConfig[customer.loyalty_tier] && (
                <div className="flex items-center gap-1 text-sm">
                  <span>{tierConfig[customer.loyalty_tier].icon}</span>
                  <span>{tierConfig[customer.loyalty_tier].label}</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground">
              Cliente desde {customer.first_order_at 
                ? formatDate(customer.first_order_at) 
                : formatDate(customer.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSaveCustomer} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </>
          ) : (
            <Button onClick={handleStartEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total de Pedidos"
          value={(customer.total_orders ?? 0).toString()}
          icon={ShoppingBag}
        />
        <StatCard
          title="Total Gasto"
          value={formatCurrency(customer.total_spent ?? 0)}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(customer.average_ticket ?? 0)}
          icon={TrendingUp}
        />
        <StatCard
          title="Pontos de Fidelidade"
          value={(customer.loyalty_points ?? 0).toString()}
          icon={Crown}
          variant="primary"
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Customer Info Card - Editable */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {editData.person_type === 'pj' ? (
                <Building2 className="h-5 w-5" />
              ) : (
                <User className="h-5 w-5" />
              )}
              Informações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input 
                    value={editData.full_name ?? ''} 
                    onChange={(e) => setEditData({...editData, full_name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={editData.email ?? ''} 
                    onChange={(e) => setEditData({...editData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input 
                    value={editData.phone ?? ''} 
                    onChange={(e) => setEditData({...editData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Pessoa</Label>
                  <Select 
                    value={editData.person_type ?? 'pf'} 
                    onValueChange={(v) => setEditData({...editData, person_type: v as 'pf' | 'pj'})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pf">Pessoa Física</SelectItem>
                      <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editData.person_type === 'pj' ? (
                  <>
                    <div className="space-y-2">
                      <Label>CNPJ</Label>
                      <Input 
                        value={editData.cnpj ?? ''} 
                        onChange={(e) => setEditData({...editData, cnpj: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Razão Social</Label>
                      <Input 
                        value={editData.company_name ?? ''} 
                        onChange={(e) => setEditData({...editData, company_name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Inscrição Estadual</Label>
                      <Input 
                        value={editData.ie ?? ''} 
                        onChange={(e) => setEditData({...editData, ie: e.target.value})}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Input 
                        value={editData.cpf ?? ''} 
                        onChange={(e) => setEditData({...editData, cpf: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>RG</Label>
                      <Input 
                        value={editData.rg ?? ''} 
                        onChange={(e) => setEditData({...editData, rg: e.target.value})}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input 
                    type="date"
                    value={editData.birth_date ?? ''} 
                    onChange={(e) => setEditData({...editData, birth_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={editData.status ?? 'active'} 
                    onValueChange={(v) => setEditData({...editData, status: v as 'active' | 'inactive' | 'blocked'})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-base font-medium">Preferências de Marketing</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Aceita Email</span>
                    <Switch 
                      checked={editData.accepts_email_marketing ?? true}
                      onCheckedChange={(v) => setEditData({...editData, accepts_email_marketing: v})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Aceita SMS</span>
                    <Switch 
                      checked={editData.accepts_sms_marketing ?? false}
                      onCheckedChange={(v) => setEditData({...editData, accepts_sms_marketing: v})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Aceita WhatsApp</span>
                    <Switch 
                      checked={editData.accepts_whatsapp_marketing ?? false}
                      onCheckedChange={(v) => setEditData({...editData, accepts_whatsapp_marketing: v})}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Observações internas</Label>
                  <Textarea 
                    value={editData.notes ?? ''} 
                    onChange={(e) => setEditData({...editData, notes: e.target.value})}
                    rows={3}
                    placeholder="Notas sobre o cliente..."
                  />
                </div>
              </>
            ) : (
              <>
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
                {customer.person_type === 'pj' ? (
                  <>
                    {customer.cnpj && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-8">CNPJ</span>
                        <span className="text-sm">{customer.cnpj}</span>
                      </div>
                    )}
                    {customer.company_name && (
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{customer.company_name}</span>
                      </div>
                    )}
                    {customer.ie && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-8">IE</span>
                        <span className="text-sm">{customer.ie}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {customer.cpf && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-8">CPF</span>
                        <span className="text-sm">{customer.cpf}</span>
                      </div>
                    )}
                    {customer.rg && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-8">RG</span>
                        <span className="text-sm">{customer.rg}</span>
                      </div>
                    )}
                  </>
                )}
                {customer.birth_date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatDate(customer.birth_date)}</span>
                  </div>
                )}
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Preferências de Marketing</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={customer.accepts_email_marketing ? 'default' : 'secondary'}>
                      {customer.accepts_email_marketing ? '✓ Email' : '✗ Email'}
                    </Badge>
                    <Badge variant={customer.accepts_sms_marketing ? 'default' : 'secondary'}>
                      {customer.accepts_sms_marketing ? '✓ SMS' : '✗ SMS'}
                    </Badge>
                    <Badge variant={customer.accepts_whatsapp_marketing ? 'default' : 'secondary'}>
                      {customer.accepts_whatsapp_marketing ? '✓ WhatsApp' : '✗ WhatsApp'}
                    </Badge>
                  </div>
                </div>
                {customer.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
                  </div>
                )}
              </>
            )}
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
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { setEditingAddress(null); setAddressFormOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Endereço
                </Button>
              </div>
              {addressesLoading ? (
                <Skeleton className="h-32" />
              ) : addresses.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum endereço cadastrado</p>
                    <Button 
                      variant="link" 
                      className="mt-2"
                      onClick={() => { setEditingAddress(null); setAddressFormOpen(true); }}
                    >
                      Adicionar primeiro endereço
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                addresses.map((address) => (
                  <Card key={address.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{address.label}</span>
                            {address.is_default && (
                              <Badge variant="outline" className="text-xs">Principal</Badge>
                            )}
                            {address.address_type && (
                              <Badge variant="secondary" className="text-xs">
                                {address.address_type === 'residential' ? 'Residencial' : 
                                 address.address_type === 'commercial' ? 'Comercial' : 'Outro'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {address.recipient_name}
                            {address.recipient_phone && ` • ${address.recipient_phone}`}
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
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setDeleteAddressId(address.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {/* Address Form Modal */}
      <CustomerAddressForm
        open={addressFormOpen}
        onOpenChange={setAddressFormOpen}
        address={editingAddress}
        customerId={id || ''}
        onSubmit={handleAddAddress}
        isLoading={createAddress.isPending}
      />

      {/* Delete Address Confirmation */}
      <AlertDialog open={!!deleteAddressId} onOpenChange={(open) => !open && setDeleteAddressId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir endereço?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O endereço será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAddress} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
