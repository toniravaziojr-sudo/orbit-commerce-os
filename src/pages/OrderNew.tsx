import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search, UserCheck, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useOrders, type CreateOrderData, type PaymentMethod } from '@/hooks/useOrders';
import { useProductsWithImages } from '@/hooks/useProducts';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers, useCustomerAddresses } from '@/hooks/useCustomers';
import { useCepLookup } from '@/hooks/useCepLookup';
import { OrderShippingMethod } from '@/components/orders/OrderShippingMethod';
import { toast } from 'sonner';

interface OrderItemForm {
  product_id: string;
  sku: string;
  product_name: string;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
}

export default function OrderNew() {
  const navigate = useNavigate();
  const { createOrder } = useOrders();
  const { products: activeProducts, isLoading: productsLoading } = useProductsWithImages();
  const { products: allProducts, isLoading: allProductsLoading } = useProducts();
  const { customers, isLoading: customersLoading } = useCustomers({ pageSize: 500 });
  const { lookupCep, isLoading: isLookingUpCep } = useCepLookup();

  // Use all products if active products are empty (fallback)
  const products = activeProducts.length > 0 ? activeProducts : allProducts.map(p => ({
    ...p,
    primary_image_url: null,
  }));

  const [useExistingCustomer, setUseExistingCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_cpf: '',
    person_type: 'pf' as 'pf' | 'pj',
    payment_method: '' as PaymentMethod | '',
    shipping_street: '',
    shipping_number: '',
    shipping_complement: '',
    shipping_neighborhood: '',
    shipping_city: '',
    shipping_state: '',
    shipping_postal_code: '',
    customer_notes: '',
    internal_notes: '',
    // Shipping method fields
    shipping_method: '' as '' | 'correios' | 'transportadora' | 'retirada' | 'motoboy' | 'proprio',
    shipping_carrier: '',
    shipping_tracking_code: '',
    shipping_cost: 0,
  });

  const [items, setItems] = useState<OrderItemForm[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    const searchLower = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.full_name.toLowerCase().includes(searchLower) ||
      c.email.toLowerCase().includes(searchLower) ||
      c.phone?.toLowerCase().includes(searchLower)
    ).slice(0, 10);
  }, [customers, customerSearch]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!productSearch) return [];
    const searchLower = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.sku?.toLowerCase().includes(searchLower)
    ).slice(0, 10);
  }, [products, productSearch]);

  // Fetch customer addresses when customer is selected
  const { addresses: customerAddresses } = useCustomerAddresses(selectedCustomerId || undefined);

  // Effect to fill address when customer is selected
  useEffect(() => {
    if (selectedCustomerId && customerAddresses.length > 0) {
      const defaultAddress = customerAddresses.find(a => a.is_default) || customerAddresses[0];
      if (defaultAddress) {
        setFormData(prev => ({
          ...prev,
          shipping_street: defaultAddress.street,
          shipping_number: defaultAddress.number,
          shipping_complement: defaultAddress.complement || '',
          shipping_neighborhood: defaultAddress.neighborhood,
          shipping_city: defaultAddress.city,
          shipping_state: defaultAddress.state,
          shipping_postal_code: defaultAddress.postal_code,
        }));
      }
    }
  }, [selectedCustomerId, customerAddresses]);

  const handleSelectCustomer = (customer: typeof customers[0]) => {
    setSelectedCustomerId(customer.id);
    setFormData(prev => ({
      ...prev,
      customer_name: customer.full_name,
      customer_email: customer.email,
      customer_phone: customer.phone || '',
      customer_cpf: customer.cpf || '',
      person_type: customer.person_type || 'pf',
    }));
    setCustomerSearch('');
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId('');
    setFormData(prev => ({
      ...prev,
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_cpf: '',
      person_type: 'pf',
      shipping_street: '',
      shipping_number: '',
      shipping_complement: '',
      shipping_neighborhood: '',
      shipping_city: '',
      shipping_state: '',
      shipping_postal_code: '',
    }));
  };

  const handleCepLookup = async () => {
    const cep = formData.shipping_postal_code;
    const result = await lookupCep(cep);
    
    if (result) {
      setFormData(prev => ({
        ...prev,
        shipping_street: result.street,
        shipping_neighborhood: result.neighborhood,
        shipping_city: result.city,
        shipping_state: result.state,
      }));
      toast.success('Endereço encontrado!');
    } else {
      toast.error('CEP não encontrado');
    }
  };

  const handleAddProduct = (product: typeof products[0]) => {
    const existingIndex = items.findIndex(i => i.product_id === product.id);
    
    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      setItems(newItems);
    } else {
      setItems([...items, {
        product_id: product.id,
        sku: product.sku || '',
        product_name: product.name,
        product_image_url: product.primary_image_url || null,
        quantity: 1,
        unit_price: product.price,
        discount_amount: 0,
      }]);
    }
    setProductSearch('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof OrderItemForm, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const discountTotal = items.reduce((sum, item) => sum + (item.discount_amount * item.quantity), 0);
  const shippingCost = formData.shipping_cost || 0;
  const total = subtotal - discountTotal + shippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_name || !formData.customer_email) {
      toast.error('Preencha o nome e email do cliente');
      return;
    }

    if (items.length === 0) {
      toast.error('Adicione pelo menos um produto');
      return;
    }

    const orderData: CreateOrderData = {
      customer_id: selectedCustomerId || null,
      customer_name: formData.customer_name,
      customer_email: formData.customer_email,
      customer_phone: formData.customer_phone || null,
      customer_cpf: formData.customer_cpf || null,
      payment_method: formData.payment_method || null,
      shipping_street: formData.shipping_street || null,
      shipping_number: formData.shipping_number || null,
      shipping_complement: formData.shipping_complement || null,
      shipping_neighborhood: formData.shipping_neighborhood || null,
      shipping_city: formData.shipping_city || null,
      shipping_state: formData.shipping_state || null,
      shipping_postal_code: formData.shipping_postal_code || null,
      customer_notes: formData.customer_notes || null,
      internal_notes: formData.internal_notes || null,
      items: items.map(item => ({
        product_id: item.product_id,
        sku: item.sku,
        product_name: item.product_name,
        product_image_url: item.product_image_url,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
      })),
    };

    createOrder.mutate(orderData, {
      onSuccess: (order) => {
        navigate(`/orders/${order.id}`);
      },
    });
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Novo Pedido"
        description="Criar pedido manual"
        actions={
          <Button variant="outline" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        {/* Customer Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dados do Cliente</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="use-existing" className="text-sm text-muted-foreground cursor-pointer">
                  Selecionar cliente existente
                </Label>
                <Switch 
                  id="use-existing"
                  checked={useExistingCustomer}
                  onCheckedChange={(checked) => {
                    setUseExistingCustomer(checked);
                    if (!checked) handleClearCustomer();
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer Search */}
            {useExistingCustomer && (
              <div className="relative">
                {selectedCustomer ? (
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                    <UserCheck className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{selectedCustomer.full_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedCustomer.email}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={handleClearCustomer}>
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <>
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente por nome, email ou telefone..."
                      className="pl-9"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                    {customerSearch && filteredCustomers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredCustomers.map(customer => (
                          <button
                            key={customer.id}
                            type="button"
                            className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{customer.full_name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {customer.email} {customer.phone && `• ${customer.phone}`}
                              </p>
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                    {customerSearch && filteredCustomers.length === 0 && !customersLoading && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg p-4 text-center text-muted-foreground">
                        Nenhum cliente encontrado
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Customer Form Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Nome *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  required
                  disabled={useExistingCustomer && !!selectedCustomerId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_email">Email *</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  required
                  disabled={useExistingCustomer && !!selectedCustomerId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_phone">Telefone</Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="person_type">Tipo de Pessoa</Label>
                <Select
                  value={formData.person_type}
                  onValueChange={(value) => setFormData({ ...formData, person_type: value as 'pf' | 'pj' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pf">Pessoa Física</SelectItem>
                    <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_cpf">
                  {formData.person_type === 'pj' ? 'CNPJ' : 'CPF'}
                </Label>
                <Input
                  id="customer_cpf"
                  value={formData.customer_cpf}
                  onChange={(e) => setFormData({ ...formData, customer_cpf: e.target.value })}
                  placeholder={formData.person_type === 'pj' ? '00.000.000/0001-00' : '000.000.000-00'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_method">Método de Pagamento</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value as PaymentMethod })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Desconto</span>
              <span className="text-destructive">- R$ {discountTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Frete</span>
              <span>R$ {shippingCost.toFixed(2)}</span>
            </div>
            <div className="border-t pt-4 flex justify-between font-semibold">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={createOrder.isPending || items.length === 0}
            >
              {createOrder.isPending ? 'Criando...' : 'Criar Pedido'}
            </Button>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Endereço de Entrega</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shipping_postal_code">CEP</Label>
              <div className="flex gap-2">
                <Input
                  id="shipping_postal_code"
                  value={formData.shipping_postal_code}
                  onChange={(e) => setFormData({ ...formData, shipping_postal_code: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCepLookup}
                  disabled={isLookingUpCep}
                >
                  {isLookingUpCep ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="shipping_street">Rua</Label>
              <Input
                id="shipping_street"
                value={formData.shipping_street}
                onChange={(e) => setFormData({ ...formData, shipping_street: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping_number">Número</Label>
              <Input
                id="shipping_number"
                value={formData.shipping_number}
                onChange={(e) => setFormData({ ...formData, shipping_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping_complement">Complemento</Label>
              <Input
                id="shipping_complement"
                value={formData.shipping_complement}
                onChange={(e) => setFormData({ ...formData, shipping_complement: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping_neighborhood">Bairro</Label>
              <Input
                id="shipping_neighborhood"
                value={formData.shipping_neighborhood}
                onChange={(e) => setFormData({ ...formData, shipping_neighborhood: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping_city">Cidade</Label>
              <Input
                id="shipping_city"
                value={formData.shipping_city}
                onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping_state">Estado</Label>
              <Input
                id="shipping_state"
                value={formData.shipping_state}
                onChange={(e) => setFormData({ ...formData, shipping_state: e.target.value })}
                maxLength={2}
                placeholder="SP"
              />
            </div>
          </CardContent>
        </Card>

        {/* Shipping Method */}
        <OrderShippingMethod
          address={{
            postal_code: formData.shipping_postal_code,
            street: formData.shipping_street,
            number: formData.shipping_number,
            city: formData.shipping_city,
            state: formData.shipping_state,
          }}
          items={items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }))}
          value={{
            shipping_method: formData.shipping_method,
            shipping_carrier: formData.shipping_carrier,
            shipping_cost: formData.shipping_cost,
          }}
          onChange={(data) => setFormData(prev => ({
            ...prev,
            shipping_method: data.shipping_method as typeof prev.shipping_method,
            shipping_carrier: data.shipping_carrier,
            shipping_cost: data.shipping_cost,
          }))}
        />

        {/* Products */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome ou SKU..."
                className="pl-9"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              {productSearch && filteredProducts.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      type="button"
                      className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3"
                      onClick={() => handleAddProduct(product)}
                    >
                      {product.primary_image_url && (
                        <img src={product.primary_image_url} alt="" className="w-10 h-10 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.sku} • R$ {product.price.toFixed(2)}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              {productSearch && filteredProducts.length === 0 && !productsLoading && !allProductsLoading && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg p-4 text-center text-muted-foreground">
                  Nenhum produto encontrado. Verifique se há produtos cadastrados.
                </div>
              )}
            </div>

            {/* Items List */}
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum produto adicionado. Busque e adicione produtos acima.
              </p>
            ) : (
              <div className="border rounded-lg divide-y">
                {items.map((item, index) => (
                  <div key={index} className="p-4 flex items-center gap-4">
                    {item.product_image_url && (
                      <img 
                        src={item.product_image_url} 
                        alt="" 
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Preço</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Desc.</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.discount_amount}
                          onChange={(e) => handleItemChange(index, 'discount_amount', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </div>
                      <div className="text-right min-w-[80px]">
                        <p className="text-sm text-muted-foreground">Subtotal</p>
                        <p className="font-medium">
                          R$ {((item.unit_price - item.discount_amount) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer_notes">Observações do Cliente</Label>
                <Textarea
                  id="customer_notes"
                  value={formData.customer_notes}
                  onChange={(e) => setFormData({ ...formData, customer_notes: e.target.value })}
                  placeholder="Observações ou instruções especiais do cliente..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internal_notes">Notas Internas</Label>
                <Textarea
                  id="internal_notes"
                  value={formData.internal_notes}
                  onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                  placeholder="Notas internas (não visíveis ao cliente)..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
