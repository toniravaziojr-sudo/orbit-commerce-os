import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCepLookup } from '@/hooks/useCepLookup';
import { toast } from 'sonner';
import { sanitizeCep, formatCepDisplay } from '@/lib/cepUtils';
import { formatCpf, extractCpfDigits } from '@/lib/formatCpf';

interface DraftShipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId?: string | null; // null/undefined = criar novo
  onSaved?: () => void;
}

interface FormState {
  carrier: string;
  service_name: string;
  service_code: string;
  weight_grams: string;
  height_cm: string;
  width_cm: string;
  depth_cm: string;
  declared_value: string;
  recipient_name: string;
  recipient_doc: string;
  recipient_phone: string;
  recipient_email: string;
  shipping_street: string;
  shipping_number: string;
  shipping_complement: string;
  shipping_neighborhood: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  notes: string;
}

interface SenderInfo {
  name: string;
  doc: string;
  phone: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
}

const EMPTY: FormState = {
  carrier: 'correios',
  service_name: 'PAC',
  service_code: '03298',
  weight_grams: '',
  height_cm: '',
  width_cm: '',
  depth_cm: '',
  declared_value: '',
  recipient_name: '',
  recipient_doc: '',
  recipient_phone: '',
  recipient_email: '',
  shipping_street: '',
  shipping_number: '',
  shipping_complement: '',
  shipping_neighborhood: '',
  shipping_city: '',
  shipping_state: '',
  shipping_zip: '',
  notes: '',
};

const CARRIER_OPTIONS = ['correios', 'loggi', 'frenet', 'manual'];

const CORREIOS_SERVICES: Array<{ code: string; name: string }> = [
  { code: '03298', name: 'PAC' },
  { code: '03220', name: 'SEDEX' },
  { code: '04510', name: 'PAC Contrato' },
  { code: '04014', name: 'SEDEX Contrato' },
  { code: '04707', name: 'PAC Mini' },
];

function readOverride(meta: any, key: string, fallback: string = ''): string {
  if (!meta) return fallback;
  return String(meta[`override_${key}`] ?? meta[key] ?? fallback ?? '');
}

