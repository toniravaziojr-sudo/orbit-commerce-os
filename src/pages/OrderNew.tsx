import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search } from 'lucide-react';
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
import { useOrders, type CreateOrderData, type PaymentMethod } from '@/hooks/useOrders';
import { useProductsWithImages } from '@/hooks/useProducts';
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
  const { products } = useProductsWithImages();

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    payment_method: '' as PaymentMethod | '',
    shipping_street: '',
    shipping_number: '',
    shipping_complement: '',
    shipping_neighborhood: '',
    shipping_city: '',
    shipping_state: '',
    shipping_postal_code: '',
    customer_notes: '',
  });

  const [items, setItems] = useState<OrderItemForm[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  );

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
  const total = subtotal - discountTotal;

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
      customer_name: formData.customer_name,
      customer_email: formData.customer_email,
      customer_phone: formData.customer_phone || null,
      payment_method: formData.payment_method || null,
      shipping_street: formData.shipping_street || null,
      shipping_number: formData.shipping_number || null,
      shipping_complement: formData.shipping_complement || null,
      shipping_neighborhood: formData.shipping_neighborhood || null,
      shipping_city: formData.shipping_city || null,
      shipping_state: formData.shipping_state || null,
      shipping_postal_code: formData.shipping_postal_code || null,
      customer_notes: formData.customer_notes || null,
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
            <CardTitle>Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Nome *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
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
              <Input
                id="shipping_postal_code"
                value={formData.shipping_postal_code}
                onChange={(e) => setFormData({ ...formData, shipping_postal_code: e.target.value })}
              />
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
                  {filteredProducts.slice(0, 10).map(product => (
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
            <div className="space-y-2">
              <Label htmlFor="customer_notes">Observações do Cliente</Label>
              <Textarea
                id="customer_notes"
                value={formData.customer_notes}
                onChange={(e) => setFormData({ ...formData, customer_notes: e.target.value })}
                placeholder="Observações ou instruções especiais..."
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
