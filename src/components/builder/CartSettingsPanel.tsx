// =============================================
// CART SETTINGS PANEL - Accordion for cart page settings
// Conforme docs/REGRAS.md - Pattern padrão para páginas do builder
// =============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

export interface CartSettings {
  showCrossSell?: boolean;
  couponEnabled?: boolean;
  shippingCalculatorEnabled?: boolean;
  showTrustBadges?: boolean;
  showBenefitBar?: boolean;
  showPromoBanner?: boolean;
}

interface CartSettingsPanelProps {
  tenantId: string;
  settings: CartSettings;
  onChange: (settings: CartSettings) => void;
}

export function CartSettingsPanel({
  tenantId,
  settings,
  onChange,
}: CartSettingsPanelProps) {
  const queryClient = useQueryClient();

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: CartSettings) => {
      // Fetch current page_overrides
      const { data: template, error: fetchError } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'cart')
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentOverrides = (template?.page_overrides as Record<string, unknown>) || {};
      
      const updatedOverrides = {
        ...currentOverrides,
        cartSettings: newSettings,
      };

      const { error } = await supabase
        .from('storefront_page_templates')
        .update({ page_overrides: updatedOverrides as unknown as Json })
        .eq('tenant_id', tenantId)
        .eq('page_type', 'cart');

      if (error) throw error;
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-overrides', tenantId, 'cart'] });
      queryClient.invalidateQueries({ queryKey: ['cart-settings', tenantId] });
      // Toast removido para evitar spam durante edição contínua
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleChange = (key: keyof CartSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    onChange(newSettings);
    saveMutation.mutate(newSettings);
  };

  return (
    <div className="border-b bg-muted/30">
      <Accordion type="single" collapsible defaultValue="cart-settings" className="w-full">
        <AccordionItem value="cart-settings" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span>Configurações do Carrinho</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Calculadora de frete */}
              <div className="flex items-center justify-between">
                <Label htmlFor="shippingCalculatorEnabled" className="text-sm">
                  Calculadora de frete
                </Label>
                <Switch
                  id="shippingCalculatorEnabled"
                  checked={settings.shippingCalculatorEnabled ?? true}
                  onCheckedChange={(checked) => handleChange('shippingCalculatorEnabled', checked)}
                />
              </div>

              {/* Campo de cupom */}
              <div className="flex items-center justify-between">
                <Label htmlFor="couponEnabled" className="text-sm">
                  Campo de cupom de desconto
                </Label>
                <Switch
                  id="couponEnabled"
                  checked={settings.couponEnabled ?? true}
                  onCheckedChange={(checked) => handleChange('couponEnabled', checked)}
                />
              </div>

              {/* Cross-sell */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showCrossSell" className="text-sm">
                  Mostrar produtos sugeridos
                </Label>
                <Switch
                  id="showCrossSell"
                  checked={settings.showCrossSell ?? true}
                  onCheckedChange={(checked) => handleChange('showCrossSell', checked)}
                />
              </div>

              {/* Trust badges */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showTrustBadges" className="text-sm">
                  Mostrar selos de confiança
                </Label>
                <Switch
                  id="showTrustBadges"
                  checked={settings.showTrustBadges ?? true}
                  onCheckedChange={(checked) => handleChange('showTrustBadges', checked)}
                />
              </div>

              {/* Benefit bar */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showBenefitBar" className="text-sm">
                  Mostrar barra de benefícios
                </Label>
                <Switch
                  id="showBenefitBar"
                  checked={settings.showBenefitBar ?? true}
                  onCheckedChange={(checked) => handleChange('showBenefitBar', checked)}
                />
              </div>

              {/* Promo banner */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showPromoBanner" className="text-sm">
                  Mostrar banner promocional
                </Label>
                <Switch
                  id="showPromoBanner"
                  checked={settings.showPromoBanner ?? true}
                  onCheckedChange={(checked) => handleChange('showPromoBanner', checked)}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// Hook to load cart settings - using React Query for proper reactivity
// Reads from draft_content when templateSetId is provided (for builder)
export function useCartSettings(tenantId: string, templateSetId?: string) {
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useQuery({
    queryKey: ['cart-settings', tenantId, templateSetId || 'legacy'],
    queryFn: async () => {
      if (!tenantId) return null;
      
      // If templateSetId is provided, read from draft_content
      if (templateSetId) {
        const { data: templateSet, error: tsError } = await supabase
          .from('storefront_template_sets')
          .select('draft_content')
          .eq('id', templateSetId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (!tsError && templateSet?.draft_content) {
          const draftContent = templateSet.draft_content as Record<string, unknown>;
          const themeSettings = draftContent.themeSettings as Record<string, unknown> | undefined;
          const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
          
          if (pageSettings?.cart) {
            return pageSettings.cart as CartSettings;
          }
        }
      }
      
      // Fallback: read from storefront_page_templates (legacy)
      const { data, error } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'cart')
        .maybeSingle();

      if (error) throw error;

      const overrides = data?.page_overrides as Record<string, unknown> | null;
      return (overrides?.cartSettings as CartSettings) || null;
    },
    enabled: !!tenantId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 500,
  });

  const settings: CartSettings = {
    showCrossSell: data?.showCrossSell ?? true,
    couponEnabled: data?.couponEnabled ?? true,
    shippingCalculatorEnabled: data?.shippingCalculatorEnabled ?? true,
    showTrustBadges: data?.showTrustBadges ?? true,
    showBenefitBar: data?.showBenefitBar ?? true,
    showPromoBanner: data?.showPromoBanner ?? true,
  };

  const setSettings = (newSettings: CartSettings) => {
    queryClient.setQueryData(['cart-settings', tenantId, templateSetId || 'legacy'], newSettings);
  };

  return { settings, setSettings, isLoading };
}
