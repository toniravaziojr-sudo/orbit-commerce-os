// =============================================
// THANK YOU SETTINGS PANEL - Accordion for thank you page settings
// Conforme docs/REGRAS.md - Pattern padrão para páginas do builder
// =============================================
// NOTA: Interface e hook vindos de usePageSettings.ts (fonte única de verdade)
// FIX: Agora salva em draft_content quando templateSetId está disponível

import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { PartyPopper } from 'lucide-react';
import { toast } from 'sonner';

// Re-export from source of truth
export type { ThankYouSettings } from '@/hooks/usePageSettings';
export { useThankYouSettings } from '@/hooks/usePageSettings';

import type { ThankYouSettings } from '@/hooks/usePageSettings';

interface ThankYouSettingsPanelProps {
  tenantId: string;
  settings: ThankYouSettings;
  onChange: (settings: ThankYouSettings) => void;
  templateSetId?: string; // NEW: Support for template sets
}

export function ThankYouSettingsPanel({
  tenantId,
  settings,
  onChange,
  templateSetId,
}: ThankYouSettingsPanelProps) {
  const queryClient = useQueryClient();

  // Save mutation - follows ProductSettingsPanel pattern
  const saveMutation = useMutation({
    mutationFn: async (newSettings: ThankYouSettings) => {
      // If templateSetId is available, save to draft_content (new system)
      if (templateSetId) {
        const { data: templateSet, error: fetchError } = await supabase
          .from('storefront_template_sets')
          .select('draft_content')
          .eq('id', templateSetId)
          .eq('tenant_id', tenantId)
          .single();
        
        if (fetchError) throw fetchError;
        
        const currentDraftContent = (templateSet.draft_content as Record<string, unknown>) || {};
        const currentThemeSettings = (currentDraftContent.themeSettings as Record<string, unknown>) || {};
        const currentPageSettings = (currentThemeSettings.pageSettings as Record<string, unknown>) || {};
        
        const updatedDraftContent = {
          ...currentDraftContent,
          themeSettings: {
            ...currentThemeSettings,
            pageSettings: {
              ...currentPageSettings,
              thankYou: newSettings,
            },
          },
        };
        
        const { error } = await supabase
          .from('storefront_template_sets')
          .update({ 
            draft_content: updatedDraftContent as unknown as Json,
            last_edited_at: new Date().toISOString(),
          })
          .eq('id', templateSetId)
          .eq('tenant_id', tenantId);
        
        if (error) throw error;
        return newSettings;
      }
      
      // Fallback: save to legacy table (storefront_page_templates)
      const { data: template, error: fetchError } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'thank_you')
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentOverrides = (template?.page_overrides as Record<string, unknown>) || {};
      
      const updatedOverrides = {
        ...currentOverrides,
        thankYouSettings: newSettings,
      };

      const { error } = await supabase
        .from('storefront_page_templates')
        .update({ page_overrides: updatedOverrides as unknown as Json })
        .eq('tenant_id', tenantId)
        .eq('page_type', 'thank_you');

      if (error) throw error;
      return newSettings;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['page-overrides', tenantId, 'thank_you'] });
      queryClient.invalidateQueries({ queryKey: ['thankYou-settings-builder', tenantId] });
      if (templateSetId) {
        queryClient.invalidateQueries({ queryKey: ['template-set-draft', templateSetId] });
      }
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleChange = (key: keyof ThankYouSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    onChange(newSettings);
    saveMutation.mutate(newSettings);
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
