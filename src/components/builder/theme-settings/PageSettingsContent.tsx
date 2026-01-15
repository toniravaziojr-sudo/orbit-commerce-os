// =============================================
// PAGE SETTINGS CONTENT - Per-page configuration
// Shows toggles/settings for each page type
// Includes full cart/checkout configurations
// =============================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ExternalLink, 
  ChevronDown, 
  ShoppingCart, 
  Truck, 
  Percent,
  Image as ImageIcon,
  CreditCard,
  MessageSquare,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  // Carrinho suspenso
  miniCartEnabled?: boolean;
  showGoToCartButton?: boolean;
  // Funcionalidades
  shippingCalculatorEnabled?: boolean;
  couponEnabled?: boolean;
  sessionTrackingEnabled?: boolean;
  // Banner promocional
  bannerDesktopEnabled?: boolean;
  bannerMobileEnabled?: boolean;
}

interface CheckoutSettings {
  showOrderBump?: boolean;
  showTimeline?: boolean;
  // Funcionalidades
  couponEnabled?: boolean;
  testimonialsEnabled?: boolean;
  // Pixel events
  purchaseEventAllOrders?: boolean;
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

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
      // Invalidate ALL relevant queries so builder blocks refresh immediately
      queryClient.invalidateQueries({ queryKey: ['page-overrides', tenantId, pageType] });
      queryClient.invalidateQueries({ queryKey: ['cart-page-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['checkout-page-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['thankyou-page-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['page-settings', tenantId] });
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

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const settingsConfig = getSettingsConfig(pageType);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  // Render grouped settings for cart/checkout, simple list for others
  const hasGroups = settingsConfig.some(c => c.group);

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
      ) : hasGroups ? (
        // Grouped settings (for cart/checkout)
        <div className="space-y-2">
          {getGroupedSettings(settingsConfig).map((group) => (
            <Collapsible
              key={group.id}
              open={openSections[group.id] !== false}
              onOpenChange={() => toggleSection(group.id)}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    {group.icon}
                    <span className="text-sm font-medium">{group.label}</span>
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    openSections[group.id] !== false && "rotate-180"
                  )} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 px-3 pb-3">
                {group.settings.map((config) => (
                  <div key={config.key} className="flex items-center justify-between py-1">
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
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      ) : (
        // Simple list (for other pages)
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
      miniCartEnabled: true,
      showGoToCartButton: true,
      shippingCalculatorEnabled: true,
      couponEnabled: true,
      sessionTrackingEnabled: true,
      bannerDesktopEnabled: false,
      bannerMobileEnabled: false,
    },
    checkout: {
      showOrderBump: true,
      showTimeline: true,
      couponEnabled: true,
      testimonialsEnabled: true,
      purchaseEventAllOrders: true,
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
  group?: string;
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
      // Carrinho Suspenso
      { key: 'miniCartEnabled', label: 'Ativar carrinho suspenso', description: 'Drawer lateral ao adicionar produtos', defaultValue: true, group: 'mini-cart' },
      { key: 'showGoToCartButton', label: 'Botão "Ir para Carrinho"', description: 'Exibe botão para página completa', defaultValue: true, group: 'mini-cart' },
      // Funcionalidades
      { key: 'shippingCalculatorEnabled', label: 'Calculadora de frete', description: 'Permite calcular frete antes do checkout', defaultValue: true, group: 'features' },
      { key: 'couponEnabled', label: 'Cupom de desconto', description: 'Campo para aplicar cupom', defaultValue: true, group: 'features' },
      { key: 'sessionTrackingEnabled', label: 'Rastreamento de sessões', description: 'Rastreia sessões para análise', defaultValue: true, group: 'features' },
      // Ofertas
      { key: 'showCrossSell', label: 'Mostrar Cross-sell', description: 'Sugestões de produtos adicionais', defaultValue: true, group: 'offers' },
      // Banner
      { key: 'bannerDesktopEnabled', label: 'Banner Desktop', description: '1920x250 pixels', defaultValue: false, group: 'banner' },
      { key: 'bannerMobileEnabled', label: 'Banner Mobile', description: '768x200 pixels', defaultValue: false, group: 'banner' },
    ],
    checkout: [
      // Funcionalidades
      { key: 'couponEnabled', label: 'Cupom de desconto', description: 'Campo para aplicar cupom', defaultValue: true, group: 'features' },
      { key: 'testimonialsEnabled', label: 'Depoimentos', description: 'Exibe avaliações de clientes', defaultValue: true, group: 'features' },
      { key: 'showTimeline', label: 'Timeline de etapas', description: 'Mostra progresso do checkout', defaultValue: true, group: 'features' },
      // Ofertas
      { key: 'showOrderBump', label: 'Mostrar Order Bump', description: 'Oferta adicional no checkout', defaultValue: true, group: 'offers' },
      // Pixels
      { key: 'purchaseEventAllOrders', label: 'Evento em todos os pedidos', description: 'Dispara Purchase ao criar pedido', defaultValue: true, group: 'pixels' },
    ],
    thank_you: [
      { key: 'showUpsell', label: 'Mostrar Upsell', description: 'Ofertas pós-compra', defaultValue: true },
      { key: 'showWhatsApp', label: 'Mostrar WhatsApp', description: 'Link para suporte', defaultValue: true },
    ],
  };
  return configs[pageType] || [];
}

interface SettingsGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  settings: SettingConfig[];
}

function getGroupedSettings(configs: SettingConfig[]): SettingsGroup[] {
  const groupMap: Record<string, SettingsGroup> = {
    'mini-cart': { 
      id: 'mini-cart', 
      label: 'Carrinho Suspenso', 
      icon: <ShoppingCart className="h-4 w-4 text-muted-foreground" />,
      settings: [] 
    },
    'features': { 
      id: 'features', 
      label: 'Funcionalidades', 
      icon: <Percent className="h-4 w-4 text-muted-foreground" />,
      settings: [] 
    },
    'offers': { 
      id: 'offers', 
      label: 'Ofertas', 
      icon: <Truck className="h-4 w-4 text-muted-foreground" />,
      settings: [] 
    },
    'banner': { 
      id: 'banner', 
      label: 'Banner Promocional', 
      icon: <ImageIcon className="h-4 w-4 text-muted-foreground" />,
      settings: [] 
    },
    'pixels': { 
      id: 'pixels', 
      label: 'Pixels de Marketing', 
      icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />,
      settings: [] 
    },
  };

  configs.forEach(config => {
    const groupId = config.group || 'features';
    if (groupMap[groupId]) {
      groupMap[groupId].settings.push(config);
    }
  });

  // Return only groups that have settings
  return Object.values(groupMap).filter(g => g.settings.length > 0);
}
