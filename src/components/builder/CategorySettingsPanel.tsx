// =============================================
// CATEGORY SETTINGS PANEL - Accordion for category-specific settings
// =============================================

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings2, LayoutGrid, Filter, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

export interface CategorySettings {
  productsPerPage?: number;
  showSorting?: boolean;
  showFilterColumn?: boolean;
  showCategories?: boolean;
  showPriceFilter?: boolean;
  showBrandFilter?: boolean;
  showBanner?: boolean;
}

interface CategorySettingsPanelProps {
  tenantId: string;
  settings: CategorySettings;
  onChange: (settings: CategorySettings) => void;
}

const PRODUCTS_PER_PAGE_OPTIONS = [12, 24, 36, 48, 60];

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-overrides', tenantId, 'category'] });
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
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="category-settings" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Settings2 className="h-4 w-4 text-primary" />
              <span>Configurações da Categoria</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-6">
              {/* Configurações Gerais */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Configurações
                </div>
                
                {/* Produtos por página */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="productsPerPage" className="text-sm">
                    Produtos por página
                  </Label>
                  <Select
                    value={String(settings.productsPerPage || 24)}
                    onValueChange={(value) => handleChange('productsPerPage', Number(value))}
                  >
                    <SelectTrigger className="w-[100px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCTS_PER_PAGE_OPTIONS.map((num) => (
                        <SelectItem key={num} value={String(num)}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mostrar ordenação */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="showSorting" className="text-sm">
                    Mostrar ordenação
                  </Label>
                  <Switch
                    id="showSorting"
                    checked={settings.showSorting ?? true}
                    onCheckedChange={(checked) => handleChange('showSorting', checked)}
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
              </div>

              {/* Coluna de Filtros */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Filter className="h-3.5 w-3.5" />
                  Coluna de Filtros
                </div>

                {/* Exibir coluna de filtros */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="showFilterColumn" className="text-sm">
                    Exibir coluna de filtros
                  </Label>
                  <Switch
                    id="showFilterColumn"
                    checked={settings.showFilterColumn ?? true}
                    onCheckedChange={(checked) => handleChange('showFilterColumn', checked)}
                  />
                </div>

                {/* Mostrar categorias */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="showCategories" className="text-sm">
                    Mostrar categorias
                  </Label>
                  <Switch
                    id="showCategories"
                    checked={settings.showCategories ?? true}
                    onCheckedChange={(checked) => handleChange('showCategories', checked)}
                    disabled={!settings.showFilterColumn}
                  />
                </div>

                {/* Mostrar filtro de preço */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="showPriceFilter" className="text-sm">
                    Mostrar filtro de preço
                  </Label>
                  <Switch
                    id="showPriceFilter"
                    checked={settings.showPriceFilter ?? true}
                    onCheckedChange={(checked) => handleChange('showPriceFilter', checked)}
                    disabled={!settings.showFilterColumn}
                  />
                </div>

                {/* Mostrar filtro de marca */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="showBrandFilter" className="text-sm">
                    Mostrar filtro de marca
                  </Label>
                  <Switch
                    id="showBrandFilter"
                    checked={settings.showBrandFilter ?? true}
                    onCheckedChange={(checked) => handleChange('showBrandFilter', checked)}
                    disabled={!settings.showFilterColumn}
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

// Hook to load category settings
export function useCategorySettings(tenantId: string) {
  const [settings, setSettings] = useState<CategorySettings>({
    productsPerPage: 24,
    showSorting: true,
    showFilterColumn: true,
    showCategories: true,
    showPriceFilter: true,
    showBrandFilter: true,
    showBanner: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      if (!tenantId) return;
      
      try {
        const { data, error } = await supabase
          .from('storefront_page_templates')
          .select('page_overrides')
          .eq('tenant_id', tenantId)
          .eq('page_type', 'category')
          .maybeSingle();

        if (error) throw error;

        const overrides = data?.page_overrides as Record<string, unknown> | null;
        if (overrides?.categorySettings) {
          setSettings(prev => ({ ...prev, ...(overrides.categorySettings as CategorySettings) }));
        }
      } catch (err) {
        console.error('Error loading category settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [tenantId]);

  return { settings, setSettings, isLoading };
}
