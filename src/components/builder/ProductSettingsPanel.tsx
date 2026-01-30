// =============================================
// PRODUCT SETTINGS PANEL - Accordion for product page settings
// =============================================
//
// NOTA: Interface e hook centralizados em @/hooks/usePageSettings
// Este arquivo re-exporta para compatibilidade
//
// MUDANÇA: Não faz mais auto-save. Usa draft local para preview
// O salvamento só ocorre via VisualBuilder.handleSave
// =============================================

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Settings2, ShoppingCart } from 'lucide-react';

// Re-exportar interface da fonte única de verdade
import type { ProductSettings } from '@/hooks/usePageSettings';
import { DEFAULT_PRODUCT_SETTINGS } from '@/hooks/usePageSettings';
import { useBuilderDraftPageSettings } from '@/hooks/useBuilderDraftPageSettings';
export type { ProductSettings };

interface ProductSettingsPanelProps {
  tenantId: string;
  settings: ProductSettings;
  onChange: (settings: ProductSettings) => void;
  templateSetId?: string;
}

export function ProductSettingsPanel({
  tenantId,
  settings,
  onChange,
  templateSetId,
}: ProductSettingsPanelProps) {
  // Draft page settings hook for real-time preview without auto-save
  const draftPageSettings = useBuilderDraftPageSettings();

  // handleChange agora atualiza o draft local ao invés de salvar no banco
  // O salvamento só ocorre via VisualBuilder.handleSave
  const handleChange = useCallback((key: keyof ProductSettings, value: boolean | string) => {
    const newSettings = { ...settings, [key]: value };
    onChange(newSettings);
    
    // Atualizar o draft para preview em tempo real
    if (draftPageSettings) {
      draftPageSettings.setDraftPageSettings('product', newSettings);
    }
  }, [settings, onChange, draftPageSettings]);

  return (
    <div className="border-b bg-muted/30">
      {/* Template info notice */}
      <div className="px-4 py-2 bg-primary/10 border-b border-primary/20">
        <p className="text-xs text-primary">
          <strong>Template de Produto:</strong> Este layout será usado por todos os produtos. O "Produto de Exemplo" serve apenas para visualizar dados.
        </p>
      </div>
      <Accordion type="single" collapsible defaultValue="product-settings" className="w-full">
        <AccordionItem value="product-settings" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Settings2 className="h-4 w-4 text-primary" />
              <span>Configurações do Produto</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Mostrar galeria */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showGallery" className="text-sm">
                  Mostrar Galeria
                </Label>
                <Switch
                  id="showGallery"
                  checked={settings.showGallery ?? true}
                  onCheckedChange={(checked) => handleChange('showGallery', checked)}
                />
              </div>

              {/* Mostrar descrição */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showDescription" className="text-sm">
                  Mostrar Descrição
                </Label>
                <Switch
                  id="showDescription"
                  checked={settings.showDescription ?? true}
                  onCheckedChange={(checked) => handleChange('showDescription', checked)}
                />
              </div>

              {/* Mostrar variações */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showVariants" className="text-sm">
                  Mostrar variações
                </Label>
                <Switch
                  id="showVariants"
                  checked={settings.showVariants ?? true}
                  onCheckedChange={(checked) => handleChange('showVariants', checked)}
                />
              </div>

              {/* Mostrar estoque */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showStock" className="text-sm">
                  Mostrar Estoque
                </Label>
                <Switch
                  id="showStock"
                  checked={settings.showStock ?? true}
                  onCheckedChange={(checked) => handleChange('showStock', checked)}
                />
              </div>

              {/* Mostrar produtos relacionados */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showRelatedProducts" className="text-sm">
                  Mostrar Produtos Relacionados
                </Label>
                <Switch
                  id="showRelatedProducts"
                  checked={settings.showRelatedProducts ?? true}
                  onCheckedChange={(checked) => handleChange('showRelatedProducts', checked)}
                />
              </div>

              {/* Mostrar compre junto */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showBuyTogether" className="text-sm">
                  Mostrar Compre Junto
                </Label>
                <Switch
                  id="showBuyTogether"
                  checked={settings.showBuyTogether ?? true}
                  onCheckedChange={(checked) => handleChange('showBuyTogether', checked)}
                />
              </div>

              {/* Mostrar avaliações */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showReviews" className="text-sm">
                  Mostrar Avaliações
                </Label>
                <Switch
                  id="showReviews"
                  checked={settings.showReviews ?? true}
                  onCheckedChange={(checked) => handleChange('showReviews', checked)}
                />
              </div>

              {/* Mostrar selos */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showBadges" className="text-sm">
                  Mostrar Selos
                </Label>
                <Switch
                  id="showBadges"
                  checked={settings.showBadges ?? true}
                  onCheckedChange={(checked) => handleChange('showBadges', checked)}
                />
              </div>

              {/* Calculadora de frete */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showShippingCalculator" className="text-sm">
                    Calculadora de frete
                  </Label>
                  <p className="text-xs text-muted-foreground">Cálculo de frete por CEP</p>
                </div>
                <Switch
                  id="showShippingCalculator"
                  checked={settings.showShippingCalculator ?? true}
                  onCheckedChange={(checked) => handleChange('showShippingCalculator', checked)}
                />
              </div>

              {/* Divider */}
              <hr className="my-2" />

              {/* Info about cart action - now centralized in MiniCartSettings */}
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-sm font-medium">Ação do Carrinho</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure em <strong>Configurações do tema → Carrinho Suspenso</strong>
                </p>
              </div>

              {/* Divider */}
              <hr className="my-2" />

              {/* Mostrar botão WhatsApp */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showWhatsAppButton" className="text-sm">
                  Mostrar botão WhatsApp
                </Label>
                <Switch
                  id="showWhatsAppButton"
                  checked={settings.showWhatsAppButton ?? true}
                  onCheckedChange={(checked) => handleChange('showWhatsAppButton', checked)}
                />
              </div>

              {/* Mostrar botão Adicionar ao carrinho */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showAddToCartButton" className="text-sm">
                    Mostrar Adicionar ao carrinho
                  </Label>
                </div>
                <Switch
                  id="showAddToCartButton"
                  checked={settings.showAddToCartButton ?? true}
                  onCheckedChange={(checked) => handleChange('showAddToCartButton', checked)}
                />
              </div>

              {/* Divider */}
              <hr className="my-2" />

              {/* Texto do botão principal */}
              <div className="space-y-2">
                <Label htmlFor="buyNowButtonText" className="text-sm">
                  Texto do botão principal
                </Label>
                <Input
                  id="buyNowButtonText"
                  value={settings.buyNowButtonText ?? 'Comprar agora'}
                  onChange={(e) => handleChange('buyNowButtonText', e.target.value)}
                  placeholder="Comprar agora"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// =============================================
// HOOK - Centralizado em usePageSettings.ts
// Re-exportado aqui para compatibilidade com imports existentes
// =============================================

export function useProductSettings(tenantId: string, templateSetId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['product-settings-builder', tenantId, templateSetId || 'legacy'];
  
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenantId) return null;
      
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
          
          if (pageSettings?.product) {
            return pageSettings.product as ProductSettings;
          }
        }
      }
      
      const { data, error } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'product')
        .maybeSingle();

      if (error) throw error;

      const overrides = data?.page_overrides as Record<string, unknown> | null;
      return (overrides?.productSettings as ProductSettings) || null;
    },
    enabled: !!tenantId,
    staleTime: 5000, // Cache for 5 seconds to avoid excessive polling
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Merge defaults with fetched data - data takes precedence
  const settings: ProductSettings = {
    ...DEFAULT_PRODUCT_SETTINGS,
    ...(data || {}),
  };

  const setSettings = (newSettings: ProductSettings) => {
    queryClient.setQueryData(queryKey, newSettings);
  };

  return { settings, setSettings, isLoading };
}
