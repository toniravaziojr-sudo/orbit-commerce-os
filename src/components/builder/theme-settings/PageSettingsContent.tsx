// =============================================
// PAGE SETTINGS CONTENT - Per-page configuration
// Shows toggles/settings for each page type
// =============================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface PageSettingsContentProps {
  tenantId: string;
  pageType: string;
  onNavigateToEdit?: () => void;
}

// Settings interfaces for different page types
interface CategorySettings {
  showCategoryName?: boolean;
  showBanner?: boolean;
  showRatings?: boolean;
}

interface ProductSettings {
  showGallery?: boolean;
  showDescription?: boolean;
  showVariants?: boolean;
  showStock?: boolean;
  showRelatedProducts?: boolean;
  showBuyTogether?: boolean;
  showReviews?: boolean;
  openMiniCartOnAdd?: boolean;
}

interface CartSettings {
  showCrossSell?: boolean;
}

interface CheckoutSettings {
  showOrderBump?: boolean;
  showTimeline?: boolean;
}

interface ThankYouSettings {
  showUpsell?: boolean;
  showWhatsApp?: boolean;
}

type PageSettings = CategorySettings | ProductSettings | CartSettings | CheckoutSettings | ThankYouSettings;

export function PageSettingsContent({
  tenantId,
  pageType,
  onNavigateToEdit,
}: PageSettingsContentProps) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      if (!tenantId || !pageType) return;
      
      try {
        const { data, error } = await supabase
          .from('storefront_page_templates')
          .select('page_overrides')
          .eq('tenant_id', tenantId)
          .eq('page_type', pageType)
          .maybeSingle();

        if (error) throw error;

        const overrides = data?.page_overrides as Record<string, unknown> | null;
        const settingsKey = getSettingsKey(pageType);
        
        if (overrides?.[settingsKey]) {
          setSettings(overrides[settingsKey] as Record<string, boolean>);
        } else {
          // Set defaults based on page type
          setSettings(getDefaultSettings(pageType));
        }
      } catch (err) {
        console.error('Error loading page settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [tenantId, pageType]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: Record<string, boolean>) => {
      const { data: template, error: fetchError } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', pageType)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentOverrides = (template?.page_overrides as Record<string, unknown>) || {};
      const settingsKey = getSettingsKey(pageType);
      
      const updatedOverrides = {
        ...currentOverrides,
        [settingsKey]: newSettings,
      };

      const { error } = await supabase
        .from('storefront_page_templates')
        .update({ page_overrides: updatedOverrides as unknown as Json })
        .eq('tenant_id', tenantId)
        .eq('page_type', pageType);

      if (error) throw error;
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-overrides', tenantId, pageType] });
      toast.success('Configurações salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleChange = (key: string, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveMutation.mutate(newSettings);
  };

  const settingsConfig = getSettingsConfig(pageType);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Edit button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={onNavigateToEdit}
      >
        <ExternalLink className="h-4 w-4" />
        Editar página
      </Button>

      <Separator />

      {/* Settings toggles */}
      {settingsConfig.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Esta página não possui configurações personalizáveis.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configurações estruturais da página
          </p>
          
          {settingsConfig.map((config) => (
            <div key={config.key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={config.key} className="text-sm">
                  {config.label}
                </Label>
                {config.description && (
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                )}
              </div>
              <Switch
                id={config.key}
                checked={settings[config.key] ?? config.defaultValue}
                onCheckedChange={(checked) => handleChange(config.key, checked)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper functions
function getSettingsKey(pageType: string): string {
  const keys: Record<string, string> = {
    category: 'categorySettings',
    product: 'productSettings',
    cart: 'cartSettings',
    checkout: 'checkoutSettings',
    thank_you: 'thankYouSettings',
  };
  return keys[pageType] || `${pageType}Settings`;
}

function getDefaultSettings(pageType: string): Record<string, boolean> {
  const defaults: Record<string, Record<string, boolean>> = {
    category: {
      showCategoryName: true,
      showBanner: true,
      showRatings: true,
    },
    product: {
      showGallery: true,
      showDescription: true,
      showVariants: true,
      showStock: true,
      showRelatedProducts: true,
      showBuyTogether: true,
      showReviews: true,
      openMiniCartOnAdd: true,
    },
    cart: {
      showCrossSell: true,
    },
    checkout: {
      showOrderBump: true,
      showTimeline: true,
    },
    thank_you: {
      showUpsell: true,
      showWhatsApp: true,
    },
  };
  return defaults[pageType] || {};
}

interface SettingConfig {
  key: string;
  label: string;
  description?: string;
  defaultValue: boolean;
}

function getSettingsConfig(pageType: string): SettingConfig[] {
  const configs: Record<string, SettingConfig[]> = {
    category: [
      { key: 'showCategoryName', label: 'Exibir nome da categoria', defaultValue: true },
      { key: 'showBanner', label: 'Exibir banner da categoria', defaultValue: true },
      { key: 'showRatings', label: 'Mostrar avaliações nos produtos', defaultValue: true },
    ],
    product: [
      { key: 'showGallery', label: 'Mostrar Galeria', defaultValue: true },
      { key: 'showDescription', label: 'Mostrar Descrição', defaultValue: true },
      { key: 'showVariants', label: 'Mostrar Variantes', defaultValue: true },
      { key: 'showStock', label: 'Mostrar Estoque', defaultValue: true },
      { key: 'showRelatedProducts', label: 'Mostrar Produtos Relacionados', defaultValue: true },
      { key: 'showBuyTogether', label: 'Mostrar Compre Junto', defaultValue: true },
      { key: 'showReviews', label: 'Mostrar Avaliações', defaultValue: true },
      { key: 'openMiniCartOnAdd', label: 'Abrir carrinho ao adicionar', defaultValue: true },
    ],
    cart: [
      { key: 'showCrossSell', label: 'Mostrar Cross-sell', description: 'Sugestões de produtos adicionais', defaultValue: true },
    ],
    checkout: [
      { key: 'showOrderBump', label: 'Mostrar Order Bump', description: 'Oferta adicional no checkout', defaultValue: true },
      { key: 'showTimeline', label: 'Mostrar Timeline', description: 'Etapas do checkout', defaultValue: true },
    ],
    thank_you: [
      { key: 'showUpsell', label: 'Mostrar Upsell', description: 'Ofertas pós-compra', defaultValue: true },
      { key: 'showWhatsApp', label: 'Mostrar WhatsApp', description: 'Link para suporte', defaultValue: true },
    ],
  };
  return configs[pageType] || [];
}