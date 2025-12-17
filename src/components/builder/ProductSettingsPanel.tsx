// =============================================
// PRODUCT SETTINGS PANEL - Accordion for product page settings
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

export interface ProductSettings {
  showGallery?: boolean;
  showDescription?: boolean;
  showVariants?: boolean;
  showStock?: boolean;
  showRelatedProducts?: boolean;
  showBuyTogether?: boolean;
  showReviews?: boolean;
}

interface ProductSettingsPanelProps {
  tenantId: string;
  settings: ProductSettings;
  onChange: (settings: ProductSettings) => void;
}

export function ProductSettingsPanel({
  tenantId,
  settings,
  onChange,
}: ProductSettingsPanelProps) {
  const queryClient = useQueryClient();

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: ProductSettings) => {
      // Fetch current page_overrides
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
      toast.success('Configurações salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleChange = (key: keyof ProductSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    onChange(newSettings);
    saveMutation.mutate(newSettings);
  };

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

              {/* Mostrar variantes */}
              <div className="flex items-center justify-between">
                <Label htmlFor="showVariants" className="text-sm">
                  Mostrar Variantes
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// Hook to load product settings
export function useProductSettings(tenantId: string) {
  const [settings, setSettings] = useState<ProductSettings>({
    showGallery: true,
    showDescription: true,
    showVariants: true,
    showStock: true,
    showRelatedProducts: true,
    showBuyTogether: true,
    showReviews: true,
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
          .eq('page_type', 'product')
          .maybeSingle();

        if (error) throw error;

        const overrides = data?.page_overrides as Record<string, unknown> | null;
        if (overrides?.productSettings) {
          setSettings(prev => ({ ...prev, ...(overrides.productSettings as ProductSettings) }));
        }
      } catch (err) {
        console.error('Error loading product settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [tenantId]);

  return { settings, setSettings, isLoading };
}
