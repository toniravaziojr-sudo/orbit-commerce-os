// =============================================
// MINI CART SETTINGS - Carrinho Suspenso configuration
// =============================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface MiniCartSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

interface MiniCartConfig {
  enabled: boolean;
  showGoToCartButton: boolean;
  showCrossSell: boolean;
  showCoupon: boolean;
  showShippingCalculator: boolean;
}

const DEFAULT_CONFIG: MiniCartConfig = {
  enabled: true,
  showGoToCartButton: true,
  showCrossSell: true,
  showCoupon: true,
  showShippingCalculator: false,
};

export function MiniCartSettings({ tenantId, templateSetId }: MiniCartSettingsProps) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<MiniCartConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      if (!tenantId) return;
      
      try {
        const { data, error } = await supabase
          .from('store_settings')
          .select('mini_cart_config')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error) throw error;

        if (data?.mini_cart_config) {
          setConfig({ ...DEFAULT_CONFIG, ...(data.mini_cart_config as MiniCartConfig) });
        }
      } catch (err) {
        console.error('Error loading mini cart settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [tenantId]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newConfig: MiniCartConfig) => {
      const { error } = await supabase
        .from('store_settings')
        .update({ mini_cart_config: newConfig as unknown as Json })
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return newConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings', tenantId] });
      toast.success('Configurações salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleChange = (key: keyof MiniCartConfig, value: boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    saveMutation.mutate(newConfig);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Configure o mini-carrinho que aparece ao adicionar produtos
      </p>

      {/* Main toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Ativar carrinho suspenso</Label>
          <p className="text-xs text-muted-foreground">
            Exibe drawer lateral ao adicionar produtos
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => handleChange('enabled', checked)}
        />
      </div>

      {config.enabled && (
        <>
          <Separator />
          
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Funcionalidades do carrinho suspenso
            </p>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Botão "Ir para Carrinho"</Label>
                <p className="text-xs text-muted-foreground">
                  Link para página completa do carrinho
                </p>
              </div>
              <Switch
                checked={config.showGoToCartButton}
                onCheckedChange={(checked) => handleChange('showGoToCartButton', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Mostrar Cross-sell</Label>
                <p className="text-xs text-muted-foreground">
                  Sugestões de produtos adicionais
                </p>
              </div>
              <Switch
                checked={config.showCrossSell}
                onCheckedChange={(checked) => handleChange('showCrossSell', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Campo de Cupom</Label>
                <p className="text-xs text-muted-foreground">
                  Permite aplicar cupom no mini-carrinho
                </p>
              </div>
              <Switch
                checked={config.showCoupon}
                onCheckedChange={(checked) => handleChange('showCoupon', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Calculadora de Frete</Label>
                <p className="text-xs text-muted-foreground">
                  Calcular frete no mini-carrinho
                </p>
              </div>
              <Switch
                checked={config.showShippingCalculator}
                onCheckedChange={(checked) => handleChange('showShippingCalculator', checked)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
