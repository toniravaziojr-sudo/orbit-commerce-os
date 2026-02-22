// =============================================
// OFFERS - Manage Cross-sell, Order Bump, Upsell, Compre Junto
// =============================================

import { useState } from 'react';
import { useOfferRules, OfferRule, OfferType, CustomerType, DiscountType, CreateOfferRuleInput } from '@/hooks/useOfferRules';
import { useProducts } from '@/hooks/useProducts';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Trash2, 
  Package,
  Percent,
  ShoppingCart,
  Zap,
  Edit,
  ToggleLeft,
  ToggleRight,
  ShoppingBag,
  Tag,
  Sparkles,
} from 'lucide-react';
import { ProductMultiSelect } from '@/components/builder/ProductMultiSelect';
import { BuyTogetherContent } from '@/components/offers/BuyTogetherContent';
import { BadgesContent } from '@/components/offers/BadgesContent';
import { ProductVariantTypesContent } from '@/components/offers/ProductVariantTypesContent';
import { AIOfferGeneratorDialog } from '@/components/offers/AIOfferGeneratorDialog';

const offerTypeLabels: Record<OfferType, string> = {
  cross_sell: 'Cross-sell',
  order_bump: 'Order Bump',
  upsell: 'Upsell',
};

const offerTypeIcons: Record<OfferType, React.ReactNode> = {
  cross_sell: <ShoppingCart className="h-4 w-4" />,
  order_bump: <Percent className="h-4 w-4" />,
  upsell: <Zap className="h-4 w-4" />,
};

const offerTypeDescriptions: Record<OfferType, string> = {
  cross_sell: 'Sugestões de produtos complementares no carrinho',
  order_bump: 'Oferta especial com 1 clique no checkout',
  upsell: 'Oferta pós-compra ou upgrade',
};

const customerTypeLabels: Record<CustomerType, string> = {
  all: 'Todos os clientes',
  new: 'Novos clientes',
  returning: 'Clientes recorrentes',
};

const discountTypeLabels: Record<DiscountType, string> = {
  none: 'Sem desconto',
  percent: 'Percentual (%)',
  fixed: 'Valor fixo (R$)',
};

interface RuleFormData {
  name: string;
  type: OfferType;
  is_active: boolean;
  priority: number;
  trigger_product_ids: string[];
  min_order_value: string;
  customer_type: CustomerType;
  suggested_product_ids: string[];
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: string;
  default_checked: boolean;
  max_items: number;
}

const defaultFormData: RuleFormData = {
  name: '',
  type: 'cross_sell',
  is_active: true,
  priority: 0,
  trigger_product_ids: [],
  min_order_value: '',
  customer_type: 'all',
  suggested_product_ids: [],
  title: '',
  description: '',
  discount_type: 'none',
  discount_value: '0',
  default_checked: false,
  max_items: 4,
};

