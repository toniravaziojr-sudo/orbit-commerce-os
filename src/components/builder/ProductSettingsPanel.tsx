// =============================================
// PRODUCT SETTINGS PANEL - Accordion for product page settings
// =============================================
//
// NOTA: Interface e hook centralizados em @/hooks/usePageSettings
// Este arquivo re-exporta para compatibilidade
// =============================================

import { useState, useEffect, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings2, Info } from 'lucide-react';
import { toast } from 'sonner';

// Re-exportar interface da fonte única de verdade
import type { ProductSettings } from '@/hooks/usePageSettings';
import { DEFAULT_PRODUCT_SETTINGS } from '@/hooks/usePageSettings';
export type { ProductSettings };

interface ProductSettingsPanelProps {
  tenantId: string;
  settings: ProductSettings;
  onChange: (settings: ProductSettings) => void;
  onPreviewCart?: (type: 'miniCart' | 'floatingCart') => void;
  templateSetId?: string;
}

export function ProductSettingsPanel({
  tenantId,
  settings,
  onChange,
  onPreviewCart,
  templateSetId,
}: ProductSettingsPanelProps) {
  const queryClient = useQueryClient();
  const [showCartPreviewNotice, setShowCartPreviewNotice] = useState<'miniCart' | 'floatingCart' | null>(null);

  // Auto-hide notice after 5 seconds
  useEffect(() => {
    if (showCartPreviewNotice) {
      const timer = setTimeout(() => {
        setShowCartPreviewNotice(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showCartPreviewNotice]);

  // Save mutation - supports both template set and legacy systems
  const saveMutation = useMutation({
    mutationFn: async (newSettings: ProductSettings) => {
      // If templateSetId is available, save to draft_content
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
              product: newSettings,
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
      
      // Fallback to legacy system
      const { data: template, error: fetchError } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'product')
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentOverrides = (template?.page_overrides as Record<string, unknown>) || {};
      
      const updatedOverrides = {
        ...currentOverrides,
        productSettings: newSettings,
      };

      const { error } = await supabase
        .from('storefront_page_templates')
        .update({ page_overrides: updatedOverrides as unknown as Json })
        .eq('tenant_id', tenantId)
        .eq('page_type', 'product');

      if (error) throw error;
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-overrides', tenantId, 'product'] });
      queryClient.invalidateQueries({ queryKey: ['product-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['product-settings-builder', tenantId, templateSetId || 'legacy'] });
      toast.success('Configurações salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleChange = useCallback((key: keyof ProductSettings, value: boolean | string) => {
    const newSettings = { ...settings, [key]: value };
    onChange(newSettings);
    saveMutation.mutate(newSettings);

    // Se ativar carrinho suspenso ou carrinho rápido, mostrar preview temporário
    if (value === true) {
      if (key === 'openMiniCartOnAdd') {
        setShowCartPreviewNotice('miniCart');
        onPreviewCart?.('miniCart');
      } else if (key === 'showFloatingCart') {
        setShowCartPreviewNotice('floatingCart');
        onPreviewCart?.('floatingCart');
      }
    }
  }, [settings, onChange, saveMutation, onPreviewCart]);

  return (
    <div className="border-b bg-muted/30">
      {/* Template info notice */}
      <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
        <p className="text-xs text-blue-700 dark:text-blue-300">
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

              {/* Abrir carrinho suspenso */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="openMiniCartOnAdd" className="text-sm">
                      Abrir carrinho suspenso ao adicionar
                    </Label>
                    <p className="text-xs text-muted-foreground">Abre o mini-carrinho lateral</p>
                  </div>
                  <Switch
                    id="openMiniCartOnAdd"
                    checked={settings.openMiniCartOnAdd ?? true}
                    onCheckedChange={(checked) => handleChange('openMiniCartOnAdd', checked)}
                  />
                </div>
                {showCartPreviewNotice === 'miniCart' && (
                  <Alert className="bg-blue-500/10 border-blue-500/30">
                    <Info className="h-4 w-4 text-blue-500" />
                    <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                      Prévia ativada por 5 segundos. As configurações do carrinho suspenso estão em <strong>Configurações do tema</strong>.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Carrinho rápido (popup flutuante) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="showFloatingCart" className="text-sm">
                      Botão "Ir para Carrinho"
                    </Label>
                    <p className="text-xs text-muted-foreground">Link para página completa do carrinho</p>
                  </div>
                  <Switch
                    id="showFloatingCart"
                    checked={settings.showFloatingCart ?? true}
                    onCheckedChange={(checked) => handleChange('showFloatingCart', checked)}
                  />
                </div>
                {showCartPreviewNotice === 'floatingCart' && (
                  <Alert className="bg-blue-500/10 border-blue-500/30">
                    <Info className="h-4 w-4 text-blue-500" />
                    <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                      Prévia ativada por 5 segundos. As configurações do carrinho são feitas em <strong>Configurações do tema</strong>.
                    </AlertDescription>
                  </Alert>
                )}
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
                <Label htmlFor="showAddToCartButton" className="text-sm">
                  Mostrar Adicionar ao carrinho
                </Label>
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
            console.log('[useProductSettings] Loaded from template set:', pageSettings.product);
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
    staleTime: 0,
    gcTime: 0, // Don't cache - always refetch
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 300, // Faster polling
  });

  // Merge defaults with fetched data - data takes precedence
  const settings: ProductSettings = {
    ...DEFAULT_PRODUCT_SETTINGS,
    ...(data || {}),
  };
  
  // Debug log
  console.log('[useProductSettings] Final settings:', { templateSetId, data, settings });

  const setSettings = (newSettings: ProductSettings) => {
    queryClient.setQueryData(queryKey, newSettings);
  };

  return { settings, setSettings, isLoading };
}
