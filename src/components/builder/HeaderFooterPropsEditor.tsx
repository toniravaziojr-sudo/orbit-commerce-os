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
import { Checkbox } from '@/components/ui/checkbox';
import { Globe, Settings, Info, RotateCcw, ShoppingBag, AlertCircle, Palette, Smartphone, Bell, ChevronDown, Phone, MessageCircle, User, Tag, CreditCard, ShieldCheck, Truck, Store, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PropsEditor } from './PropsEditor';
import { ImageUploader } from './ImageUploader';
import { usePageOverrides, PageOverrides } from '@/hooks/usePageOverrides';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

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
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail' | 'institutional' | 'landing_page';
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
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-9 rounded border cursor-pointer"
        />
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-9 text-sm"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            className="h-9 px-2"
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
  const { data: pages, isLoading } = useQuery({
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

  const selectedPageId = (props.featuredPromosPageId as string) || '';
  const selectedPage = pages?.find(p => p.id === selectedPageId);

  // For backwards compatibility, if we have a slug but no ID, try to find by slug
  const legacySlug = (props.featuredPromosPageSlug as string) || '';
  const pageFromSlug = !selectedPageId && legacySlug ? pages?.find(p => p.slug === legacySlug) : null;
  
  // If we found page by slug, auto-migrate to ID
  if (pageFromSlug && !selectedPageId) {
    updateProp('featuredPromosPageId', pageFromSlug.id);
  }

  const effectivePageId = selectedPageId || pageFromSlug?.id || '';
  const effectivePage = selectedPage || pageFromSlug;

  const hasValidPage = Boolean(effectivePageId && effectivePage);

  return (
    <Collapsible open={openSections.promos} onOpenChange={() => toggleSection('promos')}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-3 h-auto">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-amber-500" />
            <span className="font-medium">Promoções em Destaque</span>
            {props.featuredPromosEnabled && (
              <Badge variant="secondary" className="text-xs">Ativo</Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${openSections.promos ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs">Exibir link de Promoções</Label>
            <p className="text-xs text-muted-foreground">Link destacado no menu</p>
          </div>
          <Switch
            checked={Boolean(props.featuredPromosEnabled)}
            onCheckedChange={(v) => updateProp('featuredPromosEnabled', v)}
          />
        </div>
        
        {Boolean(props.featuredPromosEnabled) && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Texto do link</Label>
              <Input
                value={(props.featuredPromosLabel as string) || 'Promoções'}
                onChange={(e) => updateProp('featuredPromosLabel', e.target.value)}
                placeholder="Ex: Promoções"
                className="h-9 text-sm"
              />
            </div>
            
            <ColorInput
              label="Cor do texto"
              value={(props.featuredPromosTextColor as string) || '#d97706'}
              onChange={(v) => updateProp('featuredPromosTextColor', v)}
              placeholder="Ex: #d97706 (dourado)"
            />
            
            <div className="space-y-1.5">
              <Label className="text-xs">Página de destino</Label>
              {isLoading ? (
                <p className="text-xs text-muted-foreground">Carregando páginas...</p>
              ) : pages && pages.length > 0 ? (
                <Select
                  value={effectivePageId}
                  onValueChange={(v) => {
                    updateProp('featuredPromosPageId', v);
                    // Clear legacy slug
                    if (props.featuredPromosPageSlug) {
                      updateProp('featuredPromosPageSlug', '');
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Selecione uma página" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.id} value={page.id}>
                        <span className="flex items-center gap-2">
                          {page.title}
                          <span className="text-xs text-muted-foreground">
                            ({page.type === 'landing_page' ? 'Landing' : 'Institucional'})
                          </span>
                          {!page.is_published && (
                            <span className="text-xs text-amber-600">(Rascunho)</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Alert className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Nenhuma página encontrada. Crie uma página institucional ou landing page primeiro.
                  </AlertDescription>
                </Alert>
              )}
              
              {props.featuredPromosEnabled && !hasValidPage && pages && pages.length > 0 && (
                <p className="text-xs text-amber-600">⚠️ Selecione uma página para exibir o link</p>
              )}
              
              {effectivePage && (
                <p className="text-xs text-muted-foreground">
                  Link: /page/{effectivePage.slug}
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

  const updateSection = (newData: Partial<FooterImageSectionData>) => {
    updateProp(sectionKey, { ...sectionData, ...newData });
  };

  const addItem = () => {
    updateSection({ items: [...items, { imageUrl: '', linkUrl: '' }] });
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    updateSection({ items: newItems });
  };

  const updateItem = (index: number, field: keyof FooterImageItem, value: string) => {
    const newItems = items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    updateSection({ items: newItems });
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
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs">Imagem</Label>
                  <ImageUploader
                    value={item.imageUrl}
                    onChange={(url) => updateItem(index, 'imageUrl', url)}
                    placeholder="Faça upload ou cole URL"
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

  // === HEADER OVERRIDES ===
  // Get global notice enabled value from props
  const globalHeaderNoticeEnabled = Boolean(props.noticeEnabled);
  
  // Check if there's an override
  const hasHeaderNoticeOverride = overrides?.header?.noticeEnabled !== undefined;
  
  // Get effective value (override > global)
  const effectiveHeaderNoticeEnabled = hasHeaderNoticeOverride 
    ? Boolean(overrides.header?.noticeEnabled) 
    : globalHeaderNoticeEnabled;

  // Handle toggle change - only creates override, never modifies global
  const handleHeaderNoticeToggle = async (checked: boolean) => {
    try {
      await updateHeaderOverrides.mutateAsync({ noticeEnabled: checked });
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

  // === FOOTER OVERRIDES ===
  // Get global footer notice enabled value from props
  const globalFooterNoticeEnabled = Boolean(props.noticeEnabled);
  
  // Check if there's an override for footer
  const hasFooterNoticeOverride = overrides?.footer?.noticeEnabled !== undefined;
  
  // Get effective value for footer (override > global)
  const effectiveFooterNoticeEnabled = hasFooterNoticeOverride 
    ? Boolean(overrides.footer?.noticeEnabled) 
    : globalFooterNoticeEnabled;

  // Handle footer toggle change - only creates override, never modifies global
  const handleFooterNoticeToggle = async (checked: boolean) => {
    try {
      await updateFooterOverrides.mutateAsync({ noticeEnabled: checked });
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
  // =========================================
  if (isCheckoutPage) {
    return (
      <div className="h-full flex flex-col border-l">
        {/* Header with Checkout-specific indicator */}
        <div className="p-4 border-b bg-amber-500/10">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {definition.label}
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300">
                  Checkout
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Layout separado do global (apenas checkout)
              </p>
            </div>
          </div>
        </div>

        {/* Full props editor for checkout config */}
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
  // HOME: Global configuration with sections
  // =========================================
  if (isHomePage && blockType === 'Header') {
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
            {/* 
              REMOVIDO: Estilo do Cabeçalho (headerStyle, menuId)
              Motivo: StorefrontHeader.tsx usa layout fixo, não implementa variações de estilo.
              A prop menuId é ignorada - o menu vem de usePublicStorefront().
              Re-adicionar quando implementar layouts variáveis no StorefrontHeader.
            */}

            {/* === CORES DO CABEÇALHO === */}
            <Collapsible open={openSections.colors} onOpenChange={() => toggleSection('colors')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    <span className="font-medium">Cores do Cabeçalho</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.colors ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-4 space-y-4">
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
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" />
                    <span className="font-medium">Configurações Gerais</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.general ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Fixar ao rolar (Mobile)</Label>
                    <p className="text-xs text-muted-foreground">Mantém o cabeçalho visível no celular</p>
                  </div>
                  <Switch
                    checked={Boolean(props.stickyOnMobile ?? true)}
                    onCheckedChange={(v) => updateProp('stickyOnMobile', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Fixo no Topo (Desktop)</Label>
                    <p className="text-xs text-muted-foreground">Mantém o cabeçalho visível no desktop</p>
                  </div>
                  <Switch
                    checked={Boolean(props.sticky ?? true)}
                    onCheckedChange={(v) => updateProp('sticky', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Mostrar Busca</Label>
                  </div>
                  <Switch
                    checked={Boolean(props.showSearch ?? true)}
                    onCheckedChange={(v) => updateProp('showSearch', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Mostrar Carrinho</Label>
                  </div>
                  <Switch
                    checked={Boolean(props.showCart ?? true)}
                    onCheckedChange={(v) => updateProp('showCart', v)}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>


            {/* REMOVIDO: Categoria em Destaque - menu vem do Menu Builder */}


            {/* === CONTATO NO CABEÇALHO === */}
            <Collapsible open={openSections.contact} onOpenChange={() => toggleSection('contact')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span className="font-medium">Contato no Cabeçalho</span>
                    {(props.showWhatsApp || props.showPhone) && (
                      <Badge variant="secondary" className="text-xs">Ativo</Badge>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.contact ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-4 space-y-4">
                {/* WhatsApp */}
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      <Label className="text-xs font-medium">WhatsApp</Label>
                    </div>
                    <Switch
                      checked={Boolean(props.showWhatsApp)}
                      onCheckedChange={(v) => updateProp('showWhatsApp', v)}
                    />
                  </div>
                  
                  {props.showWhatsApp && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Número (apenas dígitos)</Label>
                        <Input
                          value={(props.whatsAppNumber as string) || ''}
                          onChange={(e) => updateProp('whatsAppNumber', e.target.value)}
                          placeholder="Ex: 5511999999999"
                          className="h-9 text-sm"
                        />
                        {props.showWhatsApp && !(props.whatsAppNumber as string)?.replace(/\D/g, '').length && (
                          <p className="text-xs text-amber-600">⚠️ Informe o número para exibir</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Texto (opcional)</Label>
                        <Input
                          value={(props.whatsAppLabel as string) || ''}
                          onChange={(e) => updateProp('whatsAppLabel', e.target.value)}
                          placeholder="Ex: WhatsApp"
                          className="h-9 text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Telefone */}
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-blue-600" />
                      <Label className="text-xs font-medium">Telefone/Celular</Label>
                    </div>
                    <Switch
                      checked={Boolean(props.showPhone)}
                      onCheckedChange={(v) => updateProp('showPhone', v)}
                    />
                  </div>
                  
                  {props.showPhone && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Número</Label>
                        <Input
                          value={(props.phoneNumber as string) || ''}
                          onChange={(e) => updateProp('phoneNumber', e.target.value)}
                          placeholder="Ex: +55 (11) 99999-9999"
                          className="h-9 text-sm"
                        />
                        {props.showPhone && !(props.phoneNumber as string)?.replace(/[^\d+]/g, '').length && (
                          <p className="text-xs text-amber-600">⚠️ Informe o número para exibir</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Texto (opcional)</Label>
                        <Input
                          value={(props.phoneLabel as string) || ''}
                          onChange={(e) => updateProp('phoneLabel', e.target.value)}
                          placeholder="Ex: Atendimento"
                          className="h-9 text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* === MINHA CONTA === */}
            <Collapsible open={openSections.customerArea} onOpenChange={() => toggleSection('customerArea')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">Minha Conta</span>
                    {props.customerAreaEnabled && (
                      <Badge variant="secondary" className="text-xs">Ativo</Badge>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.customerArea ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Exibir "Minha Conta"</Label>
                    <p className="text-xs text-muted-foreground">Ícone no mobile, "Minha Conta" no desktop</p>
                  </div>
                  <Switch
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
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <span className="font-medium">Barra Superior</span>
                    {props.noticeEnabled && (
                      <Badge variant="secondary" className="text-xs">Ativo</Badge>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.notice ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Exibir Barra Superior</Label>
                  <Switch
                    checked={Boolean(props.noticeEnabled)}
                    onCheckedChange={(v) => updateProp('noticeEnabled', v)}
                  />
                </div>
                
                {props.noticeEnabled && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Texto do Aviso</Label>
                      <Input
                        value={(props.noticeText as string) || ''}
                        onChange={(e) => updateProp('noticeText', e.target.value)}
                        placeholder="Ex: Frete grátis em compras acima de R$199!"
                        className="h-9 text-sm"
                      />
                    </div>
                    <ColorInput
                      label="Cor de Fundo"
                      value={(props.noticeBgColor as string) || '#1e40af'}
                      onChange={(v) => updateProp('noticeBgColor', v)}
                    />
                    <ColorInput
                      label="Cor do Texto"
                      value={(props.noticeTextColor as string) || '#ffffff'}
                      onChange={(v) => updateProp('noticeTextColor', v)}
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
                          <SelectItem value="slide">Slide</SelectItem>
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

                {/* Inheritance indicator when no override */}
                {!hasHeaderNoticeOverride && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: {globalHeaderNoticeEnabled ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                )}

                {/* Override indicator when override exists */}
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
            </div>
          )}

          {/* Page-specific overrides section - Footer */}
          {blockType === 'Footer' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4" />
                Personalizações desta página
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

                {/* Inheritance indicator when no override */}
                {!hasFooterNoticeOverride && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: {globalFooterNoticeEnabled ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                )}

                {/* Override indicator when override exists */}
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