export function DraftShipmentDialog({ open, onOpenChange, shipmentId, onSaved }: DraftShipmentDialogProps) {
  const { currentTenant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(null);
  const [linkedPvId, setLinkedPvId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<'from_order' | 'manual'>('from_order');
  const [orderSearch, setOrderSearch] = useState('');
  const [searchingOrder, setSearchingOrder] = useState(false);
  const [sender, setSender] = useState<SenderInfo | null>(null);
  const [senderWarning, setSenderWarning] = useState<string | null>(null);
  const { lookupCep, isLoading: cepLoading } = useCepLookup();

  const isEdit = !!shipmentId;

  // Load sender from shipping_providers settings (Correios)
  useEffect(() => {
    if (!open || !currentTenant?.id) return;
    (async () => {
      const { data } = await supabase
        .from('shipping_providers')
        .select('settings')
        .eq('tenant_id', currentTenant.id)
        .eq('provider', 'correios')
        .maybeSingle();
      const s = (data?.settings || {}) as any;
      const senderData: SenderInfo = {
        name: s.sender_name || '',
        doc: s.sender_document || '',
        phone: s.sender_phone || '',
        street: s.sender_street || '',
        number: s.sender_number || '',
        complement: s.sender_complement || '',
        neighborhood: s.sender_neighborhood || '',
        city: s.sender_city || '',
        state: s.sender_state || '',
        zip: s.sender_postal_code || '',
      };
      setSender(senderData);
      const missing: string[] = [];
      if (!senderData.name) missing.push('nome');
      if (!senderData.doc) missing.push('CPF/CNPJ');
      if (!senderData.phone) missing.push('telefone');
      if (!senderData.zip) missing.push('CEP');
      if (!senderData.street) missing.push('rua');
      if (!senderData.number) missing.push('número');
      if (!senderData.neighborhood) missing.push('bairro');
      if (!senderData.city) missing.push('cidade');
      if (!senderData.state) missing.push('UF');
      setSenderWarning(missing.length > 0 ? `Faltam dados do remetente: ${missing.join(', ')}. Configure em Configurações → Transportadoras → Correios antes de emitir.` : null);
    })();
  }, [open, currentTenant?.id]);

  // Load shipment (edit) — pulls override from metadata; if absent and order_id, pulls from orders
  useEffect(() => {
    if (!open) return;
    if (!shipmentId) {
      setForm(EMPTY);
      setLinkedOrderId(null);
      setLinkedPvId(null);
      setCreateMode('from_order');
      setOrderSearch('');
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data: ship } = await supabase
          .from('shipments')
          .select('carrier, service_name, service_code, metadata, order_id, source_pedido_venda_id, manually_adjusted')
          .eq('id', shipmentId)
          .maybeSingle();
        if (!ship) { setLoading(false); return; }

        setLinkedOrderId(ship.order_id || null);
        setLinkedPvId(ship.source_pedido_venda_id || null);

        let order: any = null;
        let pv: any = null;
        if (ship.order_id) {
          const { data } = await supabase
            .from('orders')
            .select('customer_name, customer_cpf, customer_cnpj, customer_phone, customer_email, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_postal_code, shipping_carrier, shipping_service_code, shipping_service_name, total, shipping_total')
            .eq('id', ship.order_id)
            .maybeSingle();
          order = data;
        } else if (ship.source_pedido_venda_id) {
          const { data } = await supabase
            .from('fiscal_invoices')
            .select('dest_nome, dest_cpf_cnpj, dest_telefone, dest_email, dest_endereco_logradouro, dest_endereco_numero, dest_endereco_complemento, dest_endereco_bairro, dest_endereco_municipio, dest_endereco_uf, dest_endereco_cep, transportadora_servico, valor_total')
            .eq('id', ship.source_pedido_venda_id)
            .maybeSingle();
          pv = data;
        }

        const meta = (ship.metadata || {}) as any;
        const carrierRaw = (ship.carrier || order?.shipping_carrier || 'correios').toLowerCase();
        const carrier = CARRIER_OPTIONS.includes(carrierRaw) ? carrierRaw : 'manual';

        setForm({
          carrier,
          service_name: ship.service_name || order?.shipping_service_name || pv?.transportadora_servico || '',
          service_code: ship.service_code || order?.shipping_service_code || '',
          weight_grams: String(meta.weight_grams ?? ''),
          height_cm: String(meta.height_cm ?? ''),
          width_cm: String(meta.width_cm ?? ''),
          depth_cm: String(meta.depth_cm ?? ''),
          declared_value: String(meta.declared_value ?? order?.total ?? pv?.valor_total ?? ''),
          recipient_name: readOverride(meta, 'recipient_name', order?.customer_name || pv?.dest_nome || ''),
          recipient_doc: readOverride(meta, 'recipient_doc', order?.customer_cpf || order?.customer_cnpj || pv?.dest_cpf_cnpj || ''),
          recipient_phone: readOverride(meta, 'recipient_phone', order?.customer_phone || pv?.dest_telefone || ''),
          recipient_email: readOverride(meta, 'recipient_email', order?.customer_email || pv?.dest_email || ''),
          shipping_street: readOverride(meta, 'shipping_street', order?.shipping_street || pv?.dest_endereco_logradouro || ''),
          shipping_number: readOverride(meta, 'shipping_number', order?.shipping_number || pv?.dest_endereco_numero || ''),
          shipping_complement: readOverride(meta, 'shipping_complement', order?.shipping_complement || pv?.dest_endereco_complemento || ''),
          shipping_neighborhood: readOverride(meta, 'shipping_neighborhood', order?.shipping_neighborhood || pv?.dest_endereco_bairro || ''),
          shipping_city: readOverride(meta, 'shipping_city', order?.shipping_city || pv?.dest_endereco_municipio || ''),
          shipping_state: readOverride(meta, 'shipping_state', order?.shipping_state || pv?.dest_endereco_uf || ''),
          shipping_zip: sanitizeCep(readOverride(meta, 'shipping_zip', order?.shipping_postal_code || pv?.dest_endereco_cep || '')),
          notes: meta.notes || '',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, shipmentId]);

  const setField = (k: keyof FormState) => (v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // Search order by number to pre-fill in Create > from_order mode
  const handleSearchOrder = async () => {
    if (!currentTenant?.id || !orderSearch.trim()) return;
    setSearchingOrder(true);
    try {
      const num = orderSearch.trim().replace(/^#/, '');
      const { data: order } = await supabase
        .from('orders')
        .select('id, customer_name, customer_cpf, customer_cnpj, customer_phone, customer_email, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_postal_code, shipping_carrier, shipping_service_code, shipping_service_name, total')
        .eq('tenant_id', currentTenant.id)
        .eq('order_number', num)
        .maybeSingle();
      if (!order) {
        toast.error(`Pedido #${num} não encontrado`);
        return;
      }
      // weight from items
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, product_id')
        .eq('order_id', order.id);
      const productIds = (items || []).map(i => i.product_id).filter(Boolean);
      let weight = 0; let height = 10; let width = 15; let depth = 20;
      if (productIds.length) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, weight, height, width, depth')
          .in('id', productIds);
        const map = Object.fromEntries((prods || []).map(p => [p.id, p]));
        for (const it of items || []) {
          const p: any = it.product_id ? map[it.product_id] : null;
          weight += (p?.weight || 300) * it.quantity;
          if (p?.height) height = Math.max(height, p.height);
          if (p?.width) width = Math.max(width, p.width);
          if (p?.depth) depth += p.depth;
        }
      }
      const carrierRaw = (order.shipping_carrier || 'correios').toLowerCase();
      setLinkedOrderId(order.id);
      setLinkedPvId(null);
      setForm({
        carrier: CARRIER_OPTIONS.includes(carrierRaw) ? carrierRaw : 'manual',
        service_name: order.shipping_service_name || 'PAC',
        service_code: order.shipping_service_code || '03298',
        weight_grams: String(Math.max(1, Math.round(weight))),
        height_cm: String(height),
        width_cm: String(width),
        depth_cm: String(depth),
        declared_value: String(order.total || 0),
        recipient_name: order.customer_name || '',
        recipient_doc: order.customer_cpf || order.customer_cnpj || '',
        recipient_phone: order.customer_phone || '',
        recipient_email: order.customer_email || '',
        shipping_street: order.shipping_street || '',
        shipping_number: order.shipping_number || '',
        shipping_complement: order.shipping_complement || '',
        shipping_neighborhood: order.shipping_neighborhood || '',
        shipping_city: order.shipping_city || '',
        shipping_state: order.shipping_state || '',
        shipping_zip: sanitizeCep(order.shipping_postal_code || ''),
        notes: '',
      });
      toast.success(`Pedido #${num} carregado`);
    } finally {
      setSearchingOrder(false);
    }
  };

  const handleCepBlur = async () => {
    const cep = sanitizeCep(form.shipping_zip);
    if (cep.length !== 8) return;
    const result = await lookupCep(cep);
    if (result) {
      setForm(prev => ({
        ...prev,
        shipping_street: prev.shipping_street || result.street,
        shipping_neighborhood: prev.shipping_neighborhood || result.neighborhood,
        shipping_city: prev.shipping_city || result.city,
        shipping_state: prev.shipping_state || result.state,
      }));
    }
  };

  const validate = (): string | null => {
    if (!form.carrier) return 'Selecione a transportadora.';
    if (!form.service_name) return 'Informe o serviço (PAC, SEDEX, etc.).';
    if (form.carrier === 'correios' && !form.service_code) return 'Informe o código do serviço dos Correios.';
    const w = parseInt(form.weight_grams, 10);
    if (!w || w <= 0) return 'Peso deve ser maior que zero.';
    const h = parseFloat(form.height_cm), wd = parseFloat(form.width_cm), d = parseFloat(form.depth_cm);
    if (!h || !wd || !d || h <= 0 || wd <= 0 || d <= 0) return 'Altura, largura e comprimento devem ser maiores que zero.';
    if (!form.recipient_name.trim()) return 'Nome do destinatário é obrigatório.';
    const doc = extractCpfDigits(form.recipient_doc);
    if (doc.length !== 11 && doc.length !== 14) return 'CPF (11 dígitos) ou CNPJ (14 dígitos) do destinatário é obrigatório.';
    const phone = form.recipient_phone.replace(/\D/g, '');
    if (phone.length < 10) return 'Telefone do destinatário é obrigatório (com DDD).';
    if (sanitizeCep(form.shipping_zip).length !== 8) return 'CEP do destinatário deve ter 8 dígitos.';
    if (!form.shipping_street.trim()) return 'Rua/logradouro do destinatário é obrigatória.';
    if (!form.shipping_number.trim()) return 'Número do endereço do destinatário é obrigatório.';
    if (!form.shipping_neighborhood.trim()) return 'Bairro do destinatário é obrigatório.';
    if (!form.shipping_city.trim()) return 'Cidade do destinatário é obrigatória.';
    if (!form.shipping_state.trim() || form.shipping_state.trim().length !== 2) return 'UF do destinatário (2 letras) é obrigatória.';
    return null;
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const metadata: Record<string, any> = {
        weight_grams: Math.max(1, parseInt(form.weight_grams, 10) || 0),
        height_cm: parseFloat(form.height_cm) || 0,
        width_cm: parseFloat(form.width_cm) || 0,
        depth_cm: parseFloat(form.depth_cm) || 0,
        declared_value: parseFloat(form.declared_value) || 0,
        // override_* are read by shipping-create-shipment when manually_adjusted=true
        override_recipient_name: form.recipient_name.trim(),
        override_recipient_doc: extractCpfDigits(form.recipient_doc),
        override_recipient_phone: form.recipient_phone.replace(/\D/g, ''),
        override_recipient_email: form.recipient_email.trim(),
        override_shipping_street: form.shipping_street.trim(),
        override_shipping_number: form.shipping_number.trim(),
        override_shipping_complement: form.shipping_complement.trim(),
        override_shipping_neighborhood: form.shipping_neighborhood.trim(),
        override_shipping_city: form.shipping_city.trim(),
        override_shipping_state: form.shipping_state.trim().toUpperCase(),
        override_shipping_zip: sanitizeCep(form.shipping_zip),
        notes: form.notes || null,
        computed_by: 'manual_operator',
        computed_at: new Date().toISOString(),
      };

      if (isEdit && shipmentId) {
        const { error } = await supabase
          .from('shipments')
          .update({
            carrier: form.carrier,
            service_name: form.service_name || null,
            service_code: form.service_code || null,
            metadata,
            manually_adjusted: true,
          })
          .eq('id', shipmentId);
        if (error) throw error;
        toast.success('Rascunho atualizado');
      } else {
        const payload: any = {
          tenant_id: currentTenant.id,
          carrier: form.carrier,
          service_name: form.service_name || null,
          service_code: form.service_code || null,
          delivery_status: 'draft',
          source: createMode === 'from_order' ? 'manual_from_order' : 'manual_standalone',
          metadata,
          manually_adjusted: true,
        };
        if (createMode === 'from_order' && linkedOrderId) payload.order_id = linkedOrderId;
        const { error } = await supabase.from('shipments').insert(payload);
        if (error) throw error;
        toast.success('Rascunho criado');
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar rascunho de remessa' : 'Criar novo rascunho de remessa'}</DialogTitle>
          <DialogDescription>
            Todos os campos do destinatário e da embalagem são obrigatórios — os Correios não autorizam etiqueta sem eles. Após salvar, o sistema marca a remessa como ajustada manualmente e usa exatamente estes dados na emissão.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados…
          </div>
        ) : (
          <div className="space-y-5">
            {!isEdit && (
              <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="from_order">A partir de um pedido</TabsTrigger>
                  <TabsTrigger value="manual">Avulso (sem pedido)</TabsTrigger>
                </TabsList>
                <TabsContent value="from_order" className="pt-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>Número do pedido</Label>
                      <Input
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Ex.: 537"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchOrder(); } }}
                      />
                    </div>
                    <Button type="button" onClick={handleSearchOrder} disabled={searchingOrder || !orderSearch.trim()}>
                      {searchingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      <span className="ml-2">Carregar</span>
                    </Button>
                  </div>
                  {linkedOrderId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Pedido vinculado. Edite abaixo apenas o que precisa ajustar.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="manual" className="pt-3">
                  <p className="text-xs text-muted-foreground">
                    Remessa avulsa, sem vínculo com pedido. Preencha todos os dados manualmente.
                  </p>
                </TabsContent>
              </Tabs>
            )}

            {senderWarning && (
              <div className="flex gap-2 items-start rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                <span>{senderWarning}</span>
              </div>
            )}

            {/* Remetente (read-only) */}
            {sender && (
              <details className="rounded-md border p-3 text-sm">
                <summary className="cursor-pointer font-medium">Remetente (loja) — somente leitura</summary>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><strong className="text-foreground">Nome:</strong> {sender.name || '—'}</div>
                  <div><strong className="text-foreground">CPF/CNPJ:</strong> {sender.doc || '—'}</div>
                  <div><strong className="text-foreground">Telefone:</strong> {sender.phone || '—'}</div>
                  <div><strong className="text-foreground">CEP:</strong> {sender.zip ? formatCepDisplay(sanitizeCep(sender.zip)) : '—'}</div>
                  <div className="col-span-2"><strong className="text-foreground">Endereço:</strong> {[sender.street, sender.number, sender.complement, sender.neighborhood, sender.city, sender.state].filter(Boolean).join(', ') || '—'}</div>
                </div>
              </details>
            )}

            {/* Transportadora e serviço */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Transportadora e serviço</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Transportadora *</Label>
                  <Select value={form.carrier} onValueChange={setField('carrier')}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="correios">Correios</SelectItem>
                      <SelectItem value="loggi">Loggi</SelectItem>
                      <SelectItem value="frenet">Frenet</SelectItem>
                      <SelectItem value="manual">Outra / Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Serviço *</Label>
                  {form.carrier === 'correios' ? (
                    <Select
                      value={form.service_code}
                      onValueChange={(code) => {
                        const svc = CORREIOS_SERVICES.find(s => s.code === code);
                        setForm(prev => ({ ...prev, service_code: code, service_name: svc?.name || prev.service_name }));
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {CORREIOS_SERVICES.map(s => (
                          <SelectItem key={s.code} value={s.code}>{s.name} ({s.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form.service_name} onChange={(e) => setField('service_name')(e.target.value)} placeholder="PAC, Sedex, Express…" />
                  )}
                </div>
                {form.carrier !== 'correios' && (
                  <div>
                    <Label>Nome do serviço *</Label>
                    <Input value={form.service_name} onChange={(e) => setField('service_name')(e.target.value)} placeholder="PAC, SEDEX…" />
                  </div>
                )}
              </div>
            </div>

            {/* Embalagem */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Embalagem</div>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <Label>Peso (g) *</Label>
                  <Input type="number" min={1} value={form.weight_grams} onChange={(e) => setField('weight_grams')(e.target.value)} />
                </div>
                <div>
                  <Label>Altura (cm) *</Label>
                  <Input type="number" min={1} value={form.height_cm} onChange={(e) => setField('height_cm')(e.target.value)} />
                </div>
                <div>
                  <Label>Largura (cm) *</Label>
                  <Input type="number" min={1} value={form.width_cm} onChange={(e) => setField('width_cm')(e.target.value)} />
                </div>
                <div>
                  <Label>Comprimento (cm) *</Label>
                  <Input type="number" min={1} value={form.depth_cm} onChange={(e) => setField('depth_cm')(e.target.value)} />
                </div>
                <div>
                  <Label>Valor declarado (R$)</Label>
                  <Input type="number" step="0.01" min={0} value={form.declared_value} onChange={(e) => setField('declared_value')(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Destinatário */}
            <div className="space-y-2 border-t pt-4">
              <div className="text-sm font-medium">Destinatário (obrigatório)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome completo *</Label>
                  <Input value={form.recipient_name} onChange={(e) => setField('recipient_name')(e.target.value)} />
                </div>
                <div>
                  <Label>CPF ou CNPJ *</Label>
                  <Input value={formatCpf(form.recipient_doc)} onChange={(e) => setField('recipient_doc')(extractCpfDigits(e.target.value).slice(0, 14))} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>Telefone com DDD *</Label>
                  <Input value={form.recipient_phone} onChange={(e) => setField('recipient_phone')(e.target.value)} placeholder="11999999999" />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.recipient_email} onChange={(e) => setField('recipient_email')(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-6 gap-3 pt-2">
                <div className="col-span-2">
                  <Label>CEP * {cepLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
                  <Input
                    value={formatCepDisplay(sanitizeCep(form.shipping_zip))}
                    onChange={(e) => setField('shipping_zip')(sanitizeCep(e.target.value))}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
                <div className="col-span-3">
                  <Label>Rua / Logradouro *</Label>
                  <Input value={form.shipping_street} onChange={(e) => setField('shipping_street')(e.target.value)} />
                </div>
                <div>
                  <Label>Número *</Label>
                  <Input value={form.shipping_number} onChange={(e) => setField('shipping_number')(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Complemento</Label>
                  <Input value={form.shipping_complement} onChange={(e) => setField('shipping_complement')(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Bairro *</Label>
                  <Input value={form.shipping_neighborhood} onChange={(e) => setField('shipping_neighborhood')(e.target.value)} />
                </div>
                <div className="col-span-1">
                  <Label>Cidade *</Label>
                  <Input value={form.shipping_city} onChange={(e) => setField('shipping_city')(e.target.value)} />
                </div>
                <div className="col-span-1">
                  <Label>UF *</Label>
                  <Input value={form.shipping_state} onChange={(e) => setField('shipping_state')(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
                </div>
              </div>
            </div>

            <div>
              <Label>Observações internas</Label>
              <Input value={form.notes} onChange={(e) => setField('notes')(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando…</> : (isEdit ? 'Salvar alterações' : 'Criar rascunho')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
