// =============================================
// PAGE SETTINGS CONTENT - Per-page configuration
// Shows toggles/settings for each page type
// Includes full cart/checkout configurations
// =============================================
// 
// NOTA: Interfaces importadas de usePageSettings.ts (fonte única de verdade)
// Conforme docs/REGRAS.md - Arquitetura Builder
// =============================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  Truck, 
  Percent,
  Image as ImageIcon,
  BarChart3,
  Upload,
  Link,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Importar interfaces da fonte única de verdade
import type {
  CategorySettings,
  ProductSettings,
  CartSettings,
  CheckoutSettings,
  ThankYouSettings,
  PageSettings,
} from '@/hooks/usePageSettings';

import {
  DEFAULT_CATEGORY_SETTINGS,
  DEFAULT_PRODUCT_SETTINGS,
  DEFAULT_CART_SETTINGS,
  DEFAULT_CHECKOUT_SETTINGS,
  DEFAULT_THANKYOU_SETTINGS,
} from '@/hooks/usePageSettings';

// Banner Upload Component with URL input and file upload
function BannerUploadInput({ 
  configKey, 
  value, 
  onChange, 
  dimensions 
}: { 
  configKey: string; 
  value: string; 
  onChange: (url: string) => void;
  dimensions: string;
}) {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    // Create object URL for preview (in production, upload to storage)
    // For now, show toast with instructions to use Meu Drive
    toast.info('Use o Meu Drive para fazer upload permanente da imagem, ou cole a URL abaixo.');
    
    // Switch to URL tab for manual entry
    setActiveTab('url');
  };

  return (
    <div className="pl-4 border-l-2 border-muted space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Tamanho recomendado: {dimensions}
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'url' | 'upload')}>
        <TabsList className="w-full grid grid-cols-2 h-8">
          <TabsTrigger value="url" className="text-xs gap-1">
            <Link className="h-3 w-3" />
            URL
          </TabsTrigger>
          <TabsTrigger value="upload" className="text-xs gap-1">
            <Upload className="h-3 w-3" />
            Upload
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="url" className="mt-2">
          <Input
            type="text"
            placeholder="https://..."
            className="h-8 text-xs"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Cole a URL da imagem ou use o Meu Drive
          </p>
        </TabsContent>
        
        <TabsContent value="upload" className="mt-2">
          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex flex-col items-center justify-center pt-2 pb-3">
              <Upload className="w-6 h-6 mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Clique para selecionar
              </p>
              <p className="text-[10px] text-muted-foreground">
                PNG, JPG ou WEBP (máx. 5MB)
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </label>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            💡 Para upload permanente, use o <strong>Meu Drive</strong> e cole a URL
          </p>
        </TabsContent>
      </Tabs>
      
      {/* Preview */}
      {value && (
        <div className="mt-2">
          <p className="text-[10px] text-muted-foreground mb-1">Prévia:</p>
          <img 
            src={value} 
            alt="Preview do banner" 
            className="w-full h-16 object-cover rounded border"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  );
}

