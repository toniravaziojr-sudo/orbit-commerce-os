// =============================================
// HEADER/FOOTER PROPS EDITOR - Context-aware editing
// Home: Full global config | Other pages: Page-specific overrides
// Checkout: Separate layout (not synced with global)
// =============================================

import { BlockDefinition } from '@/lib/builder/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Globe, Settings, Info, RotateCcw, ShoppingBag, AlertCircle, Palette, Smartphone, Bell, ChevronDown, Phone, MessageCircle, User, Tag, CreditCard, ShieldCheck, Truck, Store, Plus, Trash2, Type, Navigation, Maximize2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PropsEditor } from './PropsEditor';
import { ImageUploader } from './ImageUploader';
import type { SvgPresetCategory } from '@/lib/builder/svg-presets';
import { usePageOverrides, PageOverrides } from '@/hooks/usePageOverrides';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

interface HeaderFooterPropsEditorProps {
  definition: BlockDefinition;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  canDelete?: boolean;
  isHomePage: boolean;
  isCheckoutPage: boolean;
  blockType: 'Header' | 'Footer';
  // For page overrides
  tenantId: string;
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail' | 'institutional' | 'landing_page' | 'tracking' | 'blog' | 'page_template';
  pageId?: string;
}

// Color input with hex
function ColorInput({ 
  value, 
  onChange, 
  label, 
  placeholder = 'Padrão do tema' 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px]">{label}</Label>
      <div className="flex gap-1.5">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer"
        />
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-7 text-xs"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            className="h-7 px-1.5 text-xs"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}

// REMOVIDO: FeaturedCategorySection
// O menu do header agora vem EXCLUSIVAMENTE do Menu Builder (Menus > Menu Header)
// Nenhuma exceção para "Categoria em Destaque" - use o Menu Builder para isso

// Promotions section for global header config
function PromotionsSection({ 
  props, 
  updateProp,
  tenantId,
  openSections,
  toggleSection,
}: { 
  props: Record<string, unknown>; 
  updateProp: (key: string, value: unknown) => void;
  tenantId: string;
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
}) {
  // Fetch pages for selection (institutional + landing_page)
  const { data: pages, isLoading: pagesLoading } = useQuery({
    queryKey: ['admin-pages-for-promos', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('store_pages')
        .select('id, title, slug, type, is_published')
        .eq('tenant_id', tenantId)
        .in('type', ['institutional', 'landing_page'])
        .order('title');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch categories for selection
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['admin-categories-for-promos', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const isLoading = pagesLoading || categoriesLoading;

  // Current value - supports new format (category:slug, page:slug) and legacy (page ID)
  const currentTarget = (props.featuredPromosTarget as string) || '';
  
  // For backwards compatibility, convert legacy page ID to new format
  const legacyPageId = (props.featuredPromosPageId as string) || '';
  const legacySlug = (props.featuredPromosPageSlug as string) || '';
  
  // Auto-migrate legacy formats to new format
  useEffect(() => {
    if (!currentTarget && (legacyPageId || legacySlug)) {
      const page = legacyPageId 
        ? pages?.find(p => p.id === legacyPageId)
        : pages?.find(p => p.slug === legacySlug);
      if (page) {
        updateProp('featuredPromosTarget', `page:${page.slug}`);
        // Clear legacy props
        if (legacyPageId) updateProp('featuredPromosPageId', '');
        if (legacySlug) updateProp('featuredPromosPageSlug', '');
      }
    }
  }, [currentTarget, legacyPageId, legacySlug, pages, updateProp]);

  // Parse current target to get label
  const getTargetLabel = () => {
    if (!currentTarget || currentTarget === 'none') return null;
    if (currentTarget.startsWith('category:')) {
      const slug = currentTarget.replace('category:', '');
      const cat = categories?.find(c => c.slug === slug);
      return cat ? `📁 ${cat.name}` : null;
    }
    if (currentTarget.startsWith('page:')) {
      const slug = currentTarget.replace('page:', '');
      const page = pages?.find(p => p.slug === slug);
      return page ? `📄 ${page.title}` : null;
    }
    return null;
  };

  const hasValidTarget = currentTarget && currentTarget !== 'none' && getTargetLabel();

  return (
    <Collapsible open={openSections.promos} onOpenChange={() => toggleSection('promos')}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium">Promoções em Destaque</span>
            {props.featuredPromosEnabled && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">Ativo</Badge>
            )}
          </div>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.promos ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="space-y-0">
            <Label className="text-[11px]">Exibir link de Promoções</Label>
          </div>
          <Switch className="scale-90"
            checked={Boolean(props.featuredPromosEnabled)}
            onCheckedChange={(v) => updateProp('featuredPromosEnabled', v)}
          />
        </div>
        
        {Boolean(props.featuredPromosEnabled) && (
          <>
            <div className="space-y-1">
              <Label className="text-[10px]">Texto do link</Label>
              <Input
                value={(props.featuredPromosLabel as string) || 'Promoções'}
                onChange={(e) => updateProp('featuredPromosLabel', e.target.value)}
                placeholder="Ex: Promoções"
                className="h-7 text-xs"
              />
            </div>
            
            <ColorInput
              label="Cor do texto"
              value={(props.featuredPromosTextColor as string) || '#d97706'}
              onChange={(v) => updateProp('featuredPromosTextColor', v)}
              placeholder="Ex: #d97706 (dourado)"
            />
            
            <div className="space-y-1">
              <Label className="text-[10px]">Destino</Label>
              {isLoading ? (
                <p className="text-[10px] text-muted-foreground">Carregando...</p>
              ) : (
                <Select
                  value={currentTarget || 'none'}
                  onValueChange={(v) => updateProp('featuredPromosTarget', v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="w-full h-7 text-xs">
                    <SelectValue placeholder="Selecione o destino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      <span className="text-muted-foreground">Nenhum destino</span>
                    </SelectItem>
                    {categories && categories.filter(c => c.id && c.slug).length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                          Categorias
                        </div>
                        {categories.filter(c => c.id && c.slug).map((cat) => (
                          <SelectItem key={cat.id} value={`category:${cat.slug}`} className="text-xs">
                            📁 {cat.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {pages && pages.filter(p => p.id && p.slug).length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                          Páginas
                        </div>
                        {pages.filter(p => p.id && p.slug).map((page) => (
                          <SelectItem key={page.id} value={`page:${page.slug}`} className="text-xs">
                            📄 {page.title}
                            {!page.is_published && (
                              <span className="text-xs text-amber-600 ml-1">(Rascunho)</span>
                            )}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
              
              {props.featuredPromosEnabled && !hasValidTarget && !isLoading && (
                <p className="text-xs text-amber-600">⚠️ Selecione um destino para exibir o link</p>
              )}
              
              {hasValidTarget && (
                <p className="text-xs text-muted-foreground">
                  Destino: {getTargetLabel()}
                </p>
              )}
            </div>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Footer Image Section component for payment methods, security seals, shipping, official stores
interface FooterImageItem {
  imageUrl: string;
  linkUrl?: string;
}

interface FooterImageSectionData {
  title: string;
  items: FooterImageItem[];
}

function FooterImageSection({
  title,
  icon,
  sectionKey,
  props,
  updateProp,
  openSections,
  toggleSection,
  requireLink = false,
}: {
  title: string;
  icon: React.ReactNode;
  sectionKey: 'paymentMethods' | 'securitySeals' | 'shippingMethods' | 'officialStores';
  props: Record<string, unknown>;
  updateProp: (key: string, value: unknown) => void;
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  requireLink?: boolean;
}) {
  const sectionData = (props[sectionKey] as FooterImageSectionData) || { title, items: [] };
  const items = sectionData.items || [];
  const [openItems, setOpenItems] = useState<Record<number, boolean>>({});

  // Mapear sectionKey para categoria de SVG preset
  const getSvgPresetCategory = (): SvgPresetCategory | undefined => {
    switch (sectionKey) {
      case 'paymentMethods':
        return 'payment';
      case 'securitySeals':
        return 'security';
      case 'shippingMethods':
        return 'shipping';
      case 'officialStores':
        return 'store';
      default:
        return undefined;
    }
  };

  const svgCategory = getSvgPresetCategory();

  const toggleItem = (index: number) => {
    setOpenItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const updateSection = (newData: Partial<FooterImageSectionData>) => {
    updateProp(sectionKey, { ...sectionData, ...newData });
  };

  const addItem = () => {
    const newIndex = items.length;
    updateSection({ items: [...items, { imageUrl: '', linkUrl: '' }] });
    // Auto-expand new item
    setOpenItems(prev => ({ ...prev, [newIndex]: true }));
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    updateSection({ items: newItems });
    // Clean up open state
    const newOpenItems = { ...openItems };
    delete newOpenItems[index];
    setOpenItems(newOpenItems);
  };

  const updateItem = (index: number, field: keyof FooterImageItem, value: string) => {
    const newItems = items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    updateSection({ items: newItems });
  };

  // Get preview label for collapsed item
  const getItemPreview = (item: FooterImageItem) => {
    if (item.imageUrl) {
      if (item.imageUrl.startsWith('data:image/svg')) return 'SVG';
      const filename = item.imageUrl.split('/').pop()?.split('?')[0];
      return filename && filename.length > 20 ? filename.substring(0, 17) + '...' : filename || 'Imagem';
    }
    return 'Sem imagem';
  };

  return (
    <Collapsible open={openSections[sectionKey]} onOpenChange={() => toggleSection(sectionKey)}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-3 h-auto">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium">{title}</span>
            {items.length > 0 && (
              <Badge variant="secondary" className="text-xs">{items.length}</Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${openSections[sectionKey] ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Título da Seção</Label>
          <Input
            value={sectionData.title || ''}
            onChange={(e) => updateSection({ title: e.target.value })}
            placeholder={title}
            className="h-9 text-sm"
          />
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item, index) => (
              <Collapsible 
                key={index} 
                open={openItems[index]} 
                onOpenChange={() => toggleItem(index)}
              >
                <div className="border rounded-lg bg-muted/30 overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${openItems[index] ? 'rotate-180' : ''}`} />
                        <span className="text-xs font-medium">Item {index + 1}</span>
                        {item.imageUrl && (
                          <span className="text-xs text-muted-foreground">• {getItemPreview(item)}</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(index);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 space-y-3 border-t">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Imagem</Label>
                        <ImageUploader
                          value={item.imageUrl}
                          onChange={(url) => updateItem(index, 'imageUrl', url)}
                          placeholder="Faça upload ou cole URL"
                          svgPresetCategory={svgCategory}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Link {requireLink ? '' : '(opcional)'}
                        </Label>
                        <Input
                          value={item.linkUrl || ''}
                          onChange={(e) => updateItem(index, 'linkUrl', e.target.value)}
                          placeholder="https://..."
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={addItem}
        >
          <Plus className="h-4 w-4" />
          Adicionar Item
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function HeaderFooterPropsEditor({
  definition,
  props,
  onChange,
  onDelete,
  onDuplicate,
  canDelete = true,
  isHomePage,
  isCheckoutPage,
  blockType,
  tenantId,
  pageType,
  pageId,
}: HeaderFooterPropsEditorProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    style: true,
    colors: false,
    menuColors: false,
    contact: false,
    customerArea: false,
    promos: false,
    general: false,
    notice: false,
    layout: false,
  });

  // Fetch page overrides (only for non-home, non-checkout pages)
  const { 
    overrides, 
    isLoading, 
    updateHeaderOverrides,
    clearHeaderOverride,
    updateFooterOverrides,
    clearFooterOverride,
  } = usePageOverrides({ tenantId, pageType, pageId });

  // Fetch global layout values for displaying "Herdando do global: X"
  const { data: globalLayout } = useQuery({
    queryKey: ['global-layout-visibility', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('storefront_global_layout')
        .select('header_enabled, footer_enabled, show_footer_1, show_footer_2')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !isHomePage && !isCheckoutPage,
    staleTime: 1000 * 60 * 5,
  });

  // Global values (fallback to true if no data)
  const globalHeaderEnabled = globalLayout?.header_enabled ?? true;
  const globalFooterEnabled = globalLayout?.footer_enabled ?? true;
  const globalShowFooter1 = globalLayout?.show_footer_1 ?? true;
  const globalShowFooter2 = globalLayout?.show_footer_2 ?? true;

  // === HEADER OVERRIDES ===
  // Get global notice enabled value from props
  const globalHeaderNoticeEnabled = Boolean(props.noticeEnabled);
  
  // Check if there's an override
  const hasHeaderNoticeOverride = overrides?.header?.noticeEnabled !== undefined;
  
  // Get effective value (override > global)
  const effectiveHeaderNoticeEnabled = hasHeaderNoticeOverride 
    ? Boolean(overrides.header?.noticeEnabled) 
    : globalHeaderNoticeEnabled;

  // === HEADER VISIBILITY OVERRIDE ===
  // headerEnabled controls whether header is shown on this page
  const hasHeaderEnabledOverride = overrides?.header?.headerEnabled !== undefined;
  const effectiveHeaderEnabled = hasHeaderEnabledOverride
    ? Boolean(overrides.header?.headerEnabled)
    : globalHeaderEnabled;

  // === HEADER MENU VISIBILITY OVERRIDE ===
  // showHeaderMenu controls whether the navigation menu is shown in the header
  const hasShowHeaderMenuOverride = overrides?.header?.showHeaderMenu !== undefined;
  const effectiveShowHeaderMenu = hasShowHeaderMenuOverride
    ? Boolean(overrides.header?.showHeaderMenu)
    : true; // Default to true (menu visible)

  // Handle toggle change - only creates override, never modifies global
  const handleHeaderNoticeToggle = async (checked: boolean) => {
    try {
      await updateHeaderOverrides.mutateAsync({ noticeEnabled: checked });
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  // Handle header enabled toggle
  const handleHeaderEnabledToggle = async (checked: boolean) => {
    try {
      await updateHeaderOverrides.mutateAsync({ headerEnabled: checked });
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  // Handle revert to global - removes override
  const handleHeaderRevertToGlobal = async () => {
    try {
      await clearHeaderOverride.mutateAsync('noticeEnabled');
      toast.success('Revertido para configuração global');
    } catch (error) {
      toast.error('Erro ao reverter configuração');
    }
  };

  // Handle revert header enabled to global
  const handleHeaderEnabledRevertToGlobal = async () => {
    try {
      await clearHeaderOverride.mutateAsync('headerEnabled');
      toast.success('Revertido para configuração global');
    } catch (error) {
      toast.error('Erro ao reverter configuração');
    }
  };

  // Handle show header menu toggle
  const handleShowHeaderMenuToggle = async (checked: boolean) => {
    try {
      await updateHeaderOverrides.mutateAsync({ showHeaderMenu: checked });
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  // Handle revert show header menu to global
  const handleShowHeaderMenuRevertToGlobal = async () => {
    try {
      await clearHeaderOverride.mutateAsync('showHeaderMenu');
      toast.success('Revertido para configuração global');
    } catch (error) {
      toast.error('Erro ao reverter configuração');
    }
  };

  // === FOOTER OVERRIDES ===
  // Get global footer notice enabled value from props
  const globalFooterNoticeEnabled = Boolean(props.noticeEnabled);
  
  // Check if there's an override for footer
  const hasFooterNoticeOverride = overrides?.footer?.noticeEnabled !== undefined;
  
  // Get effective value for footer (override > global)
  const effectiveFooterNoticeEnabled = hasFooterNoticeOverride 
    ? Boolean(overrides.footer?.noticeEnabled) 
    : globalFooterNoticeEnabled;

  // === FOOTER VISIBILITY OVERRIDES ===
  const hasFooterEnabledOverride = overrides?.footer?.footerEnabled !== undefined;
  const effectiveFooterEnabled = hasFooterEnabledOverride
    ? Boolean(overrides.footer?.footerEnabled)
    : globalFooterEnabled;

  const hasShowFooter1Override = overrides?.footer?.showFooter1 !== undefined;
  const effectiveShowFooter1 = hasShowFooter1Override
    ? Boolean(overrides.footer?.showFooter1)
    : globalShowFooter1;

  const hasShowFooter2Override = overrides?.footer?.showFooter2 !== undefined;
  const effectiveShowFooter2 = hasShowFooter2Override
    ? Boolean(overrides.footer?.showFooter2)
    : globalShowFooter2;

  // Handle footer toggle change - only creates override, never modifies global
  const handleFooterNoticeToggle = async (checked: boolean) => {
    try {
      await updateFooterOverrides.mutateAsync({ noticeEnabled: checked });
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  // Handle footer enabled toggle
  const handleFooterEnabledToggle = async (checked: boolean) => {
    try {
      await updateFooterOverrides.mutateAsync({ footerEnabled: checked });
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  // Handle show footer 1 toggle
  const handleShowFooter1Toggle = async (checked: boolean) => {
    try {
      await updateFooterOverrides.mutateAsync({ showFooter1: checked });
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  // Handle show footer 2 toggle
  const handleShowFooter2Toggle = async (checked: boolean) => {
    try {
      await updateFooterOverrides.mutateAsync({ showFooter2: checked });
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  // Handle footer revert to global - removes override
  const handleFooterRevertToGlobal = async () => {
    try {
      await clearFooterOverride.mutateAsync('noticeEnabled');
      toast.success('Revertido para configuração global');
    } catch (error) {
      toast.error('Erro ao reverter configuração');
    }
  };

  // Handle footer enabled revert to global
  const handleFooterEnabledRevertToGlobal = async () => {
    try {
      await clearFooterOverride.mutateAsync('footerEnabled');
      toast.success('Revertido para configuração global');
    } catch (error) {
      toast.error('Erro ao reverter configuração');
    }
  };

  // Handle show footer 1 revert to global
  const handleShowFooter1RevertToGlobal = async () => {
    try {
      await clearFooterOverride.mutateAsync('showFooter1');
      toast.success('Revertido para configuração global');
    } catch (error) {
      toast.error('Erro ao reverter configuração');
    }
  };

  // Handle show footer 2 revert to global
  const handleShowFooter2RevertToGlobal = async () => {
    try {
      await clearFooterOverride.mutateAsync('showFooter2');
      toast.success('Revertido para configuração global');
    } catch (error) {
      toast.error('Erro ao reverter configuração');
    }
  };

  // Helper to update a single prop
  const updateProp = (key: string, value: unknown) => {
    onChange({ ...props, [key]: value });
  };

  // Toggle section
  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // =========================================
  // CHECKOUT: Separate layout (not global)
  // Dedicated UI with collapsible sections
  // =========================================
  if (isCheckoutPage) {
    // Checkout Header UI
    if (blockType === 'Header') {
      return (
        <div className="h-full flex flex-col border-l">
          {/* Header with Checkout-specific indicator */}
          <div className="p-3 border-b bg-amber-500/10">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-amber-600" />
              <div>
                <h3 className="font-medium text-xs flex items-center gap-1.5">
                  Header do Checkout
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-700 border-amber-400">
                    Layout Exclusivo
                  </Badge>
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Configuração independente do header global
                </p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              {/* === CORES DO CABEÇALHO DO CHECKOUT === */}
              <Collapsible open={openSections.colors} onOpenChange={() => toggleSection('colors')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                    <div className="flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-medium">Cores do Cabeçalho</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.colors ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pb-3 space-y-3">
                  <ColorInput
                    label="Cor de Fundo"
                    value={(props.headerBgColor as string) || ''}
                    onChange={(v) => updateProp('headerBgColor', v)}
                    placeholder="Herdar do global"
                  />
                  <ColorInput
                    label="Cor do Texto"
                    value={(props.headerTextColor as string) || ''}
                    onChange={(v) => updateProp('headerTextColor', v)}
                    placeholder="Herdar do global"
                  />
                  <ColorInput
                    label="Cor dos Ícones"
                    value={(props.headerIconColor as string) || ''}
                    onChange={(v) => updateProp('headerIconColor', v)}
                    placeholder="Herdar do global"
                  />
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* === POSIÇÃO DO LOGO === */}
              <Collapsible open={openSections.layout} onOpenChange={() => toggleSection('layout')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                    <div className="flex items-center gap-1.5">
                      <Settings className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-medium">Layout do Logo</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.layout ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pb-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Posição do Logo</Label>
                    <Select
                      value={(props.logoPosition as string) || 'center'}
                      onValueChange={(v) => updateProp('logoPosition', v)}
                    >
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Esquerda</SelectItem>
                        <SelectItem value="center">Centro</SelectItem>
                        <SelectItem value="right">Direita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Tamanho do Logo</Label>
                    <Select
                      value={(props.logoSize as string) || 'medium'}
                      onValueChange={(v) => updateProp('logoSize', v)}
                    >
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Selecione o tamanho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small" className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">Pequeno</span>
                            <span className="text-[10px] text-muted-foreground">32px de altura</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="medium" className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">Médio</span>
                            <span className="text-[10px] text-muted-foreground">40px de altura (padrão)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="large" className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">Grande</span>
                            <span className="text-[10px] text-muted-foreground">56px de altura</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Altura máxima da logo no header
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* === ELEMENTOS VISÍVEIS DO CHECKOUT === */}
              <Collapsible open={openSections.general} onOpenChange={() => toggleSection('general')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                    <div className="flex items-center gap-1.5">
                      <Settings className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-medium">Elementos Visíveis</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.general ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pb-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Busca</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showSearch ?? false)}
                      onCheckedChange={(v) => updateProp('showSearch', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Carrinho</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showCart ?? true)}
                      onCheckedChange={(v) => updateProp('showCart', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Menu de Navegação</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showHeaderMenu ?? false)}
                      onCheckedChange={(v) => updateProp('showHeaderMenu', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Área do Cliente</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.customerAreaEnabled ?? false)}
                      onCheckedChange={(v) => updateProp('customerAreaEnabled', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Promoções em Destaque</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.featuredPromosEnabled ?? false)}
                      onCheckedChange={(v) => updateProp('featuredPromosEnabled', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Atendimento (SAC)</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showSac ?? false)}
                      onCheckedChange={(v) => updateProp('showSac', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Selos de Segurança</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showSecuritySeals ?? false)}
                      onCheckedChange={(v) => updateProp('showSecuritySeals', v)}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* === COMPORTAMENTO === */}
              <Collapsible open={openSections.style} onOpenChange={() => toggleSection('style')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-medium">Comportamento</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.style ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pb-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Fixar ao Rolar</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.sticky ?? true)}
                      onCheckedChange={(v) => updateProp('sticky', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Fixar no Mobile</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.stickyOnMobile ?? true)}
                      onCheckedChange={(v) => updateProp('stickyOnMobile', v)}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Info note */}
              <Alert className="mx-2 my-3">
                <Info className="h-3.5 w-3.5" />
                <AlertDescription className="text-[10px]">
                  Estas configurações afetam apenas o checkout. 
                  Se deixar cores em branco, herda do header global.
                </AlertDescription>
              </Alert>
            </div>
          </ScrollArea>
        </div>
      );
    }

    // Checkout Footer UI
    if (blockType === 'Footer') {
      return (
        <div className="h-full flex flex-col border-l">
          {/* Header with Checkout-specific indicator */}
          <div className="p-3 border-b bg-amber-500/10">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-amber-600" />
              <div>
                <h3 className="font-medium text-xs flex items-center gap-1.5">
                  Footer do Checkout
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-700 border-amber-400">
                    Layout Exclusivo
                  </Badge>
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Configuração independente do footer global
                </p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              {/* === CORES DO RODAPÉ DO CHECKOUT === */}
              <Collapsible open={openSections.colors} onOpenChange={() => toggleSection('colors')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                    <div className="flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-medium">Cores do Rodapé</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.colors ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pb-3 space-y-3">
                  <ColorInput
                    label="Cor de Fundo"
                    value={(props.footerBgColor as string) || ''}
                    onChange={(v) => updateProp('footerBgColor', v)}
                    placeholder="Herdar do global"
                  />
                  <ColorInput
                    label="Cor do Texto"
                    value={(props.footerTextColor as string) || ''}
                    onChange={(v) => updateProp('footerTextColor', v)}
                    placeholder="Herdar do global"
                  />
                  <ColorInput
                    label="Cor dos Títulos"
                    value={(props.footerTitlesColor as string) || ''}
                    onChange={(v) => updateProp('footerTitlesColor', v)}
                    placeholder="Herdar do global"
                  />
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* === VISUAL MENUS DO CHECKOUT === */}
              <Collapsible open={openSections.visualMenus} onOpenChange={() => toggleSection('visualMenus')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                    <div className="flex items-center gap-1.5">
                      <Navigation className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-medium">Visual Menus</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.visualMenus ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pb-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Estilo dos Links</Label>
                    <Select 
                      value={(props.menuVisualStyle as string) || 'classic'} 
                      onValueChange={(v) => updateProp('menuVisualStyle', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione o estilo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="classic" className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">Clássico</span>
                            <span className="text-[10px] text-muted-foreground">Underline animado no hover</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="elegant" className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">Elegante</span>
                            <span className="text-[10px] text-muted-foreground">Transição de cor suave</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="minimal" className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">Minimalista</span>
                            <span className="text-[10px] text-muted-foreground">Apenas mudança de opacidade</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Define a aparência dos links de menu no rodapé
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px]">Tamanho dos Selos</Label>
                    <Select 
                      value={(props.badgeSize as string) || 'medium'} 
                      onValueChange={(v) => updateProp('badgeSize', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione o tamanho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small" className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">Pequeno</span>
                            <span className="text-[10px] text-muted-foreground">Selos compactos</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="medium" className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">Médio</span>
                            <span className="text-[10px] text-muted-foreground">Tamanho padrão</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="large" className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">Grande</span>
                            <span className="text-[10px] text-muted-foreground">Selos maiores</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Ajusta o tamanho das formas de pagamento e selos de segurança
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* === ELEMENTOS VISÍVEIS DO CHECKOUT === */}
              <Collapsible open={openSections.general} onOpenChange={() => toggleSection('general')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                    <div className="flex items-center gap-1.5">
                      <Settings className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-medium">Elementos Visíveis</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.general ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pb-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Logo</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showLogo ?? true)}
                      onCheckedChange={(v) => updateProp('showLogo', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Copyright</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showCopyright ?? true)}
                      onCheckedChange={(v) => updateProp('showCopyright', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar SAC</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showSac ?? false)}
                      onCheckedChange={(v) => updateProp('showSac', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Redes Sociais</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showSocial ?? false)}
                      onCheckedChange={(v) => updateProp('showSocial', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Newsletter</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showNewsletterSection ?? false)}
                      onCheckedChange={(v) => updateProp('showNewsletterSection', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Footer 1</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showFooter1 ?? false)}
                      onCheckedChange={(v) => updateProp('showFooter1', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Footer 2</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showFooter2 ?? false)}
                      onCheckedChange={(v) => updateProp('showFooter2', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Mostrar Info da Loja</Label>
                    <Switch className="scale-90"
                      checked={Boolean(props.showStoreInfo ?? false)}
                      onCheckedChange={(v) => updateProp('showStoreInfo', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-[11px]">Mostrar Formas de Pagamento</Label>
                      <p className="text-[9px] text-muted-foreground">Herdado do footer global</p>
                    </div>
                    <Switch className="scale-90"
                      checked={Boolean(props.showPaymentMethods ?? true)}
                      onCheckedChange={(v) => updateProp('showPaymentMethods', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-[11px]">Mostrar Selos de Segurança</Label>
                      <p className="text-[9px] text-muted-foreground">Herdado do footer global</p>
                    </div>
                    <Switch className="scale-90"
                      checked={Boolean(props.showSecuritySeals ?? true)}
                      onCheckedChange={(v) => updateProp('showSecuritySeals', v)}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* === FORMAS DE PAGAMENTO DO CHECKOUT === */}
              <FooterImageSection
                title="Formas de Pagamento"
                icon={<CreditCard className="h-3.5 w-3.5 text-amber-600" />}
                sectionKey="paymentMethods"
                props={props}
                updateProp={updateProp}
                openSections={openSections}
                toggleSection={toggleSection}
              />

              <Separator />

              {/* === SELOS DE SEGURANÇA DO CHECKOUT === */}
              <FooterImageSection
                title="Selos de Segurança"
                icon={<ShieldCheck className="h-3.5 w-3.5 text-amber-600" />}
                sectionKey="securitySeals"
                props={props}
                updateProp={updateProp}
                openSections={openSections}
                toggleSection={toggleSection}
              />

              <Separator />

              {/* === TEXTOS PERSONALIZÁVEIS DO CHECKOUT === */}
              <Collapsible open={openSections.titles} onOpenChange={() => toggleSection('titles')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                    <div className="flex items-center gap-1.5">
                      <Type className="h-3.5 w-3.5 text-purple-600" />
                      <span className="font-medium">Textos Personalizáveis</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.titles ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-2 pb-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Texto do Copyright</Label>
                    <Textarea
                      value={(props.copyrightText as string) || ''}
                      onChange={(e) => updateProp('copyrightText', e.target.value)}
                      placeholder="© {ano} {nome da loja}. Todos os direitos reservados."
                      className="text-[11px] min-h-[60px] resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Deixe vazio para usar o padrão automático
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Info note */}
              <Alert className="mx-2 my-3">
                <Info className="h-3.5 w-3.5" />
                <AlertDescription className="text-[10px]">
                  Estas configurações afetam apenas o checkout. 
                  Se deixar cores em branco, herda do footer global.
                  Se deixar formas de pagamento/selos vazios, herda do footer global.
                </AlertDescription>
              </Alert>
            </div>
          </ScrollArea>
        </div>
      );
    }
  }

  // =========================================
  // HOME: Global configuration with sections
  // =========================================
  if (isHomePage && blockType === 'Header') {
    return (
      <div className="h-full flex flex-col border-l">
        {/* Header with Global indicator */}
        <div className="p-2 border-b bg-primary/5">
          <div className="flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-primary" />
            <div>
              <h3 className="font-medium text-xs flex items-center gap-1.5">
                {definition.label}
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-primary/10 text-primary border-primary/30">
                  Configuração Global
                </Badge>
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Afeta todas as páginas (exceto Checkout)
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1.5">
            {/* 
              REMOVIDO: Estilo do Cabeçalho (headerStyle, menuId)
              Motivo: StorefrontHeader.tsx usa layout fixo, não implementa variações de estilo.
              A prop menuId é ignorada - o menu vem de usePublicStorefront().
              Re-adicionar quando implementar layouts variáveis no StorefrontHeader.
            */}

            {/* === CORES DO CABEÇALHO === */}
            <Collapsible open={openSections.colors} onOpenChange={() => toggleSection('colors')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                  <div className="flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">Cores do Cabeçalho</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.colors ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-3 space-y-3">
                <ColorInput
                  label="Cor de Fundo"
                  value={(props.headerBgColor as string) || ''}
                  onChange={(v) => updateProp('headerBgColor', v)}
                />
                <ColorInput
                  label="Cor do Texto"
                  value={(props.headerTextColor as string) || ''}
                  onChange={(v) => updateProp('headerTextColor', v)}
                />
                <ColorInput
                  label="Cor dos Ícones"
                  value={(props.headerIconColor as string) || ''}
                  onChange={(v) => updateProp('headerIconColor', v)}
                />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* 
              REMOVIDO: Cores do Menu
              Motivo: StorefrontHeader.tsx não implementa menu separado com cores próprias.
              Re-adicionar quando implementar estilos de layout variáveis.
            */}

            {/* === CONFIGURAÇÕES GERAIS === */}
            <Collapsible open={openSections.general} onOpenChange={() => toggleSection('general')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">Configurações Gerais</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.general ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0">
                    <Label className="text-[11px]">Fixar ao rolar (Mobile)</Label>
                  </div>
                  <Switch className="scale-90"
                    checked={Boolean(props.stickyOnMobile ?? true)}
                    onCheckedChange={(v) => updateProp('stickyOnMobile', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0">
                    <Label className="text-[11px]">Fixo no Topo (Desktop)</Label>
                  </div>
                  <Switch className="scale-90"
                    checked={Boolean(props.sticky ?? true)}
                    onCheckedChange={(v) => updateProp('sticky', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0">
                    <Label className="text-[11px]">Mostrar Busca</Label>
                  </div>
                  <Switch className="scale-90"
                    checked={Boolean(props.showSearch ?? true)}
                    onCheckedChange={(v) => updateProp('showSearch', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0">
                    <Label className="text-[11px]">Mostrar Carrinho</Label>
                  </div>
                  <Switch className="scale-90"
                    checked={Boolean(props.showCart ?? true)}
                    onCheckedChange={(v) => updateProp('showCart', v)}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>


            {/* REMOVIDO: Categoria em Destaque - menu vem do Menu Builder */}
            
            {/* REMOVIDO: Contato no Cabeçalho - dados agora vêm das Configurações da Loja */}

            <Separator />

            {/* === MINHA CONTA === */}
            <Collapsible open={openSections.customerArea} onOpenChange={() => toggleSection('customerArea')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">Minha Conta</span>
                    {props.customerAreaEnabled && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">Ativo</Badge>
                    )}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.customerArea ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0">
                    <Label className="text-[11px]">Exibir "Minha Conta"</Label>
                  </div>
                  <Switch className="scale-90"
                    checked={Boolean(props.customerAreaEnabled)}
                    onCheckedChange={(v) => updateProp('customerAreaEnabled', v)}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* === PROMOÇÕES EM DESTAQUE === */}
            <PromotionsSection
              props={props}
              updateProp={updateProp}
              tenantId={tenantId}
              openSections={openSections}
              toggleSection={toggleSection}
            />

            <Separator />

            {/* === BARRA SUPERIOR (AVISO GERAL) === */}
            <Collapsible open={openSections.notice} onOpenChange={() => toggleSection('notice')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
                  <div className="flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">Barra Superior</span>
                    {props.noticeEnabled && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">Ativo</Badge>
                    )}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.notice ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Exibir Barra Superior</Label>
                  <Switch className="scale-90"
                    checked={Boolean(props.noticeEnabled)}
                    onCheckedChange={(v) => updateProp('noticeEnabled', v)}
                  />
                </div>
                
                {props.noticeEnabled && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Texto do Aviso</Label>
                      <Input
                        value={(props.noticeText as string) || ''}
                        onChange={(e) => updateProp('noticeText', e.target.value)}
                        placeholder="Ex: Frete grátis em compras acima de R$199!"
                        className="h-7 text-xs"
                      />
                    </div>
                    <ColorInput
                      label="Cor de Fundo"
                      value={(props.noticeBgColor as string) || ''}
                      onChange={(v) => updateProp('noticeBgColor', v)}
                      placeholder="Herda do tema"
                    />
                    <ColorInput
                      label="Cor do Texto"
                      value={(props.noticeTextColor as string) || ''}
                      onChange={(v) => updateProp('noticeTextColor', v)}
                      placeholder="Herda do tema"
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs">Animação de Entrada</Label>
                      <Select
                        value={(props.noticeAnimation as string) || 'fade'}
                        onValueChange={(v) => updateProp('noticeAnimation', v)}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          <SelectItem value="fade">Fade</SelectItem>
                          <SelectItem value="slide-vertical">Slide Vertical</SelectItem>
                          <SelectItem value="slide-horizontal">Slide Horizontal</SelectItem>
                          <SelectItem value="marquee">Marquee (rolagem)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Exibir Ação</Label>
                      <Switch
                        checked={Boolean(props.noticeActionEnabled)}
                        onCheckedChange={(v) => updateProp('noticeActionEnabled', v)}
                      />
                    </div>

                    {props.noticeActionEnabled && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Texto da Ação</Label>
                          <Input
                            value={(props.noticeActionLabel as string) || ''}
                            onChange={(e) => updateProp('noticeActionLabel', e.target.value)}
                            placeholder="Ex: Saiba mais"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">URL da Ação</Label>
                          <Input
                            value={(props.noticeActionUrl as string) || ''}
                            onChange={(e) => updateProp('noticeActionUrl', e.target.value)}
                            placeholder="Ex: /promocao"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Abrir em</Label>
                          <Select
                            value={(props.noticeActionTarget as string) || '_self'}
                            onValueChange={(v) => updateProp('noticeActionTarget', v)}
                          >
                            <SelectTrigger className="w-full h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_self">Mesma aba</SelectItem>
                              <SelectItem value="_blank">Nova aba</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <ColorInput
                          label="Cor do Texto da Ação"
                          value={(props.noticeActionTextColor as string) || ''}
                          onChange={(v) => updateProp('noticeActionTextColor', v)}
                          placeholder="Mesmo do texto do aviso"
                        />
                      </>
                    )}
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // =========================================
  // HOME: Footer - Global configuration with sections
  // =========================================
  if (isHomePage && blockType === 'Footer') {
    return (
      <div className="h-full flex flex-col border-l">
        {/* Header with Global indicator */}
        <div className="p-4 border-b bg-primary/5">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {definition.label}
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  Configuração Global
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Afeta todas as páginas (exceto Checkout)
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {/* === CORES DO RODAPÉ === */}
            <Collapsible open={openSections.colors} onOpenChange={() => toggleSection('colors')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    <span className="font-medium">Cores do Rodapé</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.colors ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-4 space-y-4">
                <ColorInput
                  label="Cor de Fundo"
                  value={(props.footerBgColor as string) || ''}
                  onChange={(v) => updateProp('footerBgColor', v)}
                />
                <ColorInput
                  label="Cor do Texto"
                  value={(props.footerTextColor as string) || ''}
                  onChange={(v) => updateProp('footerTextColor', v)}
                />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* === SEÇÕES DO RODAPÉ === */}
            <Collapsible open={openSections.general} onOpenChange={() => toggleSection('general')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-primary" />
                    <span className="font-medium">Seções do Rodapé</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.general ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Mostrar Logo</Label>
                    <p className="text-xs text-muted-foreground">Exibe logo no rodapé</p>
                  </div>
                  <Switch
                    checked={Boolean(props.showLogo ?? true)}
                    onCheckedChange={(v) => updateProp('showLogo', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Mostrar Atendimento (SAC)</Label>
                    <p className="text-xs text-muted-foreground">Exibe seção de contato</p>
                  </div>
                  <Switch
                    checked={Boolean(props.showSac ?? true)}
                    onCheckedChange={(v) => updateProp('showSac', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Mostrar Redes Sociais</Label>
                    <p className="text-xs text-muted-foreground">Exibe links das redes sociais</p>
                  </div>
                  <Switch
                    checked={Boolean(props.showSocial ?? true)}
                    onCheckedChange={(v) => updateProp('showSocial', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Mostrar Informações Legais</Label>
                    <p className="text-xs text-muted-foreground">Exibe CNPJ, endereço, copyright</p>
                  </div>
                  <Switch
                    checked={Boolean(props.showLegal ?? true)}
                    onCheckedChange={(v) => updateProp('showLegal', v)}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* === TEXTOS PERSONALIZADOS === */}
            <Collapsible open={openSections.notice} onOpenChange={() => toggleSection('notice')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="font-medium">Textos Personalizados</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.notice ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título do SAC</Label>
                  <Input
                    value={(props.sacTitle as string) || ''}
                    onChange={(e) => updateProp('sacTitle', e.target.value)}
                    placeholder="Atendimento (SAC)"
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Deixe vazio para usar o padrão</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Texto Legal Personalizado</Label>
                  <textarea
                    value={(props.legalTextOverride as string) || ''}
                    onChange={(e) => updateProp('legalTextOverride', e.target.value)}
                    placeholder="Deixe vazio para usar: © {ano} {nome}. Todos os direitos reservados. CNPJ: ..."
                    className="w-full h-20 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                  />
                  <p className="text-xs text-muted-foreground">Substitui o texto legal padrão</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* === FORMAS DE PAGAMENTO === */}
            <FooterImageSection
              title="Formas de Pagamento"
              icon={<CreditCard className="h-4 w-4 text-primary" />}
              sectionKey="paymentMethods"
              props={props}
              updateProp={updateProp}
              openSections={openSections}
              toggleSection={toggleSection}
            />

            <Separator />

            {/* === SELOS DE SEGURANÇA === */}
            <FooterImageSection
              title="Selos de Segurança"
              icon={<ShieldCheck className="h-4 w-4 text-primary" />}
              sectionKey="securitySeals"
              props={props}
              updateProp={updateProp}
              openSections={openSections}
              toggleSection={toggleSection}
            />

            <Separator />

            {/* === FORMAS DE ENVIO === */}
            <FooterImageSection
              title="Formas de Envio"
              icon={<Truck className="h-4 w-4 text-primary" />}
              sectionKey="shippingMethods"
              props={props}
              updateProp={updateProp}
              openSections={openSections}
              toggleSection={toggleSection}
            />

            <Separator />

            {/* === LOJAS OFICIAIS === */}
            <FooterImageSection
              title="Lojas Oficiais"
              icon={<Store className="h-4 w-4 text-primary" />}
              sectionKey="officialStores"
              props={props}
              updateProp={updateProp}
              openSections={openSections}
              toggleSection={toggleSection}
              requireLink
            />
          </div>
        </ScrollArea>
      </div>
    );
  }

  // =========================================
  // HOME: Other block types - use default PropsEditor
  // =========================================
  if (isHomePage) {
    return (
      <div className="h-full flex flex-col border-l">
        {/* Header with Global indicator */}
        <div className="p-4 border-b bg-primary/5">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {definition.label}
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  Configuração Global
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Afeta todas as páginas (exceto Checkout)
              </p>
            </div>
          </div>
        </div>

        {/* Full props editor for global config */}
        <div className="flex-1 overflow-hidden">
          <PropsEditor
            definition={definition}
            props={props}
            onChange={onChange}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            canDelete={canDelete}
          />
        </div>
      </div>
    );
  }

  // =========================================
  // OTHER PAGES: Page-specific overrides only
  // =========================================
  return (
    <div className="h-full flex flex-col border-l">
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              {definition.label}
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                Opções desta página
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Não altera configuração global
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Info about global inheritance */}
          <Alert className="bg-muted/50 border-muted">
            <Globe className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Este {blockType === 'Header' ? 'cabeçalho' : 'rodapé'} herda as configurações globais definidas na <strong>Página Inicial</strong>.
            </AlertDescription>
          </Alert>

          <Separator />

          {/* Page-specific overrides section - Header */}
          {blockType === 'Header' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4" />
                Personalizações desta página
              </div>

              {/* Header Enabled Toggle Override */}
              <div className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="header-enabled-toggle" className="text-sm font-medium">
                      Exibir Cabeçalho
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {hasHeaderEnabledOverride 
                        ? 'Usando configuração desta página' 
                        : 'Herdando do global'}
                    </p>
                  </div>
                  <Switch
                    id="header-enabled-toggle"
                    checked={effectiveHeaderEnabled}
                    onCheckedChange={handleHeaderEnabledToggle}
                    disabled={isLoading || updateHeaderOverrides.isPending}
                  />
                </div>

                {!hasHeaderEnabledOverride && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: {globalHeaderEnabled ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                )}

                {hasHeaderEnabledOverride && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span className="text-xs text-amber-700">
                        Override ativo nesta página
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground hover:text-foreground"
                      onClick={handleHeaderEnabledRevertToGlobal}
                      disabled={clearHeaderOverride.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Voltar ao global
                    </Button>
                  </div>
                )}
              </div>

              {/* Notice Toggle Override */}
              <div className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="header-notice-toggle" className="text-sm font-medium">
                      Exibir Aviso Geral
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {hasHeaderNoticeOverride 
                        ? 'Usando configuração desta página' 
                        : 'Herdando do global'}
                    </p>
                  </div>
                  <Switch
                    id="header-notice-toggle"
                    checked={effectiveHeaderNoticeEnabled}
                    onCheckedChange={handleHeaderNoticeToggle}
                    disabled={isLoading || updateHeaderOverrides.isPending}
                  />
                </div>

                {!hasHeaderNoticeOverride && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: {globalHeaderNoticeEnabled ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                )}

                {hasHeaderNoticeOverride && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span className="text-xs text-amber-700">
                        Override ativo nesta página
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground hover:text-foreground"
                      onClick={handleHeaderRevertToGlobal}
                      disabled={clearHeaderOverride.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Voltar ao global
                    </Button>
                  </div>
                )}
              </div>

              {/* Show Header Menu Toggle Override */}
              <div className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="header-menu-toggle" className="text-sm font-medium">
                      Exibir Menu do Cabeçalho
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {hasShowHeaderMenuOverride 
                        ? 'Usando configuração desta página' 
                        : 'Herdando do global'}
                    </p>
                  </div>
                  <Switch
                    id="header-menu-toggle"
                    checked={effectiveShowHeaderMenu}
                    onCheckedChange={handleShowHeaderMenuToggle}
                    disabled={isLoading || updateHeaderOverrides.isPending}
                  />
                </div>

                {!hasShowHeaderMenuOverride && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: Ativado
                    </span>
                  </div>
                )}

                {hasShowHeaderMenuOverride && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span className="text-xs text-amber-700">
                        Override ativo nesta página
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground hover:text-foreground"
                      onClick={handleShowHeaderMenuRevertToGlobal}
                      disabled={clearHeaderOverride.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Voltar ao global
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Page-specific overrides section - Footer */}
          {blockType === 'Footer' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4" />
                Personalizações desta página
              </div>

              {/* Footer Enabled Toggle Override */}
              <div className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="footer-enabled-toggle" className="text-sm font-medium">
                      Exibir Rodapé
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {hasFooterEnabledOverride 
                        ? 'Usando configuração desta página' 
                        : 'Herdando do global'}
                    </p>
                  </div>
                  <Switch
                    id="footer-enabled-toggle"
                    checked={effectiveFooterEnabled}
                    onCheckedChange={handleFooterEnabledToggle}
                    disabled={isLoading || updateFooterOverrides.isPending}
                  />
                </div>

                {!hasFooterEnabledOverride && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: {globalFooterEnabled ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                )}

                {hasFooterEnabledOverride && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span className="text-xs text-amber-700">
                        Override ativo nesta página
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground hover:text-foreground"
                      onClick={handleFooterEnabledRevertToGlobal}
                      disabled={clearFooterOverride.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Voltar ao global
                    </Button>
                  </div>
                )}
              </div>

              {/* Show Footer 1 Toggle Override */}
              <div className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="footer-menu1-toggle" className="text-sm font-medium">
                      Exibir Menu do Rodapé 1
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {hasShowFooter1Override 
                        ? 'Usando configuração desta página' 
                        : 'Herdando do global'}
                    </p>
                  </div>
                  <Switch
                    id="footer-menu1-toggle"
                    checked={effectiveShowFooter1}
                    onCheckedChange={handleShowFooter1Toggle}
                    disabled={isLoading || updateFooterOverrides.isPending}
                  />
                </div>

                {!hasShowFooter1Override && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: {globalShowFooter1 ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                )}

                {hasShowFooter1Override && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span className="text-xs text-amber-700">
                        Override ativo nesta página
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground hover:text-foreground"
                      onClick={handleShowFooter1RevertToGlobal}
                      disabled={clearFooterOverride.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Voltar ao global
                    </Button>
                  </div>
                )}
              </div>

              {/* Show Footer 2 Toggle Override */}
              <div className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="footer-menu2-toggle" className="text-sm font-medium">
                      Exibir Menu do Rodapé 2
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {hasShowFooter2Override 
                        ? 'Usando configuração desta página' 
                        : 'Herdando do global'}
                    </p>
                  </div>
                  <Switch
                    id="footer-menu2-toggle"
                    checked={effectiveShowFooter2}
                    onCheckedChange={handleShowFooter2Toggle}
                    disabled={isLoading || updateFooterOverrides.isPending}
                  />
                </div>

                {!hasShowFooter2Override && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: {globalShowFooter2 ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                )}

                {hasShowFooter2Override && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span className="text-xs text-amber-700">
                        Override ativo nesta página
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground hover:text-foreground"
                      onClick={handleShowFooter2RevertToGlobal}
                      disabled={clearFooterOverride.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Voltar ao global
                    </Button>
                  </div>
                )}
              </div>

              {/* Notice Toggle Override */}
              <div className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="footer-notice-toggle" className="text-sm font-medium">
                      Exibir Aviso Geral do Rodapé
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {hasFooterNoticeOverride 
                        ? 'Usando configuração desta página' 
                        : 'Herdando do global'}
                    </p>
                  </div>
                  <Switch
                    id="footer-notice-toggle"
                    checked={effectiveFooterNoticeEnabled}
                    onCheckedChange={handleFooterNoticeToggle}
                    disabled={isLoading || updateFooterOverrides.isPending}
                  />
                </div>

                {!hasFooterNoticeOverride && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: {globalFooterNoticeEnabled ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                )}

                {hasFooterNoticeOverride && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span className="text-xs text-amber-700">
                        Override ativo nesta página
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground hover:text-foreground"
                      onClick={handleFooterRevertToGlobal}
                      disabled={clearFooterOverride.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Voltar ao global
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Link to edit global settings */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Para alterar as configurações globais do {blockType === 'Header' ? 'cabeçalho' : 'rodapé'}:
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                window.location.href = '/storefront/builder?edit=home';
              }}
            >
              <Globe className="h-4 w-4" />
              Editar na Página Inicial
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
