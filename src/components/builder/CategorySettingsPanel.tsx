// =============================================
// CATEGORY SETTINGS PANEL - Accordion for category-specific settings
// Conforme docs/REGRAS.md - Funções padrões da página de Categoria
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
import { Input } from '@/components/ui/input';
import { Settings2 } from 'lucide-react';
import { toast } from 'sonner';

export interface CategorySettings {
  showCategoryName?: boolean;
  showBanner?: boolean;
  showRatings?: boolean;
  quickBuyEnabled?: boolean;
  showAddToCartButton?: boolean;
  showBadges?: boolean;
  buyNowButtonText?: string;
  customButtonEnabled?: boolean;
  customButtonText?: string;
  customButtonColor?: string;
  customButtonLink?: string;
}

interface CategorySettingsPanelProps {
  tenantId: string;
  settings: CategorySettings;
  onChange: (settings: CategorySettings) => void;
}

export function CategorySettingsPanel({
  tenantId,
  settings,
  onChange,
}: CategorySettingsPanelProps) {
  const queryClient = useQueryClient();

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: CategorySettings) => {
      // Fetch current page_overrides
      const { data: template, error: fetchError } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'category')
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentOverrides = (template?.page_overrides as Record<string, unknown>) || {};
      
      const updatedOverrides = {
        ...currentOverrides,
        categorySettings: newSettings,
      };

      const { error } = await supabase
        .from('storefront_page_templates')
        .update({ page_overrides: updatedOverrides as unknown as Json })
        .eq('tenant_id', tenantId)
        .eq('page_type', 'category');

      if (error) throw error;
      return newSettings;
    },
    onSuccess: (newSettings) => {
      // Invalidate both queries to ensure sync
      queryClient.invalidateQueries({ queryKey: ['page-overrides', tenantId, 'category'] });
      queryClient.invalidateQueries({ queryKey: ['category-settings', tenantId] });
      toast.success('Configurações salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleChange = (key: keyof CategorySettings, value: unknown) => {
    const newSettings = { ...settings, [key]: value };
    onChange(newSettings);
    saveMutation.mutate(newSettings);
  };

  return (
    <div className="border-b bg-muted/30">
      <Accordion type="single" collapsible defaultValue="category-settings" className="w-full">
        <AccordionItem value="category-settings" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Settings2 className="h-4 w-4 text-primary" />
              <span>Configurações da Categoria</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Exibir nome da categoria */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showCategoryName" className="text-sm">
                  Exibir nome da categoria
                </Label>
                <Switch
                  id="showCategoryName"
                  checked={settings.showCategoryName ?? true}
                  onCheckedChange={(checked) => handleChange('showCategoryName', checked)}
                />
              </div>

              {/* Exibir banner */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showBanner" className="text-sm">
                  Exibir banner da categoria
                </Label>
                <Switch
                  id="showBanner"
                  checked={settings.showBanner ?? true}
                  onCheckedChange={(checked) => handleChange('showBanner', checked)}
                />
              </div>

              {/* Exibir avaliações nos cards */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showRatings" className="text-sm">
                  Mostrar avaliações nos produtos
                </Label>
                <Switch
                  id="showRatings"
                  checked={settings.showRatings ?? true}
                  onCheckedChange={(checked) => handleChange('showRatings', checked)}
                />
              </div>

              {/* Exibir selos */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showBadges" className="text-sm">
                  Mostrar selos nos produtos
                </Label>
                <Switch
                  id="showBadges"
                  checked={settings.showBadges ?? true}
                  onCheckedChange={(checked) => handleChange('showBadges', checked)}
                />
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Botões da Thumb</p>
                
                {/* Exibir botão adicionar ao carrinho */}
                <div className="flex items-center justify-between mb-3">
                  <Label htmlFor="showAddToCartButton" className="text-sm">
                    Exibir "Adicionar ao carrinho"
                  </Label>
                  <Switch
                    id="showAddToCartButton"
                    checked={settings.showAddToCartButton ?? true}
                    onCheckedChange={(checked) => handleChange('showAddToCartButton', checked)}
                  />
                </div>

                {/* Compra rápida */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Label htmlFor="quickBuyEnabled" className="text-sm">
                      Ativar compra rápida
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Botão principal vai direto ao checkout
                    </p>
                  </div>
                  <Switch
                    id="quickBuyEnabled"
                    checked={settings.quickBuyEnabled ?? false}
                    onCheckedChange={(checked) => handleChange('quickBuyEnabled', checked)}
                  />
                </div>

                {/* Texto do botão principal */}
                <div className="space-y-2 mb-3">
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

              {/* Botão personalizado */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Label htmlFor="customButtonEnabled" className="text-sm">
                      Botão personalizado
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Adiciona um botão extra no meio
                    </p>
                  </div>
                  <Switch
                    id="customButtonEnabled"
                    checked={settings.customButtonEnabled ?? false}
                    onCheckedChange={(checked) => handleChange('customButtonEnabled', checked)}
                  />
                </div>

                {settings.customButtonEnabled && (
                  <div className="space-y-3 pl-0">
                    <div className="space-y-1">
                      <Label className="text-xs">Texto</Label>
                      <Input
                        value={settings.customButtonText ?? ''}
                        onChange={(e) => handleChange('customButtonText', e.target.value)}
                        placeholder="Ex: Ver detalhes"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cor (hex)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={settings.customButtonColor || '#6366f1'}
                          onChange={(e) => handleChange('customButtonColor', e.target.value)}
                          className="h-8 w-12 p-1"
                        />
                        <Input
                          value={settings.customButtonColor ?? ''}
                          onChange={(e) => handleChange('customButtonColor', e.target.value)}
                          placeholder="#6366f1"
                          className="h-8 text-sm flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Link</Label>
                      <Input
                        value={settings.customButtonLink ?? ''}
                        onChange={(e) => handleChange('customButtonLink', e.target.value)}
                        placeholder="https://..."
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// Hook to load category settings - now using React Query for proper reactivity
export function useCategorySettings(tenantId: string) {
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useQuery({
    queryKey: ['category-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'category')
        .maybeSingle();

      if (error) throw error;

      const overrides = data?.page_overrides as Record<string, unknown> | null;
      return (overrides?.categorySettings as CategorySettings) || null;
    },
    enabled: !!tenantId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const settings: CategorySettings = {
    showCategoryName: data?.showCategoryName ?? true,
    showBanner: data?.showBanner ?? true,
    showRatings: data?.showRatings ?? true,
    showBadges: data?.showBadges ?? true,
    showAddToCartButton: data?.showAddToCartButton ?? true,
    quickBuyEnabled: data?.quickBuyEnabled ?? false,
    buyNowButtonText: data?.buyNowButtonText ?? 'Comprar agora',
    customButtonEnabled: data?.customButtonEnabled ?? false,
    customButtonText: data?.customButtonText ?? '',
    customButtonColor: data?.customButtonColor ?? '',
    customButtonLink: data?.customButtonLink ?? '',
  };

  const setSettings = (newSettings: CategorySettings) => {
    queryClient.setQueryData(['category-settings', tenantId], newSettings);
  };

  return { settings, setSettings, isLoading };
}
