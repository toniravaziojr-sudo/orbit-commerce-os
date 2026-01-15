// =============================================
// CART CONVERSION CONFIG TAB
// UI for configuring the cart benefit/progress bar
// =============================================

import { useState, useEffect } from 'react';
import { Save, Truck, Gift, Eye, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { BenefitConfig } from '@/lib/storeConfigTypes';

const defaultConfig: BenefitConfig = {
  enabled: false,
  mode: 'free_shipping',
  thresholdValue: 199,
  rewardLabel: 'Frete Grátis',
  successLabel: '🎉 Parabéns! Você ganhou Frete Grátis!',
  progressColor: '#22c55e',
};

export function CartConversionConfigTab() {
  const { currentTenant } = useAuth();
  const currentTenantId = currentTenant?.id;
  const [config, setConfig] = useState<BenefitConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current config
  useEffect(() => {
    async function fetchConfig() {
      if (!currentTenantId) return;
      
      try {
        const { data, error } = await supabase
          .from('store_settings')
          .select('benefit_config')
          .eq('tenant_id', currentTenantId)
          .maybeSingle();

        if (error) throw error;
        
        if (data?.benefit_config) {
          const parsed = typeof data.benefit_config === 'string' 
            ? JSON.parse(data.benefit_config) 
            : data.benefit_config;
          setConfig({ ...defaultConfig, ...parsed });
        }
      } catch (err) {
        console.error('Error fetching benefit config:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfig();
  }, [currentTenantId]);

  const handleSave = async () => {
    if (!currentTenantId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('store_settings')
        .update({
          benefit_config: JSON.parse(JSON.stringify(config)),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', currentTenantId);

      if (error) throw error;
      
      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      console.error('Error saving benefit config:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  // Preview calculation
  const previewProgress = 65; // Mock 65% progress
  const previewRemaining = config.thresholdValue * 0.35;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conversão de Carrinho</CardTitle>
          <CardDescription>
            Configure a barra de progresso que incentiva clientes a atingirem o valor mínimo para ganhar benefícios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar barra de conversão</Label>
              <p className="text-sm text-muted-foreground">
                Exibe uma barra de progresso no carrinho e mini-carrinho
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
            />
          </div>

          {/* Mode Selection */}
          <div className="space-y-3">
            <Label>Tipo de benefício</Label>
            <RadioGroup
              value={config.mode}
              onValueChange={(mode: 'free_shipping' | 'gift') => setConfig({ ...config, mode })}
              className="grid grid-cols-2 gap-4"
            >
              <label
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  config.mode === 'free_shipping' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <RadioGroupItem value="free_shipping" />
                <Truck className="h-5 w-5 text-muted-foreground" />
                <span>Frete Grátis</span>
              </label>
              <label
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  config.mode === 'gift' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <RadioGroupItem value="gift" />
                <Gift className="h-5 w-5 text-muted-foreground" />
                <span>Brinde</span>
              </label>
            </RadioGroup>
          </div>

          {/* Threshold Value */}
          <div className="space-y-2">
            <Label htmlFor="threshold">Valor mínimo para atingir o benefício (R$)</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              step={0.01}
              value={config.thresholdValue}
              onChange={(e) => setConfig({ ...config, thresholdValue: parseFloat(e.target.value) || 0 })}
              className="max-w-xs"
            />
          </div>

          {/* Labels */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rewardLabel">Texto durante o progresso</Label>
              <Input
                id="rewardLabel"
                value={config.rewardLabel}
                onChange={(e) => setConfig({ ...config, rewardLabel: e.target.value })}
                placeholder="Ex: Frete Grátis"
              />
              <p className="text-xs text-muted-foreground">
                Será exibido como "Faltam R$ X para {config.rewardLabel.toLowerCase()}"
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="successLabel">Texto ao atingir o benefício</Label>
              <Input
                id="successLabel"
                value={config.successLabel}
                onChange={(e) => setConfig({ ...config, successLabel: e.target.value })}
                placeholder="Ex: 🎉 Parabéns! Você ganhou Frete Grátis!"
              />
            </div>
          </div>

          {/* Progress Color */}
          <div className="space-y-2">
            <Label htmlFor="progressColor">Cor da barra de progresso</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="progressColor"
                value={config.progressColor}
                onChange={(e) => setConfig({ ...config, progressColor: e.target.value })}
                className="h-10 w-14 rounded border cursor-pointer"
              />
              <Input
                value={config.progressColor}
                onChange={(e) => setConfig({ ...config, progressColor: e.target.value })}
                className="max-w-[120px] font-mono text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" />
            Pré-visualização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress state preview */}
          <div className="p-4 rounded-lg border bg-muted">
            <p className="text-sm font-medium mb-2">Progresso (65%)</p>
            <div className="p-4 rounded-lg border bg-background">
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="p-2 rounded-full"
                  style={{ backgroundColor: 'hsl(var(--muted-foreground) / 0.2)' }}
                >
                  {config.mode === 'gift' ? (
                    <Gift className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Truck className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm">
                  Faltam{' '}
                  <span className="font-semibold">
                    R$ {previewRemaining.toFixed(2).replace('.', ',')}
                  </span>{' '}
                  para {config.rewardLabel.toLowerCase()}
                </p>
              </div>
              <Progress 
                value={previewProgress} 
                className="h-2"
                style={{ 
                  '--progress-background': config.progressColor 
                } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Success state preview */}
          <div className="p-4 rounded-lg border bg-muted">
            <p className="text-sm font-medium mb-2">Benefício atingido (100%)</p>
            <div 
              className="p-4 rounded-lg border"
              style={{ 
                backgroundColor: `${config.progressColor}10`,
                borderColor: config.progressColor
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="p-2 rounded-full"
                  style={{ backgroundColor: config.progressColor }}
                >
                  <Truck className="h-4 w-4 text-white" />
                </div>
                <p className="font-semibold" style={{ color: config.progressColor }}>
                  {config.successLabel}
                </p>
              </div>
              <Progress 
                value={100} 
                className="h-2"
                style={{ 
                  '--progress-background': config.progressColor 
                } as React.CSSProperties}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