// Responsive Image Upload for Additional Highlight - separate mobile/desktop
function ResponsiveImageUploadInput({ 
  mobileImages, 
  desktopImages, 
  onChangeMobile, 
  onChangeDesktop, 
  maxImages = 3 
}: { 
  mobileImages: string[]; 
  desktopImages: string[]; 
  onChangeMobile: (urls: string[]) => void; 
  onChangeDesktop: (urls: string[]) => void; 
  maxImages?: number;
}) {
  const handleUrlChange = (type: 'mobile' | 'desktop', index: number, url: string) => {
    const images = type === 'mobile' ? [...mobileImages] : [...desktopImages];
    images[index] = url;
    if (type === 'mobile') {
      onChangeMobile(images);
    } else {
      onChangeDesktop(images);
    }
  };

  const handleRemove = (type: 'mobile' | 'desktop', index: number) => {
    if (type === 'mobile') {
      onChangeMobile(mobileImages.filter((_, i) => i !== index));
    } else {
      onChangeDesktop(desktopImages.filter((_, i) => i !== index));
    }
  };

  const handleAddSlot = (type: 'mobile' | 'desktop') => {
    const images = type === 'mobile' ? mobileImages : desktopImages;
    if (images.length < maxImages) {
      if (type === 'mobile') {
        onChangeMobile([...mobileImages, '']);
      } else {
        onChangeDesktop([...desktopImages, '']);
      }
    }
  };

  const renderImageSlots = (type: 'mobile' | 'desktop', images: string[], label: string, dimensions: string) => {
    const slots = images.length > 0 ? images : [];
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase">
            {type === 'mobile' ? '📱' : '💻'} {label}
          </span>
          <span className="text-[10px] text-muted-foreground">({dimensions})</span>
        </div>
        
        <div className="space-y-2">
          {slots.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              {url ? (
                <img 
                  src={url} 
                  alt={`${label} ${i + 1}`} 
                  className="w-12 h-8 object-cover rounded border flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                />
              ) : (
                <div className="w-12 h-8 border-2 border-dashed rounded flex items-center justify-center flex-shrink-0">
                  <Upload className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
              <Input 
                value={url}
                onChange={(e) => handleUrlChange(type, i, e.target.value)}
                placeholder="Cole a URL da imagem..."
                className="h-7 text-xs flex-1"
              />
              <button 
                type="button" 
                onClick={() => handleRemove(type, i)}
                className="text-muted-foreground hover:text-destructive p-1 flex-shrink-0"
                aria-label="Remover"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        
        {slots.length < maxImages && (
          <button
            type="button"
            onClick={() => handleAddSlot(type)}
            className="w-full py-1.5 border-2 border-dashed rounded text-[10px] text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-colors flex items-center justify-center gap-1"
          >
            <span>+</span> Adicionar ({slots.length}/{maxImages})
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="pl-4 border-l-2 border-muted space-y-4 pt-2">
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Mini-banners (até {maxImages} por dispositivo)
        </p>
      </div>
      
      {/* Mobile Images */}
      {renderImageSlots('mobile', mobileImages, 'Mobile', '768 × 200 px')}
      
      {/* Desktop Images */}
      {renderImageSlots('desktop', desktopImages, 'Desktop', '400 × 150 px')}
      
      <p className="text-[10px] text-muted-foreground">
        💡 Use o <strong>Meu Drive</strong> para upload permanente
      </p>
    </div>
  );
}

interface PageSettingsContentProps {
  tenantId: string;
  templateSetId?: string;
  pageType: string;
  onNavigateToEdit?: () => void;
}

// NOTA: Interfaces removidas - usar de @/hooks/usePageSettings (fonte única)

export function PageSettingsContent({
  tenantId,
  templateSetId,
  pageType,
  onNavigateToEdit,
}: PageSettingsContentProps) {
  const queryClient = useQueryClient();
  // Settings pode ter boolean, string ou array (para campos de múltiplas imagens)
  const [settings, setSettings] = useState<Record<string, boolean | string | string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Load settings on mount - from template set draft_content if available
  useEffect(() => {
    async function loadSettings() {
      if (!tenantId || !pageType) return;
      
      try {
        const settingsKey = getSettingsKey(pageType);
        
        // If templateSetId is available, load from draft_content
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
            
            if (pageSettings?.[pageType]) {
              setSettings(pageSettings[pageType] as Record<string, boolean | string>);
              setIsLoading(false);
              return;
            }
          }
        }
        
        // Fallback: Load from storefront_page_templates (legacy)
        const { data, error } = await supabase
          .from('storefront_page_templates')
          .select('page_overrides')
          .eq('tenant_id', tenantId)
          .eq('page_type', pageType)
          .maybeSingle();

        if (error) throw error;

        const overrides = data?.page_overrides as Record<string, unknown> | null;
        
        if (overrides?.[settingsKey]) {
          setSettings(overrides[settingsKey] as Record<string, boolean | string>);
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
  }, [tenantId, templateSetId, pageType]);

  // Save mutation - save to template set draft_content if templateSetId available
  const saveMutation = useMutation({
    mutationFn: async (newSettings: Record<string, boolean | string | string[]>) => {
      const settingsKey = getSettingsKey(pageType);
      
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
              [pageType]: newSettings,
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
      
      // Fallback: save to storefront_page_templates (legacy)
      const { data: template, error: fetchError } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', pageType)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentOverrides = (template?.page_overrides as Record<string, unknown>) || {};
      
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
    onSuccess: (newSettings) => {
      // Invalidate ALL relevant queries so builder blocks refresh immediately
      queryClient.invalidateQueries({ queryKey: ['page-overrides', tenantId, pageType] });
      queryClient.invalidateQueries({ queryKey: ['cart-page-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['checkout-page-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['thankyou-page-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['page-settings', tenantId] });
      
      // CRITICAL: Use consistent cache key format with useProductSettings/useCategorySettings
      // The hooks use: ['type', tenantId, templateSetId || 'legacy']
      const effectiveTemplateSetId = templateSetId || 'legacy';
      
      // Invalidate and update cache for immediate reflection in VisualBuilder
      if (pageType === 'product') {
        queryClient.invalidateQueries({ queryKey: ['product-settings-builder', tenantId, effectiveTemplateSetId] });
        queryClient.setQueryData(['product-settings-builder', tenantId, effectiveTemplateSetId], newSettings);
        console.log('[PageSettingsContent] Updated product settings cache:', { tenantId, effectiveTemplateSetId, newSettings });
      } else if (pageType === 'category') {
        queryClient.invalidateQueries({ queryKey: ['category-settings', tenantId, effectiveTemplateSetId] });
        queryClient.setQueryData(['category-settings', tenantId, effectiveTemplateSetId], newSettings);
        console.log('[PageSettingsContent] Updated category settings cache:', { tenantId, effectiveTemplateSetId, newSettings });
      } else if (pageType === 'cart') {
        queryClient.invalidateQueries({ queryKey: ['cart-settings-builder', tenantId, effectiveTemplateSetId] });
        queryClient.setQueryData(['cart-settings-builder', tenantId, effectiveTemplateSetId], newSettings);
      } else if (pageType === 'checkout') {
        queryClient.invalidateQueries({ queryKey: ['checkout-settings-builder', tenantId, effectiveTemplateSetId] });
        queryClient.setQueryData(['checkout-settings-builder', tenantId, effectiveTemplateSetId], newSettings);
      } else if (pageType === 'thank_you') {
        queryClient.invalidateQueries({ queryKey: ['thankYou-settings-builder', tenantId, effectiveTemplateSetId] });
        queryClient.setQueryData(['thankYou-settings-builder', tenantId, effectiveTemplateSetId], newSettings);
      }
      
      // Also invalidate template set content for global refresh
      if (templateSetId) {
        queryClient.invalidateQueries({ queryKey: ['template-set-content', templateSetId] });
      }
      
      // Invalidate generic page settings queries
      queryClient.invalidateQueries({ queryKey: ['page-overrides', tenantId, pageType] });
      queryClient.invalidateQueries({ queryKey: ['page-settings', tenantId] });
      
      toast.success('Configurações salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  // handleChange agora aceita boolean, string ou string[]
  const handleChange = (key: string, value: boolean | string | string[]) => {
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
                  <div key={config.key} className="space-y-2">
                    <div className="flex items-center justify-between py-1">
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
                        checked={Boolean(settings[config.key] ?? config.defaultValue)}
                        onCheckedChange={(checked) => handleChange(config.key, checked)}
                      />
                    </div>
                    {/* Show upload input when toggle is enabled and config has upload */}
                    {config.hasUpload && config.key !== 'showAdditionalHighlight' && (settings[config.key] ?? config.defaultValue) && (
                      <BannerUploadInput
                        configKey={config.key}
                        value={String(settings[config.key.replace('Enabled', 'Url')] || '')}
                        onChange={(url) => handleChange(config.key.replace('Enabled', 'Url'), url)}
                        dimensions={config.key === 'bannerDesktopEnabled' ? '1920 x 250 px' : '768 x 200 px'}
                      />
                    )}
                    {/* Responsive image upload for Additional Highlight */}
                    {config.key === 'showAdditionalHighlight' && Boolean(settings[config.key]) && (
                      <ResponsiveImageUploadInput
                        mobileImages={Array.isArray(settings.additionalHighlightImagesMobile) ? settings.additionalHighlightImagesMobile : []}
                        desktopImages={Array.isArray(settings.additionalHighlightImagesDesktop) ? settings.additionalHighlightImagesDesktop : []}
                        onChangeMobile={(urls) => handleChange('additionalHighlightImagesMobile', urls)}
                        onChangeDesktop={(urls) => handleChange('additionalHighlightImagesDesktop', urls)}
                        maxImages={3}
                      />
                    )}
                    
                    {/* REGRAS.md: Campos extras para botão personalizado de categoria */}
                    {pageType === 'category' && config.key === 'customButtonEnabled' && Boolean(settings.customButtonEnabled) && (
                      <div className="pl-4 border-l-2 border-muted space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Texto do botão</Label>
                          <Input
                            value={String(settings.customButtonText || '')}
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
                              value={String(settings.customButtonColor || '#6366f1')}
                              onChange={(e) => handleChange('customButtonColor', e.target.value)}
                              className="h-8 w-12 p-1"
                            />
                            <Input
                              value={String(settings.customButtonColor || '')}
                              onChange={(e) => handleChange('customButtonColor', e.target.value)}
                              placeholder="#6366f1"
                              className="h-8 text-sm flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Link</Label>
                          <Input
                            value={String(settings.customButtonLink || '')}
                            onChange={(e) => handleChange('customButtonLink', e.target.value)}
                            placeholder="https://..."
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* REGRAS.md: Campo de texto para botão principal (categoria) */}
                {pageType === 'category' && group.id === 'buttons' && (
                  <div className="pt-2 border-t border-border/50">
                    <div className="space-y-1">
                      <Label className="text-xs">Texto do botão principal</Label>
                      <Input
                        value={String(settings.buyNowButtonText || 'Comprar agora')}
                        onChange={(e) => handleChange('buyNowButtonText', e.target.value)}
                        placeholder="Comprar agora"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      ) : (
        // Simple list (for other pages like product)
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configurações estruturais da página
          </p>
          
          {settingsConfig.map((config) => (
            <div key={config.key} className="space-y-2">
              <div className="flex items-center justify-between">
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
                  checked={Boolean(settings[config.key] ?? config.defaultValue)}
                  onCheckedChange={(checked) => handleChange(config.key, checked)}
                />
              </div>
              {/* Responsive image upload for Additional Highlight (product page) */}
              {config.key === 'showAdditionalHighlight' && Boolean(settings[config.key]) && (
                <ResponsiveImageUploadInput
                  mobileImages={Array.isArray(settings.additionalHighlightImagesMobile) ? settings.additionalHighlightImagesMobile : []}
                  desktopImages={Array.isArray(settings.additionalHighlightImagesDesktop) ? settings.additionalHighlightImagesDesktop : []}
                  onChangeMobile={(urls) => handleChange('additionalHighlightImagesMobile', urls)}
                  onChangeDesktop={(urls) => handleChange('additionalHighlightImagesDesktop', urls)}
                  maxImages={3}
                />
              )}
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

// Usar defaults centralizados da fonte única de verdade
function getDefaultSettings(pageType: string): Record<string, boolean | string> {
  const defaults: Record<string, Record<string, boolean | string>> = {
    category: DEFAULT_CATEGORY_SETTINGS as Record<string, boolean | string>,
    product: DEFAULT_PRODUCT_SETTINGS as Record<string, boolean | string>,
    cart: DEFAULT_CART_SETTINGS as Record<string, boolean | string>,
    checkout: DEFAULT_CHECKOUT_SETTINGS as Record<string, boolean | string>,
    thank_you: DEFAULT_THANKYOU_SETTINGS as Record<string, boolean | string>,
  };
  return defaults[pageType] || {};
}

interface SettingConfig {
  key: string;
  label: string;
  description?: string;
  defaultValue: boolean;
  group?: string;
  hasUpload?: boolean; // If true, shows image upload when enabled
}

function getSettingsConfig(pageType: string): SettingConfig[] {
  const configs: Record<string, SettingConfig[]> = {
    // REGRAS.md: Todas as configurações obrigatórias para página de categoria
    category: [
      // Configurações estruturais da página
      { key: 'showCategoryName', label: 'Exibir nome da categoria', defaultValue: true, group: 'structure' },
      { key: 'showBanner', label: 'Exibir banner da categoria', defaultValue: true, group: 'structure' },
      { key: 'showRatings', label: 'Mostrar avaliações nos produtos', defaultValue: true, group: 'structure' },
      { key: 'showBadges', label: 'Mostrar selos nos produtos', defaultValue: true, group: 'structure' },
      // Botões da Thumb
      { key: 'showAddToCartButton', label: 'Exibir "Adicionar ao carrinho"', defaultValue: true, group: 'buttons' },
      { key: 'quickBuyEnabled', label: 'Ativar compra rápida', description: 'Botão principal vai direto ao checkout', defaultValue: false, group: 'buttons' },
      // Botão personalizado (toggle apenas - texto/cor/link são inputs especiais)
      { key: 'customButtonEnabled', label: 'Botão personalizado', description: 'Adiciona um botão extra na thumb', defaultValue: false, group: 'buttons' },
    ],
    product: [
      { key: 'showGallery', label: 'Mostrar Galeria', defaultValue: true },
      { key: 'showDescription', label: 'Mostrar Descrição', description: 'Descrição curta do produto', defaultValue: true },
      { key: 'showVariants', label: 'Mostrar variações', defaultValue: true },
      { key: 'showStock', label: 'Mostrar Estoque', defaultValue: true },
      { key: 'showShippingCalculator', label: 'Calculadora de frete', description: 'Cálculo de frete por CEP', defaultValue: true },
      { key: 'showRelatedProducts', label: 'Mostrar Produtos Relacionados', defaultValue: true },
      { key: 'showBuyTogether', label: 'Mostrar Compre Junto', defaultValue: true },
      { key: 'showReviews', label: 'Mostrar Avaliações', defaultValue: true },
      { key: 'showBadges', label: 'Mostrar Selos', description: 'Selos configurados no Aumentar Ticket', defaultValue: true },
      { key: 'showAdditionalHighlight', label: 'Destaque adicional', description: 'Exibe até 3 imagens como mini-banner', defaultValue: false, hasUpload: true },
      { key: 'openMiniCartOnAdd', label: 'Abrir carrinho suspenso ao adicionar', description: 'Abre o mini-carrinho lateral', defaultValue: true },
      { key: 'showGoToCartButton', label: 'Botão "Ir para Carrinho"', description: 'Link para página completa do carrinho', defaultValue: true },
      // REGRAS.md: Botões obrigatórios
      { key: 'showAddToCartButton', label: 'Mostrar Adicionar ao carrinho', defaultValue: true },
      { key: 'showWhatsAppButton', label: 'Mostrar botão WhatsApp', defaultValue: true },
    ],
    cart: [
      // Funcionalidades da Página do Carrinho
      { key: 'shippingCalculatorEnabled', label: 'Calculadora de frete', description: 'Permite calcular frete antes do checkout', defaultValue: true, group: 'features' },
      { key: 'couponEnabled', label: 'Cupom de desconto', description: 'Campo para aplicar cupom', defaultValue: true, group: 'features' },
      { key: 'showGoToCartButton', label: 'Botão "Ir para Carrinho"', description: 'Visível em outros locais (produto, mini-cart)', defaultValue: true, group: 'features' },
      // Ofertas
      { key: 'showCrossSell', label: 'Mostrar Cross-sell', description: 'Sugestões de produtos adicionais', defaultValue: true, group: 'offers' },
      // Banner
      { key: 'bannerDesktopEnabled', label: 'Banner Desktop', description: '1920x250 pixels', defaultValue: false, group: 'banner', hasUpload: true },
      { key: 'bannerMobileEnabled', label: 'Banner Mobile', description: '768x200 pixels', defaultValue: false, group: 'banner', hasUpload: true },
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
    tracking: [
      { key: 'showTitle', label: 'Mostrar título', defaultValue: true },
      { key: 'showDescription', label: 'Mostrar descrição', defaultValue: true },
    ],
    blog: [
      { key: 'showExcerpt', label: 'Mostrar resumo', defaultValue: true },
      { key: 'showImage', label: 'Mostrar imagem', defaultValue: true },
      { key: 'showTags', label: 'Mostrar tags', defaultValue: true },
      { key: 'showPagination', label: 'Mostrar paginação', defaultValue: true },
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
    'structure': { 
      id: 'structure', 
      label: 'Configurações estruturais da página', 
      icon: <ImageIcon className="h-4 w-4 text-muted-foreground" />,
      settings: [] 
    },
    'buttons': { 
      id: 'buttons', 
      label: 'Botões da Thumb', 
      icon: <Percent className="h-4 w-4 text-muted-foreground" />,
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
