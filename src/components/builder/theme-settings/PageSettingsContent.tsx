// =============================================
// PAGE SETTINGS CONTENT - Per-page configuration
// Shows toggles/settings for each page type
// Includes full cart/checkout configurations
// =============================================
// 
// NOTA: Interfaces importadas de usePageSettings.ts (fonte única de verdade)
// Conforme docs/REGRAS.md - Arquitetura Builder
// =============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageSettingsSaveCompletedObserver } from '@/hooks/useBuilderDraftPageSettings';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronDown, 
  Truck, 
  Percent,
  Image as ImageIcon,
  BarChart3,
  Upload,
  Link,
  ShoppingBag,
  ShoppingCart,
  ArrowRight,
  MessageSquare,
  Palette,
} from 'lucide-react';
import { TestimonialsManagerCompact } from '@/components/cart-checkout/TestimonialsManagerCompact';
import { PaymentMethodsConfig } from './PaymentMethodsConfig';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useThemeMiniCart, DEFAULT_THEME_MINI_CART, ThemeMiniCartConfig, CartActionType } from '@/hooks/useThemeSettings';

// Importar interfaces da fonte única de verdade
import type {
  HomeSettings,
  CategorySettings,
  ProductSettings,
  CartSettings,
  CheckoutSettings,
  ThankYouSettings,
  PageSettings,
} from '@/hooks/usePageSettings';

import {
  DEFAULT_HOME_SETTINGS,
  DEFAULT_CATEGORY_SETTINGS,
  DEFAULT_PRODUCT_SETTINGS,
  DEFAULT_CART_SETTINGS,
  DEFAULT_CHECKOUT_SETTINGS,
  DEFAULT_THANKYOU_SETTINGS,
} from '@/hooks/usePageSettings';

import { useBuilderDraftPageSettings, PageSettingsKey } from '@/hooks/useBuilderDraftPageSettings';

import { GenerateSeoButton } from '@/components/seo/GenerateSeoButton';
import { Textarea } from '@/components/ui/textarea';

