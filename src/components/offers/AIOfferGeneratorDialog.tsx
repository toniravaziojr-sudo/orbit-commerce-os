// =============================================
// AI OFFER GENERATOR DIALOG
// Dialog para gerar ofertas automaticamente com IA
// =============================================

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOfferRules, OfferType, DiscountType } from '@/hooks/useOfferRules';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, ArrowRight, Check, AlertCircle } from 'lucide-react';

type AIOfferType = OfferType | 'buy_together';

interface AIOfferSuggestion {
  name: string;
  trigger_product_ids: string[];
  suggested_product_ids: string[];
  title: string;
  description: string;
  reasoning: string;
  trigger_products: { id: string; name: string; price: number }[];
  suggested_products: { id: string; name: string; price: number }[];
}

interface AIOfferGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: AIOfferType;
}

const typeLabels: Record<AIOfferType, string> = {
  cross_sell: 'Cross-sell',
  order_bump: 'Order Bump',
  upsell: 'Upsell',
  buy_together: 'Compre Junto',
};

const discountTypeLabels: Record<string, string> = {
  none: 'Sem desconto',
  percent: 'Percentual (%)',
  fixed: 'Valor fixo (R$)',
};

export function AIOfferGeneratorDialog({ open, onOpenChange, type }: AIOfferGeneratorDialogProps) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [discountType, setDiscountType] = useState<string>('percent');
  const [discountValue, setDiscountValue] = useState<string>('10');
  const [customPrompt, setCustomPrompt] = useState('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<AIOfferSuggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<'config' | 'review'>('config');

  const resetState = () => {
    setDiscountType('percent');
    setDiscountValue('10');
    setCustomPrompt('');
    setSuggestions([]);
    setSelectedIds(new Set());
    setStep('config');
    setIsGenerating(false);
    setIsSaving(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const handleGenerate = async () => {
    if (!currentTenant?.id) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-offers', {
        body: {
          type,
          discount_type: discountType,
          discount_value: discountType !== 'none' ? Number(discountValue) : 0,
          custom_prompt: customPrompt || undefined,
          tenant_id: currentTenant.id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar sugestões');

      const sug = data.suggestions || [];
      setSuggestions(sug);
      setSelectedIds(new Set(sug.map((_: any, i: number) => i)));
      setStep('review');

      if (sug.length === 0) {
        toast.info('A IA não encontrou sugestões para este tipo de oferta com o catálogo atual.');
      }
    } catch (err: any) {
      console.error('Erro ao gerar ofertas:', err);
      toast.error(err.message || 'Erro ao gerar sugestões com IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSave = async () => {
    if (!currentTenant?.id || selectedIds.size === 0) return;

    setIsSaving(true);
    try {
      const selected = suggestions.filter((_, i) => selectedIds.has(i));
      let created = 0;

      if (type === 'buy_together') {
        // Insert into buy_together_rules
        for (const s of selected) {
          for (const trigId of s.trigger_product_ids) {
            for (const sugId of s.suggested_product_ids) {
              const { error } = await supabase.from('buy_together_rules').insert({
                tenant_id: currentTenant.id,
                trigger_product_id: trigId,
                suggested_product_id: sugId,
                title: s.title,
                discount_type: discountType === 'none' ? 'none' : discountType === 'percent' ? 'percentage' : 'fixed',
                discount_value: discountType !== 'none' ? Number(discountValue) : 0,
                is_active: true,
                priority: 0,
              });
              if (error) {
                console.error('Erro ao criar buy_together_rule:', error);
              } else {
                created++;
              }
            }
          }
        }
        queryClient.invalidateQueries({ queryKey: ['buy_together_rules'] });
      } else {
        // Insert into offer_rules
        for (const s of selected) {
          const { error } = await supabase.from('offer_rules').insert({
            tenant_id: currentTenant.id,
            name: s.name,
            type,
            is_active: true,
            priority: 0,
            trigger_product_ids: s.trigger_product_ids,
            suggested_product_ids: s.suggested_product_ids,
            title: s.title,
            description: s.description,
            discount_type: discountType as DiscountType,
            discount_value: discountType !== 'none' ? Number(discountValue) : 0,
            default_checked: type === 'order_bump',
            max_items: 4,
            customer_type: 'all',
          });
          if (error) {
            console.error('Erro ao criar offer_rule:', error);
          } else {
            created++;
          }
        }
        queryClient.invalidateQueries({ queryKey: ['offer_rules'] });
      }

      toast.success(`${created} regra(s) criada(s) com sucesso!`);
      handleOpenChange(false);
    } catch (err: any) {
      console.error('Erro ao salvar regras:', err);
      toast.error('Erro ao salvar regras');
    } finally {
      setIsSaving(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar {typeLabels[type]} com IA
          </DialogTitle>
          <DialogDescription>
            {step === 'config'
              ? 'Configure o desconto e instruções. A IA analisará seus kits e produtos para gerar sugestões.'
              : `${suggestions.length} sugestão(ões) gerada(s). Selecione as que deseja criar.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'config' && (
          <div className="space-y-5 py-2">
            {/* Discount Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de desconto</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(discountTypeLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {discountType !== 'none' && (
                <div>
                  <Label>Valor do desconto {discountType === 'percent' ? '(%)' : '(R$)'}</Label>
                  <Input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    min={0}
                    max={discountType === 'percent' ? 100 : undefined}
                    step={discountType === 'percent' ? 1 : 0.01}
                  />
                </div>
              )}
            </div>

            {/* Custom Prompt */}
            <div>
              <Label>Instruções adicionais (opcional)</Label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ex: Priorize ofertas com produtos da linha Calvície Zero. Não sugira produtos acima de R$ 100."
                rows={3}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Explique a lógica desejada para as ofertas. A IA já analisa seus kits automaticamente.
              </p>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-3 py-2">
            {suggestions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma sugestão gerada.</p>
                <p className="text-sm">Tente ajustar as instruções ou verifique se há kits cadastrados.</p>
              </div>
            )}

            {suggestions.map((s, i) => (
              <div
                key={i}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedIds.has(i)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
                onClick={() => toggleSuggestion(i)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(i)}
                    onCheckedChange={() => toggleSuggestion(i)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.name}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {s.trigger_products.map(p => (
                          <Badge key={p.id} variant="outline" className="text-xs">
                            {p.name} ({formatPrice(p.price)})
                          </Badge>
                        ))}
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {s.suggested_products.map(p => (
                          <Badge key={p.id} variant="secondary" className="text-xs">
                            {p.name} ({formatPrice(p.price)})
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2 italic">
                      💡 {s.reasoning}
                    </p>

                    <div className="mt-1 text-xs text-foreground/70">
                      <span className="font-medium">Título:</span> {s.title}
                      {s.description && (
                        <>
                          <span className="mx-1">•</span>
                          <span className="font-medium">Desc:</span> {s.description}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {step === 'config' ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando catálogo...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar Sugestões
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('config')}>
                Voltar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || selectedIds.size === 0}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando regras...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Criar {selectedIds.size} regra(s)
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