export default function Offers() {
  const { rules, isLoading, createRule, updateRule, deleteRule, toggleRule } = useOfferRules();
  const { products } = useProducts();
  
  const [activeTab, setActiveTab] = useState<OfferType | 'buy_together' | 'badges' | 'variant_types'>('cross_sell');

  const openAIDialog = (type: OfferType | 'buy_together') => {
    setAiDialogType(type);
    setAiDialogOpen(true);
  };
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<OfferRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(defaultFormData);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiDialogType, setAiDialogType] = useState<OfferType | 'buy_together'>('cross_sell');

  const filteredRules = rules.filter(r => r.type === activeTab);

  const openCreateDialog = (type: OfferType) => {
    setEditingRule(null);
    setFormData({ ...defaultFormData, type });
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: OfferRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type,
      is_active: rule.is_active,
      priority: rule.priority,
      trigger_product_ids: rule.trigger_product_ids || [],
      min_order_value: rule.min_order_value?.toString() || '',
      customer_type: rule.customer_type,
      suggested_product_ids: rule.suggested_product_ids || [],
      title: rule.title || '',
      description: rule.description || '',
      discount_type: rule.discount_type,
      discount_value: rule.discount_value?.toString() || '0',
      default_checked: rule.default_checked,
      max_items: rule.max_items,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const input: CreateOfferRuleInput = {
      name: formData.name,
      type: formData.type,
      is_active: formData.is_active,
      priority: formData.priority,
      trigger_product_ids: formData.trigger_product_ids,
      min_order_value: formData.min_order_value ? Number(formData.min_order_value) : null,
      customer_type: formData.customer_type,
      suggested_product_ids: formData.suggested_product_ids,
      title: formData.title || undefined,
      description: formData.description || undefined,
      discount_type: formData.discount_type,
      discount_value: Number(formData.discount_value) || 0,
      default_checked: formData.default_checked,
      max_items: formData.max_items,
    };

    if (editingRule) {
      await updateRule.mutateAsync({ id: editingRule.id, ...input });
    } else {
      await createRule.mutateAsync(input);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteRule.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const handleToggle = async (rule: OfferRule) => {
    await toggleRule.mutateAsync({ id: rule.id, is_active: !rule.is_active });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Aumentar Ticket"
        description="Configure regras de Cross-sell, Order Bump e Upsell para aumentar o ticket médio"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OfferType | 'buy_together' | 'badges' | 'variant_types')} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="cross_sell" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Cross-sell</span>
            {rules.filter(r => r.type === 'cross_sell').length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {rules.filter(r => r.type === 'cross_sell').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="order_bump" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            <span className="hidden sm:inline">Order Bump</span>
            {rules.filter(r => r.type === 'order_bump').length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {rules.filter(r => r.type === 'order_bump').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upsell" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Upsell</span>
            {rules.filter(r => r.type === 'upsell').length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {rules.filter(r => r.type === 'upsell').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="buy_together" className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Compre Junto</span>
          </TabsTrigger>
          <TabsTrigger value="badges" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Selos</span>
          </TabsTrigger>
          <TabsTrigger value="variant_types" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Variações</span>
          </TabsTrigger>
        </TabsList>

        {/* Buy Together Tab */}
        <TabsContent value="buy_together" className="space-y-4">
          <div className="flex justify-end mb-2">
            <Button variant="outline" onClick={() => openAIDialog('buy_together')}>
              <Sparkles className="h-4 w-4 mr-2" />
              Criar com IA
            </Button>
          </div>
          <BuyTogetherContent />
        </TabsContent>

        {/* Badges Tab */}
        <TabsContent value="badges" className="space-y-4">
          <BadgesContent />
        </TabsContent>

        {/* Variant Types Tab */}
        <TabsContent value="variant_types" className="space-y-4">
          <ProductVariantTypesContent />
        </TabsContent>

        {['cross_sell', 'order_bump', 'upsell'].map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {offerTypeIcons[type as OfferType]}
                      {offerTypeLabels[type as OfferType]}
                    </CardTitle>
                    <CardDescription>
                      {offerTypeDescriptions[type as OfferType]}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => openAIDialog(type as OfferType)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Criar com IA
                    </Button>
                    <Button onClick={() => openCreateDialog(type as OfferType)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Regra
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma regra de {offerTypeLabels[type as OfferType]} configurada</p>
                    <p className="text-sm">Crie uma regra para começar a exibir ofertas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRules.map((rule) => (
                      <Card key={rule.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggle(rule)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {rule.is_active ? (
                                <ToggleRight className="h-6 w-6 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-6 w-6" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{rule.name}</span>
                                {!rule.is_active && (
                                  <Badge variant="secondary">Inativa</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                {rule.suggested_product_ids.length > 0 && (
                                  <span>{rule.suggested_product_ids.length} produto(s)</span>
                                )}
                                {rule.min_order_value && (
                                  <span>• Mín: R$ {rule.min_order_value}</span>
                                )}
                                {rule.discount_type !== 'none' && (
                                  <span>
                                    • {rule.discount_type === 'percent' 
                                      ? `${rule.discount_value}% off` 
                                      : `R$ ${rule.discount_value} off`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(rule)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirm(rule.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Editar Regra' : 'Nova Regra'} de {offerTypeLabels[formData.type]}
            </DialogTitle>
            <DialogDescription>
              Configure as condições e a oferta a ser exibida
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome da Regra *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Cross-sell produtos relacionados"
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: Number(e.target.value) }))}
                  min={0}
                />
                <p className="text-xs text-muted-foreground mt-1">Menor número = maior prioridade</p>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_active: v }))}
                />
                <Label>Regra ativa</Label>
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase">Condições</h4>
              
              <div>
                <Label>Produtos gatilho (opcional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Se vazio, aplica para qualquer produto no carrinho
                </p>
                <ProductMultiSelect
                  value={formData.trigger_product_ids}
                  onChange={(ids) => setFormData(prev => ({ ...prev, trigger_product_ids: ids }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor mínimo do pedido (R$)</Label>
                  <Input
                    type="number"
                    value={formData.min_order_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_order_value: e.target.value }))}
                    placeholder="Sem mínimo"
                    min={0}
                    step={0.01}
                  />
                </div>
                <div>
                  <Label>Tipo de cliente</Label>
                  <Select
                    value={formData.customer_type}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, customer_type: v as CustomerType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(customerTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Offer */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase">Oferta</h4>
              
              <div>
                <Label>Produtos sugeridos *</Label>
                <ProductMultiSelect
                  value={formData.suggested_product_ids}
                  onChange={(ids) => setFormData(prev => ({ ...prev, suggested_product_ids: ids }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Título da oferta</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={formData.type === 'cross_sell' ? 'Complete seu pedido' : 'Aproveite esta oferta!'}
                  />
                </div>
                <div>
                  <Label>Máx. itens a exibir</Label>
                  <Select
                    value={String(formData.max_items)}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, max_items: Number(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} itens</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.type !== 'cross_sell' && (
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Adicione ao seu pedido com desconto especial"
                    rows={2}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de desconto</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, discount_type: v as DiscountType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(discountTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.discount_type !== 'none' && (
                  <div>
                    <Label>
                      Valor do desconto {formData.discount_type === 'percent' ? '(%)' : '(R$)'}
                    </Label>
                    <Input
                      type="number"
                      value={formData.discount_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                      min={0}
                      max={formData.discount_type === 'percent' ? 100 : undefined}
                      step={formData.discount_type === 'percent' ? 1 : 0.01}
                    />
                  </div>
                )}
              </div>

              {formData.type === 'order_bump' && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.default_checked}
                    onCheckedChange={(v) => setFormData(prev => ({ ...prev, default_checked: v }))}
                  />
                  <Label>Pré-selecionado no checkout</Label>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.name || formData.suggested_product_ids.length === 0}
            >
              {editingRule ? 'Salvar' : 'Criar Regra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A regra será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Offer Generator Dialog */}
      <AIOfferGeneratorDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        type={aiDialogType}
      />
    </div>
  );
}
