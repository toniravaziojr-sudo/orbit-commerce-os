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
import { Settings2 } from 'lucide-react';
import { toast } from 'sonner';

export interface CategorySettings {
  showCategoryName?: boolean;
  showBanner?: boolean;
  showRatings?: boolean;
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
    showCategoryName: true,
    showBanner: true,
    showRatings: true,
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
