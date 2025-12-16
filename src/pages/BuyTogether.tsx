// =============================================
// BUY TOGETHER PAGE - Manage buy together rules
// =============================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, ShoppingBag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BuyTogetherRule {
  id: string;
  trigger_product_id: string;
  suggested_product_id: string;
  title: string;
  discount_type: 'percentage' | 'fixed' | 'none' | null;
  discount_value: number;
  is_active: boolean;
  trigger_product?: { id: string; name: string; price: number };
  suggested_product?: { id: string; name: string; price: number };
}

export default function BuyTogether() {
  const { currentTenant } = useAuth();
  const currentTenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BuyTogetherRule | null>(null);
  
  // Form state
  const [triggerProductId, setTriggerProductId] = useState('');
  const [suggestedProductId, setSuggestedProductId] = useState('');
  const [title, setTitle] = useState('Compre junto e economize');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'none'>('none');
  const [discountValue, setDiscountValue] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Fetch products for selection
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-buy-together', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('tenant_id', currentTenantId)
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch buy together rules
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['buy-together-rules', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from('buy_together_rules')
        .select(`
          *,
          trigger_product:products!buy_together_rules_trigger_product_id_fkey(id, name, price),
          suggested_product:products!buy_together_rules_suggested_product_id_fkey(id, name, price)
        `)
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BuyTogetherRule[];
    },
    enabled: !!currentTenantId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<BuyTogetherRule>) => {
      if (!currentTenantId) throw new Error('No tenant');
      
      if (editingRule) {
        const { error } = await supabase
          .from('buy_together_rules')
          .update({
            trigger_product_id: data.trigger_product_id,
            suggested_product_id: data.suggested_product_id,
            title: data.title,
            discount_type: data.discount_type,
            discount_value: data.discount_value,
            is_active: data.is_active,
          })
          .eq('id', editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('buy_together_rules')
          .insert({
            tenant_id: currentTenantId,
            trigger_product_id: data.trigger_product_id,
            suggested_product_id: data.suggested_product_id,
            title: data.title,
            discount_type: data.discount_type,
            discount_value: data.discount_value,
            is_active: data.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buy-together-rules'] });
      toast.success(editingRule ? 'Regra atualizada!' : 'Regra criada!');
      handleCloseDialog();
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Essa combinação de produtos já existe');
      } else {
        toast.error('Erro ao salvar regra');
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('buy_together_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buy-together-rules'] });
      toast.success('Regra excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir regra');
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('buy_together_rules')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buy-together-rules'] });
    },
  });

  const handleOpenCreate = () => {
    setEditingRule(null);
    setTriggerProductId('');
    setSuggestedProductId('');
    setTitle('Compre junto e economize');
    setDiscountType('none');
    setDiscountValue(0);
    setIsActive(true);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (rule: BuyTogetherRule) => {
    setEditingRule(rule);
    setTriggerProductId(rule.trigger_product_id);
    setSuggestedProductId(rule.suggested_product_id);
    setTitle(rule.title || 'Compre junto e economize');
    setDiscountType(rule.discount_type || 'none');
    setDiscountValue(rule.discount_value || 0);
    setIsActive(rule.is_active);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
  };

  const handleSave = () => {
    if (!triggerProductId || !suggestedProductId) {
      toast.error('Selecione ambos os produtos');
      return;
    }
    if (triggerProductId === suggestedProductId) {
      toast.error('Os produtos devem ser diferentes');
      return;
    }
    
    saveMutation.mutate({
      trigger_product_id: triggerProductId,
      suggested_product_id: suggestedProductId,
      title,
      discount_type: discountType,
      discount_value: discountValue,
      is_active: isActive,
    });
  };

  const formatPrice = (price: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Compre Junto"
        description="Configure ofertas de produtos complementares para aumentar o ticket médio"
      />

      <div className="flex justify-end">
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Regra
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Regras de Compre Junto
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma regra cadastrada</p>
              <p className="text-sm">Crie sua primeira regra de "Compre Junto"</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto Principal</TableHead>
                  <TableHead>Sugestão</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.trigger_product?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(rule.trigger_product?.price || 0)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.suggested_product?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(rule.suggested_product?.price || 0)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {rule.discount_type === 'percentage' && (
                        <Badge variant="secondary">{rule.discount_value}%</Badge>
                      )}
                      {rule.discount_type === 'fixed' && (
                        <Badge variant="secondary">{formatPrice(rule.discount_value)}</Badge>
                      )}
                      {rule.discount_type === 'none' && (
                        <span className="text-muted-foreground text-sm">Sem desconto</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: rule.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(rule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Excluir esta regra?')) {
                              deleteMutation.mutate(rule.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Editar Regra' : 'Nova Regra de Compre Junto'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Produto Principal *</Label>
              <Select value={triggerProductId} onValueChange={setTriggerProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto gatilho" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - {formatPrice(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Produto Sugerido *</Label>
              <Select value={suggestedProductId} onValueChange={setSuggestedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto sugerido" />
                </SelectTrigger>
                <SelectContent>
                  {products
                    .filter((p) => p.id !== triggerProductId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} - {formatPrice(p.price)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título da Oferta</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Compre junto e economize"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Desconto</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem desconto</SelectItem>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {discountType !== 'none' && (
                <div className="space-y-2">
                  <Label>Valor do Desconto</Label>
                  <Input
                    type="number"
                    min={0}
                    step={discountType === 'percentage' ? 1 : 0.01}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
