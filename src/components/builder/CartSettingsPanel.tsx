// =============================================
// CART SETTINGS PANEL - Accordion for cart page settings
// Conforme docs/REGRAS.md - Pattern padrão para páginas do builder
// =============================================
//
// NOTA: Interface e hook vindos de usePageSettings.ts (fonte única de verdade)
//
// MUDANÇA: Não faz mais auto-save. Usa draft local para preview
// O salvamento só ocorre via VisualBuilder.handleSave
// =============================================

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ShoppingCart } from 'lucide-react';

// Re-export from source of truth
export type { CartSettings } from '@/hooks/usePageSettings';
export { useCartSettings } from '@/hooks/usePageSettings';

import type { CartSettings } from '@/hooks/usePageSettings';
import { useBuilderDraftPageSettings } from '@/hooks/useBuilderDraftPageSettings';

interface CartSettingsPanelProps {
  tenantId: string;
  settings: CartSettings;
  onChange: (settings: CartSettings) => void;
  templateSetId?: string; // Support for multi-template system
}

export function CartSettingsPanel({
  tenantId,
  settings,
  onChange,
  templateSetId,
}: CartSettingsPanelProps) {
  // Draft page settings hook for real-time preview without auto-save
  const draftPageSettings = useBuilderDraftPageSettings();

  // handleChange agora atualiza o draft local ao invés de salvar no banco
  // O salvamento só ocorre via VisualBuilder.handleSave
  const handleChange = (key: keyof CartSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    onChange(newSettings);
    
    // Atualizar o draft para preview em tempo real
    if (draftPageSettings) {
      draftPageSettings.setDraftPageSettings('cart', newSettings);
    }
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