// Banner Upload Component with automatic system upload
function BannerUploadInput({ 
  configKey, 
  value, 
  onChange, 
  dimensions,
  tenantId,
  userId,
}: { 
  configKey: string; 
  value: string; 
  onChange: (url: string) => void;
  dimensions: string;
  tenantId?: string;
  userId?: string;
}) {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [isUploading, setIsUploading] = useState(false);

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

    if (!tenantId || !userId) {
      toast.error('Erro: tenant ou usuário não encontrado');
      return;
    }

    setIsUploading(true);

    try {
      // Import dynamically to avoid circular deps
      const { uploadAndRegisterToSystemDrive } = await import('@/lib/uploadAndRegisterToSystemDrive');
      
      const result = await uploadAndRegisterToSystemDrive({
        tenantId,
        userId,
        file,
        source: `page_banner_${configKey}`,
        subPath: 'banners',
      });

      if (result?.publicUrl) {
        onChange(result.publicUrl);
        toast.success('Imagem enviada com sucesso!');
        setActiveTab('url');
      } else {
        toast.error('Erro ao fazer upload da imagem');
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setIsUploading(false);
    }
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
            Cole a URL da imagem
          </p>
        </TabsContent>
        
        <TabsContent value="upload" className="mt-2">
          <label className={cn(
            "flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
            isUploading && "opacity-50 pointer-events-none"
          )}>
            <div className="flex flex-col items-center justify-center pt-2 pb-3">
              <Upload className={cn("w-6 h-6 mb-1 text-muted-foreground", isUploading && "animate-pulse")} />
              <p className="text-xs text-muted-foreground">
                {isUploading ? 'Enviando...' : 'Clique para selecionar'}
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
              disabled={isUploading}
            />
          </label>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            📁 Upload automático para "Uploads do sistema"
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
// ATUALIZADO: Agora usa upload real via useSystemUpload, sem opção de URL
function ResponsiveImageUploadInput({ 
  mobileImages, 
  desktopImages, 
  onChangeMobile, 
  onChangeDesktop, 
  maxImages = 3,
  tenantId,
}: { 
  mobileImages: string[]; 
  desktopImages: string[]; 
  onChangeMobile: (urls: string[]) => void; 
  onChangeDesktop: (urls: string[]) => void; 
  maxImages?: number;
  tenantId: string;
}) {
  const [uploadingIndex, setUploadingIndex] = useState<{ type: 'mobile' | 'desktop'; index: number } | null>(null);

  const handleRemove = (type: 'mobile' | 'desktop', index: number) => {
    if (type === 'mobile') {
      onChangeMobile(mobileImages.filter((_, i) => i !== index));
    } else {
      onChangeDesktop(desktopImages.filter((_, i) => i !== index));
    }
  };

  const handleFileUpload = async (type: 'mobile' | 'desktop', index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingIndex({ type, index });

    try {
      // Import dynamically to avoid circular dependencies
      const { uploadAndRegisterToSystemDrive } = await import('@/lib/uploadAndRegisterToSystemDrive');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        setUploadingIndex(null);
        return;
      }

      const result = await uploadAndRegisterToSystemDrive({
        tenantId,
        userId: user.id,
        file,
        source: 'additional-highlight',
        subPath: type === 'mobile' ? 'mobile' : 'desktop',
      });

      if (!result) {
        toast.error('Erro ao fazer upload da imagem');
        setUploadingIndex(null);
        return;
      }

      // Update the images array with the new URL
      const images = type === 'mobile' ? [...mobileImages] : [...desktopImages];
      images[index] = result.publicUrl;
      
      if (type === 'mobile') {
        onChangeMobile(images);
      } else {
        onChangeDesktop(images);
      }

      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setUploadingIndex(null);
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
          {slots.map((url, i) => {
            const isUploading = uploadingIndex?.type === type && uploadingIndex?.index === i;
            
            return (
              <div key={i} className="flex items-center gap-2">
                {url ? (
                  <img 
                    src={url} 
                    alt={`${label} ${i + 1}`} 
                    className="w-12 h-8 object-cover rounded border flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                  />
                ) : (
                  <label className={cn(
                    "w-12 h-8 border-2 border-dashed rounded flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-muted/50 transition-colors",
                    isUploading && "pointer-events-none opacity-50"
                  )}>
                    {isUploading ? (
                      <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3 text-muted-foreground" />
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(type, i, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
                
                {/* Upload button for filled slots */}
                {url ? (
                  <label className={cn(
                    "flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground border rounded cursor-pointer hover:bg-muted/50 transition-colors flex-1",
                    isUploading && "pointer-events-none opacity-50"
                  )}>
                    {isUploading ? (
                      <>
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        <span>Trocar imagem</span>
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(type, i, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                ) : (
                  <label className={cn(
                    "flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground border rounded cursor-pointer hover:bg-muted/50 transition-colors flex-1",
                    isUploading && "pointer-events-none opacity-50"
                  )}>
                    {isUploading ? (
                      <>
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        <span>Selecionar imagem</span>
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(type, i, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
                
                <button 
                  type="button" 
                  onClick={() => handleRemove(type, i)}
                  className="text-muted-foreground hover:text-destructive p-1 flex-shrink-0"
                  aria-label="Remover"
                  disabled={isUploading}
                >
                  ✕
                </button>
              </div>
            );
          })}
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
        📷 As imagens são salvas automaticamente no Meu Drive
      </p>
    </div>
  );
}

interface PageSettingsContentProps {
  tenantId: string;
  templateSetId?: string;
  pageType: string;
  onNavigateToEdit?: () => void;
  onMiniCartConfigChange?: (config: ThemeMiniCartConfig) => void;
}

// NOTA: Interfaces removidas - usar de @/hooks/usePageSettings (fonte única)

export function PageSettingsContent({
  tenantId,
  templateSetId,
  pageType,
  onNavigateToEdit,
  onMiniCartConfigChange,
}: PageSettingsContentProps) {
  const queryClient = useQueryClient();
  // Settings pode ter boolean, string, number ou array (para campos de múltiplas imagens)
  const [settings, setSettings] = useState<Record<string, boolean | string | number | string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [userId, setUserId] = useState<string | undefined>();
  
  // Draft page settings hook for real-time preview without auto-save
  const draftPageSettings = useBuilderDraftPageSettings();
  
  // Get current user ID for uploads
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        setUserId(data.user.id);
      }
    });
  }, []);
  
  // Cart action config from theme settings (for product page)
  const { 
    miniCart: savedMiniCart, 
    updateMiniCart, 
    isLoading: isLoadingMiniCart,
    isSaving: isSavingMiniCart 
  } = useThemeMiniCart(tenantId, templateSetId);
  const [cartActionConfig, setCartActionConfig] = useState<ThemeMiniCartConfig>(DEFAULT_THEME_MINI_CART);
  const cartActionInitialLoadDone = useRef(false);
  const saveCartActionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize cart action config from saved data
  useEffect(() => {
    if (savedMiniCart && !cartActionInitialLoadDone.current) {
      setCartActionConfig(savedMiniCart);
      onMiniCartConfigChange?.(savedMiniCart);
      cartActionInitialLoadDone.current = true;
    }
  }, [savedMiniCart, onMiniCartConfigChange]);

  // Debounced save for cart action
  const debouncedSaveCartAction = useCallback((updates: Partial<ThemeMiniCartConfig>) => {
    if (saveCartActionTimeoutRef.current) {
      clearTimeout(saveCartActionTimeoutRef.current);
    }
    saveCartActionTimeoutRef.current = setTimeout(() => {
      updateMiniCart(updates);
    }, 500);
  }, [updateMiniCart]);

  // Handle cart action change
  const handleCartActionChange = useCallback((key: keyof ThemeMiniCartConfig, value: boolean | number | CartActionType) => {
    setCartActionConfig(prev => {
      const updated = { ...prev, [key]: value };
      
      // When cartActionType changes to a non-none value, force showAddToCartButton to true
      if (key === 'cartActionType' && value !== 'none') {
        updated.showAddToCartButton = true;
      }
      
      // CRITICAL: Notify VisualBuilder for real-time canvas update
      onMiniCartConfigChange?.(updated);
      
      // Immediate save for booleans/strings, debounced for numbers
      if (typeof value === 'number') {
        debouncedSaveCartAction({ [key]: value });
      } else {
        updateMiniCart(updated);
      }
      
      return updated;
    });
  }, [updateMiniCart, debouncedSaveCartAction, onMiniCartConfigChange]);

  // Subscribe to save completed events to reload data from DB
  const saveCompletedCounter = usePageSettingsSaveCompletedObserver();
  
  // Track if this is a reload after save (vs initial mount)
  const isReloadAfterSave = useRef(false);
  const lastSaveCounter = useRef(saveCompletedCounter);

  // Load settings on mount or when save is completed - from template set draft_content if available
  useEffect(() => {
    // Detect if this is a reload triggered by save
    const triggeredBySave = saveCompletedCounter > lastSaveCounter.current;
    lastSaveCounter.current = saveCompletedCounter;
    
    async function loadSettings() {
      if (!tenantId || !pageType) return;
      
      console.log('[PageSettingsContent] loadSettings called', {
        tenantId,
        templateSetId,
        pageType,
        saveCompletedCounter,
        triggeredBySave,
      });
      
      try {
        const settingsKey = getSettingsKey(pageType);
        
        // If templateSetId is available, load from draft_content
        if (templateSetId) {
          // CRITICAL: Add cache-busting timestamp for fresh data after save
          // This ensures we bypass any potential connection pooling/caching
          const { data: templateSet, error: tsError } = await supabase
            .from('storefront_template_sets')
            .select('draft_content')
            .eq('id', templateSetId)
            .eq('tenant_id', tenantId)
            .maybeSingle();
          
          console.log('[PageSettingsContent] Fetched template set:', {
            hasData: !!templateSet,
            error: tsError?.message,
            themeSettings: templateSet?.draft_content ? 'present' : 'missing',
          });
          
          if (!tsError && templateSet?.draft_content) {
            const draftContent = templateSet.draft_content as Record<string, unknown>;
            const themeSettings = draftContent.themeSettings as Record<string, unknown> | undefined;
            const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
            
            const savedPageSettings = pageSettings?.[pageType] as Record<string, unknown> | undefined;
            
            console.log('[PageSettingsContent] Extracted pageSettings:', {
              pageType,
              hasPageSettings: !!savedPageSettings,
              buttonPrimaryBg: savedPageSettings?.buttonPrimaryBg,
            });
            
            if (savedPageSettings) {
              // CRITICAL: Merge with defaults to preserve all fields
              // This prevents losing fields that exist in defaults but not in saved data
              const defaults = getDefaultSettings(pageType);
              const mergedSettings = {
                ...defaults,
                ...savedPageSettings,
              } as Record<string, boolean | string>;
              
              console.log('[PageSettingsContent] Merged settings with defaults:', {
                pageType,
                defaultKeys: Object.keys(defaults),
                savedKeys: Object.keys(savedPageSettings),
                mergedKeys: Object.keys(mergedSettings),
                buttonPrimaryBg: mergedSettings.buttonPrimaryBg,
              });
              
              setSettings(mergedSettings);
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
        const defaults = getDefaultSettings(pageType);
        
        if (overrides?.[settingsKey]) {
          // CRITICAL: Merge with defaults to preserve all fields
          const savedSettings = overrides[settingsKey] as Record<string, boolean | string>;
          setSettings({ ...defaults, ...savedSettings });
        } else {
          // Set defaults based on page type
          setSettings(defaults);
        }
      } catch (err) {
        console.error('Error loading page settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    // If triggered by save, add a small delay to ensure DB propagation
    if (triggeredBySave) {
      console.log('[PageSettingsContent] Reload triggered by save, adding delay...');
      const timer = setTimeout(() => {
        loadSettings();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      loadSettings();
    }
  }, [tenantId, templateSetId, pageType, saveCompletedCounter]);

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
    onSuccess: async (newSettings) => {
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
      } else if (pageType === 'category') {
        queryClient.invalidateQueries({ queryKey: ['category-settings-builder', tenantId, effectiveTemplateSetId] });
        queryClient.setQueryData(['category-settings-builder', tenantId, effectiveTemplateSetId], newSettings);
      } else if (pageType === 'cart') {
        queryClient.invalidateQueries({ queryKey: ['cart-settings-builder', tenantId, effectiveTemplateSetId] });
        queryClient.setQueryData(['cart-settings-builder', tenantId, effectiveTemplateSetId], newSettings);
        
        // SYNC BANNER SETTINGS TO store_settings.cart_config for public storefront
        const bannerKeys = ['bannerDesktopEnabled', 'bannerDesktopUrl', 'bannerMobileEnabled', 'bannerMobileUrl', 'bannerLink', 'bannerDisplay'];
        const hasBannerChange = bannerKeys.some(key => key in newSettings);
        
        if (hasBannerChange) {
          try {
            const { data: storeSettings } = await supabase
              .from('store_settings')
              .select('id, cart_config')
              .eq('tenant_id', tenantId)
              .maybeSingle();
            
            const currentCartConfig = (storeSettings?.cart_config as Record<string, unknown>) || {};
            const updatedCartConfig = {
              ...currentCartConfig,
              bannerDesktopEnabled: newSettings.bannerDesktopEnabled ?? currentCartConfig.bannerDesktopEnabled,
              bannerDesktopUrl: newSettings.bannerDesktopUrl ?? currentCartConfig.bannerDesktopUrl,
              bannerMobileEnabled: newSettings.bannerMobileEnabled ?? currentCartConfig.bannerMobileEnabled,
              bannerMobileUrl: newSettings.bannerMobileUrl ?? currentCartConfig.bannerMobileUrl,
              bannerLink: newSettings.bannerLink ?? currentCartConfig.bannerLink,
              bannerDisplay: newSettings.bannerDisplay ?? currentCartConfig.bannerDisplay ?? 'cart_page',
            };
            
            if (storeSettings?.id) {
              await supabase
                .from('store_settings')
                .update({ cart_config: updatedCartConfig as unknown as Json })
                .eq('id', storeSettings.id);
            } else {
              await supabase
                .from('store_settings')
                .insert({ tenant_id: tenantId, cart_config: updatedCartConfig as unknown as Json });
            }
            
            queryClient.invalidateQueries({ queryKey: ['storefront-config', tenantId] });
          } catch (err) {
            console.error('[PageSettingsContent] Failed to sync banner settings:', err);
          }
        }
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

  // handleChange agora aceita boolean, string, number ou string[]
  // MUDANÇA: Ao invés de salvar imediatamente no banco, atualiza o draft local
  // O salvamento só ocorre quando o usuário clica no botão "Salvar" do builder
  const handleChange = (key: string, value: boolean | string | number | string[]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // DEBUG: Log what's being set as draft
    console.log('[PageSettingsContent] handleChange:', { 
      key, 
      value, 
      newSettingsKeys: Object.keys(newSettings),
      buttonPrimaryBg: newSettings.buttonPrimaryBg,
    });
    
    // Atualizar o draft para preview em tempo real
    // O salvamento no banco é feito pelo VisualBuilder.handleSave
    const validPageTypes: PageSettingsKey[] = ['home', 'category', 'product', 'cart', 'checkout', 'thank_you'];
    if (draftPageSettings && validPageTypes.includes(pageType as PageSettingsKey)) {
      draftPageSettings.setDraftPageSettings(pageType as PageSettingsKey, newSettings);
    }
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

      {/* Home page: SEO fields */}
      {pageType === 'home' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">SEO</p>
            <GenerateSeoButton
              input={{
                type: 'page',
                name: 'Página Inicial',
                description: String(settings.seo_description || ''),
              }}
              onGenerated={(result) => {
                // Apply both changes at once to avoid state race condition
                const newSettings = { ...settings, seo_title: result.seo_title, seo_description: result.seo_description };
                setSettings(newSettings);
                const validPageTypes: PageSettingsKey[] = ['home', 'category', 'product', 'cart', 'checkout', 'thank_you'];
                if (draftPageSettings && validPageTypes.includes(pageType as PageSettingsKey)) {
                  draftPageSettings.setDraftPageSettings(pageType as PageSettingsKey, newSettings);
                }
              }}
            />
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Título SEO</Label>
              <Input
                value={String(settings.seo_title || '')}
                onChange={(e) => handleChange('seo_title', e.target.value)}
                placeholder="Título otimizado para mecanismos de busca"
                maxLength={60}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                {String(settings.seo_title || '').length}/60 caracteres
              </p>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-sm">Descrição SEO</Label>
              <Textarea
                value={String(settings.seo_description || '')}
                onChange={(e) => handleChange('seo_description', e.target.value)}
                placeholder="Descrição que aparecerá nos resultados de busca"
                maxLength={160}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {String(settings.seo_description || '').length}/160 caracteres
              </p>
            </div>
          </div>
        </div>
      ) : settingsConfig.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Esta página não possui configurações personalizáveis.
        </p>
      ) : hasGroups ? (
        // Grouped settings (for cart/checkout)
        <div className="space-y-2">
          {getGroupedSettings(settingsConfig, pageType).map((group) => (
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
                {/* Special: PaymentMethodsConfig for checkout payment group */}
                {pageType === 'checkout' && group.id === 'payment' && (
                  <PaymentMethodsConfig tenantId={tenantId} />
                )}
                
                {/* Special: Color pickers for cart/checkout colors group */}
                {(pageType === 'cart' || pageType === 'checkout') && group.id === 'colors' && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Deixe em branco para usar as cores do tema. Cores personalizadas sobrescrevem o tema.
                    </p>
                    
                    {/* Primary Button */}
                    <div className="space-y-3 p-3 rounded-lg bg-muted/30">
                      <Label className="text-xs font-medium flex items-center gap-2">
                        🔵 Botão Primário
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Fundo</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={String(settings.buttonPrimaryBg || '#1a1a1a')}
                              onChange={(e) => handleChange('buttonPrimaryBg', e.target.value)}
                              className="h-8 w-10 p-1"
                            />
                            <Input
                              value={String(settings.buttonPrimaryBg || '')}
                              onChange={(e) => handleChange('buttonPrimaryBg', e.target.value)}
                              placeholder="Tema"
                              className="h-8 text-xs flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Texto</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={String(settings.buttonPrimaryText || '#ffffff')}
                              onChange={(e) => handleChange('buttonPrimaryText', e.target.value)}
                              className="h-8 w-10 p-1"
                            />
                            <Input
                              value={String(settings.buttonPrimaryText || '')}
                              onChange={(e) => handleChange('buttonPrimaryText', e.target.value)}
                              placeholder="Tema"
                              className="h-8 text-xs flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Hover</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={String(settings.buttonPrimaryHover || '#333333')}
                              onChange={(e) => handleChange('buttonPrimaryHover', e.target.value)}
                              className="h-8 w-10 p-1"
                            />
                            <Input
                              value={String(settings.buttonPrimaryHover || '')}
                              onChange={(e) => handleChange('buttonPrimaryHover', e.target.value)}
                              placeholder="Tema"
                              className="h-8 text-xs flex-1"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Secondary Button - Only for cart, checkout uses flags instead */}
                    {pageType === 'cart' && (
                      <div className="space-y-3 p-3 rounded-lg bg-muted/30">
                        <Label className="text-xs font-medium flex items-center gap-2">
                          ⚪ Botão Secundário
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Fundo</Label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={String(settings.buttonSecondaryBg || '#f5f5f5')}
                                onChange={(e) => handleChange('buttonSecondaryBg', e.target.value)}
                                className="h-8 w-10 p-1"
                              />
                              <Input
                                value={String(settings.buttonSecondaryBg || '')}
                                onChange={(e) => handleChange('buttonSecondaryBg', e.target.value)}
                                placeholder="Tema"
                                className="h-8 text-xs flex-1"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Texto</Label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={String(settings.buttonSecondaryText || '#1a1a1a')}
                                onChange={(e) => handleChange('buttonSecondaryText', e.target.value)}
                                className="h-8 w-10 p-1"
                              />
                              <Input
                                value={String(settings.buttonSecondaryText || '')}
                                onChange={(e) => handleChange('buttonSecondaryText', e.target.value)}
                                placeholder="Tema"
                                className="h-8 text-xs flex-1"
                              />
                            </div>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <Label className="text-[10px] text-muted-foreground">Hover</Label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={String(settings.buttonSecondaryHover || '#e5e5e5')}
                                onChange={(e) => handleChange('buttonSecondaryHover', e.target.value)}
                                className="h-8 w-10 p-1"
                              />
                              <Input
                                value={String(settings.buttonSecondaryHover || '')}
                                onChange={(e) => handleChange('buttonSecondaryHover', e.target.value)}
                                placeholder="Tema"
                                className="h-8 text-xs flex-1"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Flags Color - Only for checkout (badges like "Grátis", "Frete Grátis") */}
                    {pageType === 'checkout' && (
                      <div className="space-y-3 p-3 rounded-lg bg-muted/30">
                        <Label className="text-xs font-medium flex items-center gap-2">
                          🏷️ Flags / Tags
                        </Label>
                        <p className="text-[10px] text-muted-foreground -mt-1">
                          Cor das tags como "Grátis", "Frete Grátis", badges de desconto
                        </p>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Cor</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={String(settings.flagsColor || '#22c55e')}
                              onChange={(e) => handleChange('flagsColor', e.target.value)}
                              className="h-8 w-10 p-1"
                            />
                            <Input
                              value={String(settings.flagsColor || '')}
                              onChange={(e) => handleChange('flagsColor', e.target.value)}
                              placeholder="Tema (verde)"
                              className="h-8 text-xs flex-1"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Clear Button */}
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('buttonPrimaryBg', '');
                        handleChange('buttonPrimaryText', '');
                        handleChange('buttonPrimaryHover', '');
                        if (pageType === 'cart') {
                          handleChange('buttonSecondaryBg', '');
                          handleChange('buttonSecondaryText', '');
                          handleChange('buttonSecondaryHover', '');
                        }
                        if (pageType === 'checkout') {
                          handleChange('flagsColor', '');
                        }
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Limpar todas e usar cores do tema
                    </button>
                  </div>
                )}
                {group.settings.map((config) => (
                  <div key={config.key} className="space-y-2">
                    {config.inputType === 'slider' ? (
                      /* Slider input for numeric values like bannerOverlayOpacity */
                      <div className="space-y-2 py-1">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor={config.key} className="text-sm">
                              {config.label}
                            </Label>
                            {config.description && (
                              <p className="text-xs text-muted-foreground">{config.description}</p>
                            )}
                          </div>
                          <span className="text-sm font-medium text-muted-foreground w-10 text-right">
                            {Number(settings[config.key] ?? config.defaultValue)}%
                          </span>
                        </div>
                        <Slider
                          id={config.key}
                          min={config.min ?? 0}
                          max={config.max ?? 100}
                          step={5}
                          value={[Number(settings[config.key] ?? config.defaultValue)]}
                          onValueChange={(values) => handleChange(config.key, values[0])}
                          className="w-full"
                        />
                      </div>
                    ) : (
                      /* Standard toggle switch */
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
                    )}
                    {/* Show upload input when toggle is enabled and config has upload */}
                    {config.hasUpload && config.key !== 'showAdditionalHighlight' && (settings[config.key] ?? config.defaultValue) && (
                      <BannerUploadInput
                        configKey={config.key}
                        value={String(settings[config.key.replace('Enabled', 'Url')] || '')}
                        onChange={(url) => handleChange(config.key.replace('Enabled', 'Url'), url)}
                        dimensions={config.key === 'bannerDesktopEnabled' ? '1920 x 250 px' : '768 x 200 px'}
                        tenantId={tenantId}
                        userId={userId}
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
                        tenantId={tenantId}
                      />
                    )}
                    
                    {/* Gerenciador de Depoimentos para página de Checkout */}
                    {pageType === 'checkout' && config.key === 'testimonialsEnabled' && Boolean(settings[config.key]) && (
                      <div className="pl-4 border-l-2 border-muted pt-2">
                        <div className="flex items-center gap-2 mb-3">
                          <MessageSquare className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Gerenciar Depoimentos</span>
                        </div>
                        <TestimonialsManagerCompact />
                      </div>
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
                          <Label className="text-xs">Cor de fundo</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={String(settings.customButtonBgColor || settings.customButtonColor || '#1a1a1a')}
                              onChange={(e) => handleChange('customButtonBgColor', e.target.value)}
                              className="h-8 w-12 p-1"
                            />
                            <Input
                              value={String(settings.customButtonBgColor || settings.customButtonColor || '')}
                              onChange={(e) => handleChange('customButtonBgColor', e.target.value)}
                              placeholder="#1a1a1a"
                              className="h-8 text-sm flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cor do texto</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={String(settings.customButtonTextColor || '#ffffff')}
                              onChange={(e) => handleChange('customButtonTextColor', e.target.value)}
                              className="h-8 w-12 p-1"
                            />
                            <Input
                              value={String(settings.customButtonTextColor || '')}
                              onChange={(e) => handleChange('customButtonTextColor', e.target.value)}
                              placeholder="#ffffff"
                              className="h-8 text-sm flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cor de hover</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={String(settings.customButtonHoverColor || '#333333')}
                              onChange={(e) => handleChange('customButtonHoverColor', e.target.value)}
                              className="h-8 w-12 p-1"
                            />
                            <Input
                              value={String(settings.customButtonHoverColor || '')}
                              onChange={(e) => handleChange('customButtonHoverColor', e.target.value)}
                              placeholder="#333333"
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
                
                {/* Banner extras for cart page: link + display location */}
                {pageType === 'cart' && group.id === 'banner' && (
                  Boolean(settings.bannerDesktopEnabled) || Boolean(settings.bannerMobileEnabled)
                ) && (
                  <div className="pt-3 border-t border-border/50 space-y-4">
                    {/* Banner Link */}
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Link className="h-3 w-3" />
                        Link do banner (opcional)
                      </Label>
                      <Input
                        value={String(settings.bannerLink || '')}
                        onChange={(e) => handleChange('bannerLink', e.target.value || null)}
                        placeholder="https://sua-loja.com/promocao"
                        className="h-8 text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        URL para onde o banner redireciona ao clicar
                      </p>
                    </div>
                    
                    {/* Display location */}
                    <div className="space-y-2">
                      <Label className="text-xs">Onde exibir o banner</Label>
                      <RadioGroup
                        value={String(settings.bannerDisplay || 'cart_page')}
                        onValueChange={(value) => handleChange('bannerDisplay', value)}
                        className="space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cart_page" id="banner-cart-page" />
                          <Label htmlFor="banner-cart-page" className="text-xs font-normal cursor-pointer">
                            Somente na página do carrinho
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mini_cart" id="banner-mini-cart" />
                          <Label htmlFor="banner-mini-cart" className="text-xs font-normal cursor-pointer">
                            Somente no carrinho lateral
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="both" id="banner-both" />
                          <Label htmlFor="banner-both" className="text-xs font-normal cursor-pointer">
                            Ambos (página e lateral)
                          </Label>
                        </div>
                      </RadioGroup>
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
              {/* Title field for Related Products */}
              {config.key === 'showRelatedProducts' && Boolean(settings[config.key]) && (
                <div className="pl-2 pt-1">
                  <Label htmlFor="relatedProductsTitle" className="text-xs text-muted-foreground">Título da seção</Label>
                  <Input
                    id="relatedProductsTitle"
                    value={typeof settings.relatedProductsTitle === 'string' ? settings.relatedProductsTitle : 'Produtos Relacionados'}
                    onChange={(e) => handleChange('relatedProductsTitle', e.target.value)}
                    placeholder="Produtos Relacionados"
                    className="h-8 text-sm mt-1"
                  />
                </div>
              )}
              {/* Responsive image upload for Additional Highlight (product page) */}
              {config.key === 'showAdditionalHighlight' && Boolean(settings[config.key]) && (
                <ResponsiveImageUploadInput
                  mobileImages={Array.isArray(settings.additionalHighlightImagesMobile) ? settings.additionalHighlightImagesMobile : []}
                  desktopImages={Array.isArray(settings.additionalHighlightImagesDesktop) ? settings.additionalHighlightImagesDesktop : []}
                  onChangeMobile={(urls) => handleChange('additionalHighlightImagesMobile', urls)}
                  onChangeDesktop={(urls) => handleChange('additionalHighlightImagesDesktop', urls)}
                  maxImages={3}
                  tenantId={tenantId}
                />
              )}
            </div>
          ))}
          
          {/* Cart Action Section - Only for Product page */}
          {pageType === 'product' && !isLoadingMiniCart && (
            <>
              <Separator className="my-4" />
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Ação do Carrinho
                </h4>
                <p className="text-xs text-muted-foreground">
                  O que acontece ao clicar em "Adicionar ao carrinho"
                </p>

                {/* Main Toggle - Cart Action Enabled */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label className="text-sm font-medium">Ativar ação do carrinho</Label>
                    <p className="text-xs text-muted-foreground">
                      Desativado: botão mostra apenas "Adicionado"
                    </p>
                  </div>
                  <Switch
                    checked={cartActionConfig.cartActionType !== 'none'}
                    onCheckedChange={(enabled) => 
                      handleCartActionChange('cartActionType', enabled ? 'miniCart' : 'none')
                    }
                  />
                </div>

                {/* Cart Action Type Selection - only shows when enabled */}
                {cartActionConfig.cartActionType !== 'none' && (
                  <div className="space-y-3 pl-2">
                    <Label className="text-xs text-muted-foreground">Tipo de ação:</Label>
                    <RadioGroup
                      value={cartActionConfig.cartActionType}
                      onValueChange={(value: CartActionType) => handleCartActionChange('cartActionType', value)}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="miniCart" id="product-action-miniCart" />
                        <div className="flex items-center gap-2 flex-1">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="product-action-miniCart" className="text-sm cursor-pointer flex-1">
                            <span className="font-medium">Carrinho Suspenso</span>
                            <p className="text-xs text-muted-foreground font-normal">
                              Abre o mini-carrinho lateral
                            </p>
                          </Label>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="goToCart" id="product-action-goToCart" />
                        <div className="flex items-center gap-2 flex-1">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="product-action-goToCart" className="text-sm cursor-pointer flex-1">
                            <span className="font-medium">Ir para Carrinho</span>
                            <p className="text-xs text-muted-foreground font-normal">
                              Redireciona para a página do carrinho
                            </p>
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Show Add to Cart Button - Required when cart action is enabled */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <Label className="text-xs">Mostrar "Adicionar ao carrinho"</Label>
                      {cartActionConfig.cartActionType !== 'none' && (
                        <p className="text-[10px] text-amber-600">Obrigatório quando ação está ativa</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={cartActionConfig.showAddToCartButton}
                    onCheckedChange={(v) => handleCartActionChange('showAddToCartButton', v)}
                    disabled={cartActionConfig.cartActionType !== 'none'}
                  />
                </div>

                <p className="text-xs text-muted-foreground text-center pt-2">
                  {isSavingMiniCart ? '💾 Salvando...' : '✓ Configurações salvas automaticamente'}
                </p>
              </div>
            </>
          )}
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
    home: DEFAULT_HOME_SETTINGS as Record<string, boolean | string>,
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
  defaultValue: boolean | number;
  group?: string;
  hasUpload?: boolean; // If true, shows image upload when enabled
  inputType?: 'toggle' | 'slider'; // Default is toggle
  min?: number;
  max?: number;
}

function getSettingsConfig(pageType: string): SettingConfig[] {
  const configs: Record<string, SettingConfig[]> = {
    // Home não usa toggles - usa campos de texto para SEO (renderizado separadamente)
    home: [],
    // REGRAS.md: Todas as configurações obrigatórias para página de categoria
    category: [
      // Configurações estruturais da página
      { key: 'showCategoryName', label: 'Exibir nome da categoria', defaultValue: true, group: 'structure' },
      { key: 'showBanner', label: 'Exibir banner da categoria', defaultValue: true, group: 'structure' },
      { key: 'bannerOverlayOpacity', label: 'Escurecimento do banner', description: 'Ajuste a transparência do overlay (0 = sem escurecer, 100 = preto)', defaultValue: 0, group: 'structure', inputType: 'slider' as const, min: 0, max: 100 },
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
      // REGRAS.md: Botões obrigatórios + Ação do carrinho unificada (configurada via ProductSettingsPanel)
      { key: 'showWhatsAppButton', label: 'Mostrar botão WhatsApp', defaultValue: true },
    ],
    cart: [
      // Funcionalidades da Página do Carrinho
      { key: 'shippingCalculatorEnabled', label: 'Calculadora de frete', description: 'Permite calcular frete antes do checkout', defaultValue: true, group: 'features' },
      { key: 'couponEnabled', label: 'Cupom de desconto', description: 'Campo para aplicar cupom', defaultValue: true, group: 'features' },
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
      { key: 'showSocialShare', label: 'Compartilhamento Social', description: 'Botões para compartilhar a compra', defaultValue: false },
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

function getGroupedSettings(configs: SettingConfig[], pageType?: string): SettingsGroup[] {
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
    'payment': { 
      id: 'payment', 
      label: 'Formas de Pagamento', 
      icon: <ShoppingCart className="h-4 w-4 text-muted-foreground" />,
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
    'colors': { 
      id: 'colors', 
      label: 'Cores Personalizadas', 
      icon: <Palette className="h-4 w-4 text-muted-foreground" />,
      settings: [] 
    },
  };

  configs.forEach(config => {
    const groupId = config.group || 'features';
    if (groupMap[groupId]) {
      groupMap[groupId].settings.push(config);
    }
  });

  // Return only groups that have settings OR special groups for specific pages
  return Object.values(groupMap).filter(g => {
    // Always include 'payment' group for checkout (it has a special component)
    if (pageType === 'checkout' && g.id === 'payment') return true;
    // Always include 'colors' group for cart and checkout (special color picker section)
    if ((pageType === 'cart' || pageType === 'checkout') && g.id === 'colors') return true;
    return g.settings.length > 0;
  });
}
