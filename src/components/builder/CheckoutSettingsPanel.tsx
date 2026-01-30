// =============================================
// CHECKOUT SETTINGS PANEL - Accordion for checkout page settings
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
import { CreditCard } from 'lucide-react';

// Re-export from source of truth
export type { CheckoutSettings } from '@/hooks/usePageSettings';
export { useCheckoutSettings } from '@/hooks/usePageSettings';

import type { CheckoutSettings } from '@/hooks/usePageSettings';
import { useBuilderDraftPageSettings } from '@/hooks/useBuilderDraftPageSettings';

interface CheckoutSettingsPanelProps {
  tenantId: string;
  settings: CheckoutSettings;
  onChange: (settings: CheckoutSettings) => void;
  templateSetId?: string; // Support for multi-template system
}

export function CheckoutSettingsPanel({
  tenantId,
  settings,
  onChange,
  templateSetId,
}: CheckoutSettingsPanelProps) {
  // Draft page settings hook for real-time preview without auto-save
  const draftPageSettings = useBuilderDraftPageSettings();

  // handleChange agora atualiza o draft local ao invés de salvar no banco
  // O salvamento só ocorre via VisualBuilder.handleSave
  const handleChange = (key: keyof CheckoutSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    onChange(newSettings);
    
    // Atualizar o draft para preview em tempo real
    if (draftPageSettings) {
      draftPageSettings.setDraftPageSettings('checkout', newSettings);
    }
  };

  return (
    <div className="border-b bg-muted/30">
      <Accordion type="single" collapsible defaultValue="checkout-settings" className="w-full">
        <AccordionItem value="checkout-settings" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="h-4 w-4 text-primary" />
              <span>Configurações do Checkout</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Timeline */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showTimeline" className="text-sm">
                  Mostrar timeline de etapas
                </Label>
                <Switch
                  id="showTimeline"
                  checked={settings.showTimeline ?? true}
                  onCheckedChange={(checked) => handleChange('showTimeline', checked)}
                />
              </div>

              {/* Cupom */}
              <div className="flex items-center justify-between">
                <Label htmlFor="couponEnabled" className="text-sm">
                  Permitir cupom de desconto
                </Label>
                <Switch
                  id="couponEnabled"
                  checked={settings.couponEnabled ?? true}
                  onCheckedChange={(checked) => handleChange('couponEnabled', checked)}
                />
              </div>

              {/* Order Bump */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showOrderBump" className="text-sm">
                    Mostrar Order Bump
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ofertas extras na etapa de pagamento
                  </p>
                </div>
                <Switch
                  id="showOrderBump"
                  checked={settings.showOrderBump ?? true}
                  onCheckedChange={(checked) => handleChange('showOrderBump', checked)}
                />
              </div>

              {/* Testimonials */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="testimonialsEnabled" className="text-sm">
                    Mostrar depoimentos
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Prova social durante o checkout
                  </p>
                </div>
                <Switch
                  id="testimonialsEnabled"
                  checked={settings.testimonialsEnabled ?? true}
                  onCheckedChange={(checked) => handleChange('testimonialsEnabled', checked)}
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

              {/* Security seals */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showSecuritySeals" className="text-sm">
                  Mostrar selos de segurança
                </Label>
                <Switch
                  id="showSecuritySeals"
                  checked={settings.showSecuritySeals ?? true}
                  onCheckedChange={(checked) => handleChange('showSecuritySeals', checked)}
                />
              </div>

              {/* PAYMENT METHODS SECTION */}
              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-3">Formas de Pagamento</p>
                
                {/* PIX */}
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="showPix" className="text-sm">
                    Exibir PIX
                  </Label>
                  <Switch
                    id="showPix"
                    checked={settings.showPix ?? true}
                    onCheckedChange={(checked) => handleChange('showPix', checked)}
                  />
                </div>

                {/* Boleto */}
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="showBoleto" className="text-sm">
                    Exibir Boleto
                  </Label>
                  <Switch
                    id="showBoleto"
                    checked={settings.showBoleto ?? true}
                    onCheckedChange={(checked) => handleChange('showBoleto', checked)}
                  />
                </div>

                {/* Credit Card */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="showCreditCard" className="text-sm">
                    Exibir Cartão de Crédito
                  </Label>
                  <Switch
                    id="showCreditCard"
                    checked={settings.showCreditCard ?? true}
                    onCheckedChange={(checked) => handleChange('showCreditCard', checked)}
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
