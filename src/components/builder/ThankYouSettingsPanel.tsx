// =============================================
// THANK YOU SETTINGS PANEL - Accordion for thank you page settings
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
import { PartyPopper } from 'lucide-react';

// Re-export from source of truth
export type { ThankYouSettings } from '@/hooks/usePageSettings';
export { useThankYouSettings } from '@/hooks/usePageSettings';

import type { ThankYouSettings } from '@/hooks/usePageSettings';
import { useBuilderDraftPageSettings } from '@/hooks/useBuilderDraftPageSettings';

interface ThankYouSettingsPanelProps {
  tenantId: string;
  settings: ThankYouSettings;
  onChange: (settings: ThankYouSettings) => void;
  templateSetId?: string; // Support for template sets
}

export function ThankYouSettingsPanel({
  tenantId,
  settings,
  onChange,
  templateSetId,
}: ThankYouSettingsPanelProps) {
  // Draft page settings hook for real-time preview without auto-save
  const draftPageSettings = useBuilderDraftPageSettings();

  // handleChange agora atualiza o draft local ao invés de salvar no banco
  // O salvamento só ocorre via VisualBuilder.handleSave
  const handleChange = (key: keyof ThankYouSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    onChange(newSettings);
    
    // Atualizar o draft para preview em tempo real
    if (draftPageSettings) {
      draftPageSettings.setDraftPageSettings('thank_you', newSettings);
    }
  };

  return (
    <div className="border-b bg-muted/30">
      <Accordion type="single" collapsible defaultValue="thankyou-settings" className="w-full">
        <AccordionItem value="thankyou-settings" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PartyPopper className="h-4 w-4 text-primary" />
              <span>Configurações de Obrigado</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Timeline */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showTimeline" className="text-sm">
                  Mostrar timeline do pedido
                </Label>
                <Switch
                  id="showTimeline"
                  checked={settings.showTimeline ?? true}
                  onCheckedChange={(checked) => handleChange('showTimeline', checked)}
                />
              </div>

              {/* Order Summary */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showOrderSummary" className="text-sm">
                  Mostrar resumo do pedido
                </Label>
                <Switch
                  id="showOrderSummary"
                  checked={settings.showOrderSummary ?? true}
                  onCheckedChange={(checked) => handleChange('showOrderSummary', checked)}
                />
              </div>

              {/* Upsell */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showUpsell" className="text-sm">
                    Mostrar upsell pós-compra
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ofertas complementares após o pedido
                  </p>
                </div>
                <Switch
                  id="showUpsell"
                  checked={settings.showUpsell ?? true}
                  onCheckedChange={(checked) => handleChange('showUpsell', checked)}
                />
              </div>

              {/* WhatsApp */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showWhatsApp" className="text-sm">
                    Botão de WhatsApp
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Link para suporte via WhatsApp
                  </p>
                </div>
                <Switch
                  id="showWhatsApp"
                  checked={settings.showWhatsApp ?? true}
                  onCheckedChange={(checked) => handleChange('showWhatsApp', checked)}
                />
              </div>

              {/* Tracking Link */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showTrackingLink" className="text-sm">
                  Mostrar link de rastreio
                </Label>
                <Switch
                  id="showTrackingLink"
                  checked={settings.showTrackingLink ?? true}
                  onCheckedChange={(checked) => handleChange('showTrackingLink', checked)}
                />
              </div>

              {/* Social Share */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showSocialShare" className="text-sm">
                  Botões de compartilhamento
                </Label>
                <Switch
                  id="showSocialShare"
                  checked={settings.showSocialShare ?? false}
                  onCheckedChange={(checked) => handleChange('showSocialShare', checked)}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
