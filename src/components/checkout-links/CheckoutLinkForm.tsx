import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CheckoutLinkFormProps {
  link?: any | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export function CheckoutLinkForm({ link, onCancel, onSuccess }: CheckoutLinkFormProps) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!link;
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    product_id: '',
    quantity: 1,
    coupon_code: '',
    shipping_override: '',
    price_override: '',
    is_active: true,
    expires_at: '',
    additional_products: [] as { product_id: string; quantity: number }[],
    use_fixed_shipping: false,
    use_price_override: false,
  });

  useEffect(() => {
    if (link) {
      setForm({
        name: link.name || '',
        slug: link.slug || '',
        product_id: link.product_id || '',
        quantity: link.quantity || 1,
        coupon_code: link.coupon_code || '',
        shipping_override: link.shipping_override != null ? String(link.shipping_override) : '',
        price_override: link.price_override != null ? String(link.price_override) : '',
        is_active: link.is_active ?? true,
        expires_at: link.expires_at ? link.expires_at.split('T')[0] : '',
        additional_products: link.additional_products || [],
        use_fixed_shipping: link.shipping_override != null,
        use_price_override: link.price_override != null,
      });
    }
  }, [link]);

  const { data: products = [] } = useQuery({
    queryKey: ['products-simple', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, slug')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: !isEditing ? generateSlug(name) : prev.slug,
    }));
  };

  const addAdditionalProduct = () => {
    setForm((prev) => ({
      ...prev,
      additional_products: [...prev.additional_products, { product_id: '', quantity: 1 }],
    }));
  };

  const removeAdditionalProduct = (index: number) => {
    setForm((prev) => ({
      ...prev,
      additional_products: prev.additional_products.filter((_, i) => i !== index),
    }));
  };

  const updateAdditionalProduct = (index: number, field: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      additional_products: prev.additional_products.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }));
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    if (!form.name.trim() || !form.slug.trim() || !form.product_id) {
      toast.error('Preencha nome, slug e produto principal');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        tenant_id: currentTenant.id,
        name: form.name.trim(),
        slug: form.slug.trim(),
        product_id: form.product_id,
        quantity: form.quantity,
        coupon_code: form.coupon_code.trim() || null,
        shipping_override: form.use_fixed_shipping && form.shipping_override ? Number(form.shipping_override) : null,
        price_override: form.use_price_override && form.price_override ? Number(form.price_override) : null,
        is_active: form.is_active,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        additional_products: form.additional_products.filter((p) => p.product_id),
      };

      if (isEditing) {
        const { error } = await supabase.from('checkout_links').update(payload).eq('id', link.id);
        if (error) throw error;
        toast.success('Link atualizado!');
      } else {
        const { error } = await supabase.from('checkout_links').insert(payload);
        if (error) throw error;
        toast.success('Link criado!');
      }

      queryClient.invalidateQueries({ queryKey: ['checkout-links'] });
      onSuccess();
    } catch (error: any) {
      console.error('Error saving checkout link:', error);
      if (error?.message?.includes('unique')) {
        toast.error('Já existe um link com este slug');
      } else {
        toast.error('Erro ao salvar link');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const availableProducts = products.filter(
    (p) => p.id !== form.product_id && !form.additional_products.some((ap) => ap.product_id === p.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{isEditing ? 'Editar Link' : 'Novo Link de Checkout'}</h2>
          <p className="text-sm text-muted-foreground">Configure o link personalizado para o checkout</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Identificação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Link *</Label>
              <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ex: Promoção de Verão" />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="promo-verao" className="font-mono" />
              <p className="text-xs text-muted-foreground">Identificador único do link na URL</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
            </div>
            <div className="space-y-2">
              <Label>Data de expiração (opcional)</Label>
              <Input type="date" value={form.expires_at} onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {/* Product Selection */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Produto Principal</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Produto *</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm((p) => ({ ...p, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — R$ {p.price.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
            </div>
            <div className="space-y-2">
              <Label>Cupom de desconto (opcional)</Label>
              <Input value={form.coupon_code} onChange={(e) => setForm((p) => ({ ...p, coupon_code: e.target.value }))} placeholder="CUPOM10" className="font-mono uppercase" />
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Shipping */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Preço e Frete</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Alterar preço final</Label>
              <Switch checked={form.use_price_override} onCheckedChange={(v) => setForm((p) => ({ ...p, use_price_override: v }))} />
            </div>
            {form.use_price_override && (
              <div className="space-y-2">
                <Label>Preço final (R$)</Label>
                <Input type="number" min={0} step="0.01" value={form.price_override} onChange={(e) => setForm((p) => ({ ...p, price_override: e.target.value }))} placeholder="99.90" />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Frete fixo</Label>
              <Switch checked={form.use_fixed_shipping} onCheckedChange={(v) => setForm((p) => ({ ...p, use_fixed_shipping: v }))} />
            </div>
            {form.use_fixed_shipping && (
              <div className="space-y-2">
                <Label>Valor do frete (R$)</Label>
                <Input type="number" min={0} step="0.01" value={form.shipping_override} onChange={(e) => setForm((p) => ({ ...p, shipping_override: e.target.value }))} placeholder="0.00 = frete grátis" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Products */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Produtos Opcionais</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addAdditionalProduct} disabled={availableProducts.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.additional_products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto adicional</p>
            ) : (
              form.additional_products.map((ap, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Produto</Label>
                    <Select value={ap.product_id} onValueChange={(v) => updateAdditionalProduct(index, 'product_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {products
                          .filter((p) => p.id !== form.product_id && (p.id === ap.product_id || !form.additional_products.some((x) => x.product_id === p.id)))
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-xs">Qtd</Label>
                    <Input type="number" min={1} value={ap.quantity} onChange={(e) => updateAdditionalProduct(index, 'quantity', parseInt(e.target.value) || 1)} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeAdditionalProduct(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {isEditing ? 'Salvar' : 'Criar Link'}
        </Button>
      </div>
    </div>
  );
}
