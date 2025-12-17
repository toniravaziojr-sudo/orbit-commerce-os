// =============================================
// STORE CONFIG SETTINGS - Admin page for Shipping, Benefits, Offers
// =============================================

import { useState, useEffect } from 'react';
import { useStoreConfig } from '@/hooks/useStoreConfig';
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Save, 
  Truck, 
  Gift, 
  ShoppingBag,
  Plus,
  Trash2,
  Package,
  Percent,
  CheckCircle2
} from 'lucide-react';
import {
  ShippingConfig,
  BenefitConfig,
  OffersConfig,
  ShippingRule,
  defaultShippingConfig,
  defaultBenefitConfig,
  defaultOffersConfig,
} from '@/lib/storeConfigTypes';

export default function StoreConfigSettings() {
  const { config, isLoading, updateShippingConfig, updateBenefitConfig, updateOffersConfig } = useStoreConfig();
  const { products } = useProducts();
  
  // Local state for each config section
  const [shippingForm, setShippingForm] = useState<ShippingConfig>(defaultShippingConfig);
  const [benefitForm, setBenefitForm] = useState<BenefitConfig>(defaultBenefitConfig);
  const [offersForm, setOffersForm] = useState<OffersConfig>(defaultOffersConfig);
  
  // Track changes
  const [shippingChanged, setShippingChanged] = useState(false);
  const [benefitChanged, setBenefitChanged] = useState(false);
  const [offersChanged, setOffersChanged] = useState(false);

  // Load configs into forms
  useEffect(() => {
    if (config) {
      setShippingForm(config.shippingConfig);
      setBenefitForm(config.benefitConfig);
      setOffersForm(config.offersConfig);
    }
  }, [config]);

  // Handlers for shipping
  const handleShippingChange = <K extends keyof ShippingConfig>(key: K, value: ShippingConfig[K]) => {
    setShippingForm(prev => ({ ...prev, [key]: value }));
    setShippingChanged(true);
  };

  const addShippingRule = () => {
    const newRule: ShippingRule = {
      id: crypto.randomUUID(),
      zipRangeStart: '',
      zipRangeEnd: '',
      price: 0,
      deliveryDays: 7,
    };
    handleShippingChange('rules', [...shippingForm.rules, newRule]);
  };

  const updateShippingRule = (index: number, updates: Partial<ShippingRule>) => {
    const newRules = [...shippingForm.rules];
    newRules[index] = { ...newRules[index], ...updates };
    handleShippingChange('rules', newRules);
  };

  const removeShippingRule = (index: number) => {
    handleShippingChange('rules', shippingForm.rules.filter((_, i) => i !== index));
  };

  const saveShipping = async () => {
    await updateShippingConfig.mutateAsync(shippingForm);
    setShippingChanged(false);
  };

  // Handlers for benefit
  const handleBenefitChange = <K extends keyof BenefitConfig>(key: K, value: BenefitConfig[K]) => {
    setBenefitForm(prev => ({ ...prev, [key]: value }));
    setBenefitChanged(true);
  };

  const saveBenefit = async () => {
    await updateBenefitConfig.mutateAsync(benefitForm);
    setBenefitChanged(false);
  };

  // Handlers for offers
  const handleOffersChange = (section: keyof OffersConfig, updates: Partial<OffersConfig[keyof OffersConfig]>) => {
    setOffersForm(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
    setOffersChanged(true);
  };

  const saveOffers = async () => {
    await updateOffersConfig.mutateAsync(offersForm);
    setOffersChanged(false);
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
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Configurações de Conversão"
        description="Configure frete, barra de benefícios e ofertas da sua loja"
      />

      <Tabs defaultValue="shipping" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="shipping" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Frete
          </TabsTrigger>
          <TabsTrigger value="benefit" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Benefícios
          </TabsTrigger>
          <TabsTrigger value="offers" className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Ofertas
          </TabsTrigger>
        </TabsList>

        {/* SHIPPING TAB */}
        <TabsContent value="shipping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Configurações de Frete
              </CardTitle>
              <CardDescription>
                Configure o provedor de frete e regras de cálculo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Provedor de Frete</Label>
                  <Select 
                    value={shippingForm.provider} 
                    onValueChange={(v) => handleShippingChange('provider', v as ShippingConfig['provider'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mock">Mock (valores fixos)</SelectItem>
                      <SelectItem value="manual_table">Tabela Manual</SelectItem>
                      <SelectItem value="external" disabled>Externo (em breve)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CEP de Origem</Label>
                  <Input
                    value={shippingForm.originZip}
                    onChange={(e) => handleShippingChange('originZip', e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
              </div>

              {/* Default Values */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Preço Padrão (R$)</Label>
                  <Input
                    type="number"
                    value={shippingForm.defaultPrice}
                    onChange={(e) => handleShippingChange('defaultPrice', Number(e.target.value))}
                    min={0}
                    step={0.01}
                  />
                </div>
                <div>
                  <Label>Prazo Padrão (dias)</Label>
                  <Input
                    type="number"
                    value={shippingForm.defaultDays}
                    onChange={(e) => handleShippingChange('defaultDays', Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div>
                  <Label>Frete Grátis acima de (R$)</Label>
                  <Input
                    type="number"
                    value={shippingForm.freeShippingThreshold ?? ''}
                    onChange={(e) => handleShippingChange('freeShippingThreshold', e.target.value ? Number(e.target.value) : null)}
                    placeholder="Ex: 200"
                    min={0}
                  />
                </div>
              </div>

              {/* Manual Rules (only for manual_table provider) */}
              {shippingForm.provider === 'manual_table' && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Regras de Frete</Label>
                        <p className="text-sm text-muted-foreground">
                          Configure faixas de CEP e valores
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={addShippingRule}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Regra
                      </Button>
                    </div>

                    {shippingForm.rules.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma regra configurada. Adicione regras ou use os valores padrão.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {shippingForm.rules.map((rule, index) => (
                          <Card key={rule.id} className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                              <div>
                                <Label className="text-xs">CEP Início</Label>
                                <Input
                                  value={rule.zipRangeStart}
                                  onChange={(e) => updateShippingRule(index, { zipRangeStart: e.target.value })}
                                  placeholder="00000000"
                                  maxLength={8}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">CEP Fim</Label>
                                <Input
                                  value={rule.zipRangeEnd}
                                  onChange={(e) => updateShippingRule(index, { zipRangeEnd: e.target.value })}
                                  placeholder="99999999"
                                  maxLength={8}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Preço (R$)</Label>
                                <Input
                                  type="number"
                                  value={rule.price}
                                  onChange={(e) => updateShippingRule(index, { price: Number(e.target.value) })}
                                  min={0}
                                  step={0.01}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Prazo (dias)</Label>
                                <Input
                                  type="number"
                                  value={rule.deliveryDays}
                                  onChange={(e) => updateShippingRule(index, { deliveryDays: Number(e.target.value) })}
                                  min={1}
                                />
                              </div>
                              <div className="flex items-end">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => removeShippingRule(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Save Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={saveShipping} 
                  disabled={!shippingChanged || updateShippingConfig.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateShippingConfig.isPending ? 'Salvando...' : 'Salvar Frete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BENEFIT TAB */}
        <TabsContent value="benefit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Barra de Benefícios
              </CardTitle>
              <CardDescription>
                Configure a barra de progresso para frete grátis ou brindes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Ativar Barra de Benefícios</Label>
                  <p className="text-sm text-muted-foreground">
                    Mostra progresso do carrinho para atingir benefício
                  </p>
                </div>
                <Switch
                  checked={benefitForm.enabled}
                  onCheckedChange={(v) => handleBenefitChange('enabled', v)}
                />
              </div>

              {benefitForm.enabled && (
                <>
                  <Separator />
                  
                  {/* Mode Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Benefício</Label>
                      <Select 
                        value={benefitForm.mode} 
                        onValueChange={(v) => handleBenefitChange('mode', v as BenefitConfig['mode'])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free_shipping">Frete Grátis</SelectItem>
                          <SelectItem value="gift">Brinde</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Valor Mínimo (R$)</Label>
                      <Input
                        type="number"
                        value={benefitForm.thresholdValue}
                        onChange={(e) => handleBenefitChange('thresholdValue', Number(e.target.value))}
                        min={0}
                        step={0.01}
                      />
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Texto em Progresso</Label>
                      <Input
                        value={benefitForm.rewardLabel}
                        onChange={(e) => handleBenefitChange('rewardLabel', e.target.value)}
                        placeholder="Frete Grátis"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Ex: "Faltam R$ X para Frete Grátis"
                      </p>
                    </div>
                    <div>
                      <Label>Texto ao Atingir</Label>
                      <Input
                        value={benefitForm.successLabel}
                        onChange={(e) => handleBenefitChange('successLabel', e.target.value)}
                        placeholder="Você ganhou frete grátis!"
                      />
                    </div>
                  </div>

                  {/* Color */}
                  <div className="max-w-xs">
                    <Label>Cor da Barra</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="color"
                        value={benefitForm.progressColor}
                        onChange={(e) => handleBenefitChange('progressColor', e.target.value)}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={benefitForm.progressColor}
                        onChange={(e) => handleBenefitChange('progressColor', e.target.value)}
                        placeholder="#22c55e"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Preview:</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Faltam R$ 50,00 para {benefitForm.rewardLabel}</span>
                        <span>75%</span>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ width: '75%', backgroundColor: benefitForm.progressColor }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Save Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={saveBenefit} 
                  disabled={!benefitChanged || updateBenefitConfig.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateBenefitConfig.isPending ? 'Salvando...' : 'Salvar Benefícios'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OFFERS TAB */}
        <TabsContent value="offers" className="space-y-4">
          {/* Cross-Sell */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Cross-Sell
              </CardTitle>
              <CardDescription>
                Sugestões de produtos complementares no carrinho
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Ativar Cross-Sell</Label>
                  <p className="text-sm text-muted-foreground">
                    "Complete seu pedido" no carrinho
                  </p>
                </div>
                <Switch
                  checked={offersForm.crossSell.enabled}
                  onCheckedChange={(v) => handleOffersChange('crossSell', { enabled: v })}
                />
              </div>

              {offersForm.crossSell.enabled && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Título da Seção</Label>
                      <Input
                        value={offersForm.crossSell.title}
                        onChange={(e) => handleOffersChange('crossSell', { title: e.target.value })}
                        placeholder="Complete seu pedido"
                      />
                    </div>
                    <div>
                      <Label>Máximo de Itens</Label>
                      <Select 
                        value={String(offersForm.crossSell.maxItems)} 
                        onValueChange={(v) => handleOffersChange('crossSell', { maxItems: Number(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[3, 4, 5, 6].map(n => (
                            <SelectItem key={n} value={String(n)}>{n} itens</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Order Bump */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Order Bump
              </CardTitle>
              <CardDescription>
                Oferta especial no checkout (máx. 2 produtos)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Ativar Order Bump</Label>
                  <p className="text-sm text-muted-foreground">
                    Adicionar produto com 1 clique no checkout
                  </p>
                </div>
                <Switch
                  checked={offersForm.orderBump.enabled}
                  onCheckedChange={(v) => handleOffersChange('orderBump', { enabled: v })}
                />
              </div>

              {offersForm.orderBump.enabled && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div>
                      <Label>Título</Label>
                      <Input
                        value={offersForm.orderBump.title}
                        onChange={(e) => handleOffersChange('orderBump', { title: e.target.value })}
                        placeholder="Aproveite esta oferta!"
                      />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        value={offersForm.orderBump.description}
                        onChange={(e) => handleOffersChange('orderBump', { description: e.target.value })}
                        placeholder="Adicione ao seu pedido com desconto especial"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Desconto (%)</Label>
                        <Input
                          type="number"
                          value={offersForm.orderBump.discountPercent}
                          onChange={(e) => handleOffersChange('orderBump', { discountPercent: Number(e.target.value) })}
                          min={0}
                          max={100}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch
                          id="defaultChecked"
                          checked={offersForm.orderBump.defaultChecked}
                          onCheckedChange={(v) => handleOffersChange('orderBump', { defaultChecked: v })}
                        />
                        <Label htmlFor="defaultChecked" className="text-sm">
                          Pré-selecionado
                        </Label>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Buy Together */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Compre Junto
              </CardTitle>
              <CardDescription>
                Usa as regras configuradas no menu "Compre Junto"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Ativar Compre Junto</Label>
                  <p className="text-sm text-muted-foreground">
                    Mostra sugestões na página do produto
                  </p>
                </div>
                <Switch
                  checked={offersForm.buyTogether.enabled}
                  onCheckedChange={(v) => handleOffersChange('buyTogether', { enabled: v })}
                />
              </div>
              
              {offersForm.buyTogether.enabled && (
                <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    Usando regras do menu <Badge variant="outline">Compre Junto</Badge>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={saveOffers} 
              disabled={!offersChanged || updateOffersConfig.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateOffersConfig.isPending ? 'Salvando...' : 'Salvar Ofertas'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
