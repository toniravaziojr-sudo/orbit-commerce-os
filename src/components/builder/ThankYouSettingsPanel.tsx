// =============================================
// THANK YOU SETTINGS PANEL - Accordion for thank you page settings
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
import { PartyPopper } from 'lucide-react';
import { toast } from 'sonner';

export interface ThankYouSettings {
  showTimeline?: boolean;
  showUpsell?: boolean;
  showWhatsApp?: boolean;
  showOrderSummary?: boolean;
  showTrackingLink?: boolean;
  showSocialShare?: boolean;
}

interface ThankYouSettingsPanelProps {
  tenantId: string;
  settings: ThankYouSettings;
  onChange: (settings: ThankYouSettings) => void;
}

export function ThankYouSettingsPanel({
  tenantId,
  settings,
  onChange,
}: ThankYouSettingsPanelProps) {
  const queryClient = useQueryClient();

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: ThankYouSettings) => {
      // Fetch current page_overrides
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
      queryClient.invalidateQueries({ queryKey: ['page-overrides', tenantId, 'thank_you'] });
      queryClient.invalidateQueries({ queryKey: ['thankYou-settings', tenantId] });
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

// Hook to load thank you settings - using React Query for proper reactivity
// Reads from draft_content when templateSetId is provided (for builder)
export function useThankYouSettings(tenantId: string, templateSetId?: string) {
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useQuery({
    queryKey: ['thankYou-settings', tenantId, templateSetId || 'legacy'],
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
          
          if (pageSettings?.thankYou) {
            return pageSettings.thankYou as ThankYouSettings;
          }
        }
      }
      
      // Fallback: read from storefront_page_templates (legacy)
      const { data, error } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'thank_you')
        .maybeSingle();

      if (error) throw error;

      const overrides = data?.page_overrides as Record<string, unknown> | null;
      return (overrides?.thankYouSettings as ThankYouSettings) || null;
    },
    enabled: !!tenantId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 500,
  });

  const settings: ThankYouSettings = {
    showTimeline: data?.showTimeline ?? true,
    showUpsell: data?.showUpsell ?? true,
    showWhatsApp: data?.showWhatsApp ?? true,
    showOrderSummary: data?.showOrderSummary ?? true,
    showTrackingLink: data?.showTrackingLink ?? true,
    showSocialShare: data?.showSocialShare ?? false,
  };

  const setSettings = (newSettings: ThankYouSettings) => {
    queryClient.setQueryData(['thankYou-settings', tenantId, templateSetId || 'legacy'], newSettings);
  };

  return { settings, setSettings, isLoading };
}
