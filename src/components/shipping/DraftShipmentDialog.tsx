import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  notes: string;
}

const EMPTY: FormState = {
  carrier: 'correios',
  service_name: 'PAC',
  service_code: '03298',
  weight_grams: '300',
  height_cm: '10',
  width_cm: '15',
  depth_cm: '20',
  declared_value: '0',
  recipient_name: '',
  recipient_doc: '',
  shipping_address: '',
  shipping_city: '',
  shipping_state: '',
  shipping_zip: '',
  notes: '',
};

export function DraftShipmentDialog({ open, onOpenChange, shipmentId, onSaved }: DraftShipmentDialogProps) {
  const { currentTenant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const isEdit = !!shipmentId;

  useEffect(() => {
    if (!open) return;
    if (!shipmentId) {
      setForm(EMPTY);
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('shipments')
        .select('carrier, service_name, service_code, metadata')
        .eq('id', shipmentId)
        .maybeSingle();
      if (data) {
        const m = (data.metadata || {}) as any;
        setForm({
          carrier: data.carrier || 'correios',
          service_name: data.service_name || '',
          service_code: data.service_code || '',
          weight_grams: String(m.weight_grams ?? 300),
          height_cm: String(m.height_cm ?? 10),
          width_cm: String(m.width_cm ?? 15),
          depth_cm: String(m.depth_cm ?? 20),
          declared_value: String(m.declared_value ?? 0),
          recipient_name: m.recipient_name ?? '',
          recipient_doc: m.recipient_doc ?? '',
          shipping_address: m.shipping_address ?? '',
          shipping_city: m.shipping_city ?? '',
          shipping_state: m.shipping_state ?? '',
          shipping_zip: m.shipping_zip ?? '',
          notes: m.notes ?? '',
        });
      }
      setLoading(false);
    })();
  }, [open, shipmentId]);

  const setField = (k: keyof FormState) => (v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    try {
      const metadata = {
        weight_grams: Math.max(parseInt(form.weight_grams || '0', 10) || 0, 1),
        height_cm: parseFloat(form.height_cm) || 0,
        width_cm: parseFloat(form.width_cm) || 0,
        depth_cm: parseFloat(form.depth_cm) || 0,
        declared_value: parseFloat(form.declared_value) || 0,
        recipient_name: form.recipient_name || null,
        recipient_doc: form.recipient_doc || null,
        shipping_address: form.shipping_address || null,
        shipping_city: form.shipping_city || null,
        shipping_state: form.shipping_state || null,
        shipping_zip: form.shipping_zip || null,
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
        const { error } = await supabase
          .from('shipments')
          .insert({
            tenant_id: currentTenant.id,
            carrier: form.carrier,
            service_name: form.service_name || null,
            service_code: form.service_code || null,
            delivery_status: 'draft' as any,
            source: 'manual',
            metadata,
            manually_adjusted: true,
          });
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar rascunho de remessa' : 'Criar novo rascunho de remessa'}</DialogTitle>
          <DialogDescription>
            Ajuste manual. Após salvar, esta remessa fica marcada como "ajustada manualmente" — o sistema não vai
            mais recalcular ou excluir automaticamente.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Transportadora</Label>
                <Select value={form.carrier} onValueChange={setField('carrier')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correios">Correios</SelectItem>
                    <SelectItem value="loggi">Loggi</SelectItem>
                    <SelectItem value="frenet">Frenet</SelectItem>
                    <SelectItem value="manual">Outra / Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Serviço</Label>
                <Input value={form.service_name} onChange={(e) => setField('service_name')(e.target.value)} placeholder="PAC, Sedex, etc." />
              </div>
              <div>
                <Label>Código do serviço</Label>
                <Input value={form.service_code} onChange={(e) => setField('service_code')(e.target.value)} placeholder="03298" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Peso (g)</Label>
                <Input type="number" value={form.weight_grams} onChange={(e) => setField('weight_grams')(e.target.value)} />
              </div>
              <div>
                <Label>Altura (cm)</Label>
                <Input type="number" value={form.height_cm} onChange={(e) => setField('height_cm')(e.target.value)} />
              </div>
              <div>
                <Label>Largura (cm)</Label>
                <Input type="number" value={form.width_cm} onChange={(e) => setField('width_cm')(e.target.value)} />
              </div>
              <div>
                <Label>Comprimento (cm)</Label>
                <Input type="number" value={form.depth_cm} onChange={(e) => setField('depth_cm')(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Valor declarado (R$)</Label>
              <Input type="number" step="0.01" value={form.declared_value} onChange={(e) => setField('declared_value')(e.target.value)} />
            </div>

            <div className="border-t pt-3">
              <div className="text-sm font-medium mb-2">Destinatário (opcional, sobrepõe pedido)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.recipient_name} onChange={(e) => setField('recipient_name')(e.target.value)} />
                </div>
                <div>
                  <Label>CPF/CNPJ</Label>
                  <Input value={form.recipient_doc} onChange={(e) => setField('recipient_doc')(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.shipping_address} onChange={(e) => setField('shipping_address')(e.target.value)} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.shipping_city} onChange={(e) => setField('shipping_city')(e.target.value)} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={form.shipping_state} onChange={(e) => setField('shipping_state')(e.target.value)} maxLength={2} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.shipping_zip} onChange={(e) => setField('shipping_zip')(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => setField('notes')(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar rascunho')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
