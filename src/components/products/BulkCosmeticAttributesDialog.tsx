import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Product } from '@/hooks/useProducts';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: Product[];
  onApplied?: () => void;
}

type TriState = '' | 'yes' | 'no' | 'not_applicable';

const TRI_FIELDS: Array<[string, string]> = [
  ['dermatologically_tested', 'Dermatologicamente testado'],
  ['hypoallergenic', 'Hipoalergênico'],
  ['cruelty_free', 'Livre de crueldade'],
  ['vegan', 'Vegano'],
  ['has_fragrance', 'Com fragrância'],
];

const HAIR_TYPES = ['oleoso', 'seco', 'misto', 'normal', 'cacheado', 'liso', 'todos'];
const HAIR_LABELS: Record<string, string> = {
  oleoso: 'Oleoso', seco: 'Seco', misto: 'Misto', normal: 'Normal',
  cacheado: 'Cacheado', liso: 'Liso', todos: 'Todos os tipos',
};

const TREATMENTS = ['antiqueda', 'crescimento', 'hidratacao', 'anticaspa', 'antioleosidade', 'reconstrucao', 'fortalecimento', 'limpeza', 'pos_banho'];
const TREATMENT_LABELS: Record<string, string> = {
  antiqueda: 'Antiqueda', crescimento: 'Crescimento', hidratacao: 'Hidratação',
  anticaspa: 'Anticaspa', antioleosidade: 'Antioleosidade', reconstrucao: 'Reconstrução',
  fortalecimento: 'Fortalecimento', limpeza: 'Limpeza', pos_banho: 'Pós-banho',
};

export function BulkCosmeticAttributesDialog({ open, onOpenChange, products, onApplied }: Props) {
  // Só faz sentido para cosméticos
  const eligible = useMemo(
    () => products.filter(p => (p as any).regulatory_regime === 'anvisa_cosmetic'),
    [products]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tri, setTri] = useState<Record<string, TriState>>({});
  const [fragranceName, setFragranceName] = useState('');
  const [hairTypes, setHairTypes] = useState<string[]>([]);
  const [treatments, setTreatments] = useState<string[]>([]);
  const [effects, setEffects] = useState('');
  const [applyFragrance, setApplyFragrance] = useState(false);
  const [applyHair, setApplyHair] = useState(false);
  const [applyTreatments, setApplyTreatments] = useState(false);
  const [applyEffects, setApplyEffects] = useState(false);
  const [saving, setSaving] = useState(false);

  const allSelected = eligible.length > 0 && selectedIds.length === eligible.length;
  const toggleAll = () => setSelectedIds(allSelected ? [] : eligible.map(p => p.id));
  const toggleOne = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleArr = (list: string[], setter: (v: string[]) => void, v: string) =>
    setter(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  const handleApply = async () => {
    if (selectedIds.length === 0) {
      toast.error('Selecione ao menos 1 produto.');
      return;
    }
    const patch: Record<string, any> = {};
    for (const [key] of TRI_FIELDS) {
      if (tri[key]) patch[key] = tri[key];
    }
    if (applyFragrance) patch.fragrance_name = fragranceName || null;
    if (applyHair) patch.recommended_hair_types = hairTypes;
    if (applyTreatments) patch.treatment_types = treatments;
    if (applyEffects) patch.expected_effects = effects || null;

    if (Object.keys(patch).length === 0) {
      toast.error('Defina ao menos 1 atributo para aplicar.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update(patch)
        .in('id', selectedIds);
      if (error) throw error;
      toast.success(`Atributos aplicados a ${selectedIds.length} produto(s).`);
      onApplied?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Falha ao aplicar: ' + (e?.message ?? 'erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Aplicar atributos cosméticos em lote
          </DialogTitle>
          <DialogDescription>
            Preencha apenas o que quer alterar e selecione os produtos. Campos em branco não serão tocados.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Seleção de produtos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">Produtos cosméticos ({eligible.length})</Label>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {allSelected ? 'Limpar' : 'Selecionar todos'}
                </Button>
              </div>
              {eligible.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded p-3">
                  Nenhum produto classificado como "ANVISA Cosmético". Defina o regime regulatório no cadastro primeiro.
                </p>
              ) : (
                <div className="border rounded max-h-48 overflow-y-auto">
                  {eligible.map(p => (
                    <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-0">
                      <Checkbox
                        checked={selectedIds.includes(p.id)}
                        onCheckedChange={() => toggleOne(p.id)}
                      />
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.sku}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Tri-states */}
            <div>
              <Label className="text-base mb-2 block">Características</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {TRI_FIELDS.map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Label className="flex-1 text-sm">{label}</Label>
                    <Select value={tri[key] || ''} onValueChange={v => setTri(s => ({ ...s, [key]: v as TriState }))}>
                      <SelectTrigger className="w-40 h-8">
                        <SelectValue placeholder="— não alterar —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Sim</SelectItem>
                        <SelectItem value="no">Não</SelectItem>
                        <SelectItem value="not_applicable">Não se aplica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Fragrância */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={applyFragrance} onCheckedChange={v => setApplyFragrance(!!v)} id="ap-frag" />
                <Label htmlFor="ap-frag" className="cursor-pointer">Aplicar nome da fragrância</Label>
              </div>
              <Input
                disabled={!applyFragrance}
                value={fragranceName}
                onChange={e => setFragranceName(e.target.value)}
                placeholder="Ex: Amadeirado, Cítrico, Sem perfume"
              />
            </div>

            {/* Tipos de cabelo */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={applyHair} onCheckedChange={v => setApplyHair(!!v)} id="ap-hair" />
                <Label htmlFor="ap-hair" className="cursor-pointer">Aplicar tipos de cabelo</Label>
              </div>
              <div className={`flex flex-wrap gap-2 ${!applyHair ? 'opacity-50 pointer-events-none' : ''}`}>
                {HAIR_TYPES.map(v => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => toggleArr(hairTypes, setHairTypes, v)}
                    className={`px-3 py-1 rounded-full text-sm border transition ${hairTypes.includes(v) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'}`}
                  >
                    {HAIR_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>

            {/* Tratamentos */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={applyTreatments} onCheckedChange={v => setApplyTreatments(!!v)} id="ap-trt" />
                <Label htmlFor="ap-trt" className="cursor-pointer">Aplicar tipos de tratamento</Label>
              </div>
              <div className={`flex flex-wrap gap-2 ${!applyTreatments ? 'opacity-50 pointer-events-none' : ''}`}>
                {TREATMENTS.map(v => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => toggleArr(treatments, setTreatments, v)}
                    className={`px-3 py-1 rounded-full text-sm border transition ${treatments.includes(v) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'}`}
                  >
                    {TREATMENT_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>

            {/* Efeitos */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={applyEffects} onCheckedChange={v => setApplyEffects(!!v)} id="ap-eff" />
                <Label htmlFor="ap-eff" className="cursor-pointer">Aplicar efeitos esperados</Label>
              </div>
              <Textarea
                disabled={!applyEffects}
                value={effects}
                onChange={e => setEffects(e.target.value)}
                placeholder="Ex: Fortalece a raiz, reduz queda, estimula o crescimento"
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleApply} disabled={saving || selectedIds.length === 0}>
            {saving ? 'Aplicando...' : `Aplicar a ${selectedIds.length} produto(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
