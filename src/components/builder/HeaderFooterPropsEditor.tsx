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
import { Globe, Settings, Info, RotateCcw, ShoppingBag, AlertCircle, Palette, Smartphone, Bell, ChevronDown, Phone, MessageCircle, Grid3X3, Star, ArrowUp, ArrowDown, User, Tag } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PropsEditor } from './PropsEditor';
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
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'institutional' | 'landing_page';
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

// Categories section for global header config
function CategoriesSection({ 
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
  // Fetch categories for selection
  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-categories', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const featuredCategoryIds = (props.featuredCategoryIds as string[]) || [];
  
  const toggleFeaturedCategory = (categoryId: string) => {
    const current = [...featuredCategoryIds];
    const index = current.indexOf(categoryId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(categoryId);
    }
    updateProp('featuredCategoryIds', current);
  };

  const moveFeaturedCategory = (categoryId: string, direction: 'up' | 'down') => {
    const current = [...featuredCategoryIds];
    const index = current.indexOf(categoryId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= current.length) return;
    
    [current[index], current[newIndex]] = [current[newIndex], current[index]];
    updateProp('featuredCategoryIds', current);
  };

  const featuredCategories = featuredCategoryIds
    .map(id => (categories || []).find(c => c.id === id))
    .filter(Boolean);

  return (
    <Collapsible open={openSections.categories} onOpenChange={() => toggleSection('categories')}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-3 h-auto">
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-primary" />
            <span className="font-medium">Categorias</span>
            {(props.showCategoriesMenu || props.featuredCategoriesEnabled) && (
              <Badge variant="secondary" className="text-xs">Ativo</Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${openSections.categories ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-4 space-y-4">
        {/* Menu Categorias Agrupadas */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4 text-purple-600" />
              <Label className="text-xs font-medium">Menu Categorias</Label>
            </div>
            <Switch
              checked={Boolean(props.showCategoriesMenu)}
              onCheckedChange={(v) => updateProp('showCategoriesMenu', v)}
            />
          </div>
          
          {props.showCategoriesMenu && (
            <div className="space-y-1.5">
              <Label className="text-xs">Texto do menu</Label>
              <Input
                value={(props.categoriesMenuLabel as string) || 'Categorias'}
                onChange={(e) => updateProp('categoriesMenuLabel', e.target.value)}
                placeholder="Ex: Categorias"
                className="h-9 text-sm"
              />
            </div>
          )}
        </div>

        {/* Categorias em Destaque */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <Label className="text-xs font-medium">Categorias em Destaque</Label>
            </div>
            <Switch
              checked={Boolean(props.featuredCategoriesEnabled)}
              onCheckedChange={(v) => updateProp('featuredCategoriesEnabled', v)}
            />
          </div>
          
          {props.featuredCategoriesEnabled && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Título (opcional)</Label>
                <Input
                  value={(props.featuredCategoriesLabel as string) || ''}
                  onChange={(e) => updateProp('featuredCategoriesLabel', e.target.value)}
                  placeholder="Ex: Destaques"
                  className="h-9 text-sm"
                />
              </div>
              
              {/* Selected categories with ordering */}
              {featuredCategories.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Ordem de exibição</Label>
                  <div className="space-y-1 border rounded-lg p-2">
                    {featuredCategories.map((cat: any, idx) => (
                      <div key={cat.id} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1.5">
                        <span className="text-xs">{cat.name}</span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={idx === 0}
                            onClick={() => moveFeaturedCategory(cat.id, 'up')}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={idx === featuredCategories.length - 1}
                            onClick={() => moveFeaturedCategory(cat.id, 'down')}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => toggleFeaturedCategory(cat.id)}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Category selection */}
              <div className="space-y-1.5">
                <Label className="text-xs">Selecionar categorias</Label>
                {isLoading ? (
                  <p className="text-xs text-muted-foreground">Carregando...</p>
                ) : categories && categories.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {categories.map((cat: any) => {
                      const isSelected = featuredCategoryIds.includes(cat.id);
                      return (
                        <label 
                          key={cat.id} 
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleFeaturedCategory(cat.id)}
                          />
                          <span className="text-xs">{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma categoria disponível</p>
                )}
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

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
        
        {props.featuredPromosEnabled && (
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
    categories: false,
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
  } = usePageOverrides({ tenantId, pageType, pageId });

  // Get global notice enabled value from props
  const globalNoticeEnabled = Boolean(props.noticeEnabled);
  
  // Check if there's an override
  const hasNoticeOverride = overrides?.header?.noticeEnabled !== undefined;
  
  // Get effective value (override > global)
  const effectiveNoticeEnabled = hasNoticeOverride 
    ? Boolean(overrides.header?.noticeEnabled) 
    : globalNoticeEnabled;

  // Handle toggle change - only creates override, never modifies global
  const handleNoticeToggle = async (checked: boolean) => {
    try {
      await updateHeaderOverrides.mutateAsync({ noticeEnabled: checked });
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  // Handle revert to global - removes override
  const handleRevertToGlobal = async () => {
    try {
      await clearHeaderOverride.mutateAsync('noticeEnabled');
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

            <Separator />

            {/* === CATEGORIAS NO CABEÇALHO === */}
            <CategoriesSection 
              props={props}
              updateProp={updateProp}
              tenantId={tenantId}
              openSections={openSections}
              toggleSection={toggleSection}
            />

            <Separator />

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

            {/* === ÁREA DO CLIENTE === */}
            <Collapsible open={openSections.customerArea} onOpenChange={() => toggleSection('customerArea')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">Área do Cliente</span>
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
                    <Label className="text-xs">Exibir "Minhas compras"</Label>
                    <p className="text-xs text-muted-foreground">Link para consulta de pedidos</p>
                  </div>
                  <Switch
                    checked={Boolean(props.customerAreaEnabled)}
                    onCheckedChange={(v) => updateProp('customerAreaEnabled', v)}
                  />
                </div>
                
                {props.customerAreaEnabled && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Texto do link</Label>
                    <Input
                      value={(props.customerAreaLabel as string) || 'Minhas compras'}
                      onChange={(e) => updateProp('customerAreaLabel', e.target.value)}
                      placeholder="Ex: Minhas compras"
                      className="h-9 text-sm"
                    />
                  </div>
                )}
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
  // HOME: Footer - use default PropsEditor
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

          {/* Page-specific overrides section - Header only */}
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
                    <Label htmlFor="notice-toggle" className="text-sm font-medium">
                      Exibir Aviso Geral
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {hasNoticeOverride 
                        ? 'Usando configuração desta página' 
                        : 'Herdando do global'}
                    </p>
                  </div>
                  <Switch
                    id="notice-toggle"
                    checked={effectiveNoticeEnabled}
                    onCheckedChange={handleNoticeToggle}
                    disabled={isLoading || updateHeaderOverrides.isPending}
                  />
                </div>

                {/* Inheritance indicator when no override */}
                {!hasNoticeOverride && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: {globalNoticeEnabled ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                )}

                {/* Override indicator when override exists */}
                {hasNoticeOverride && (
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
                      onClick={handleRevertToGlobal}
                      disabled={clearHeaderOverride.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Voltar ao global
                    </Button>
                  </div>
                )}
              </div>

              {/* Info about more options coming */}
              <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center">
                <Info className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">
                  Mais opções de personalização em breve
                </p>
              </div>
            </div>
          )}

          {/* Footer has no overrides yet */}
          {blockType === 'Footer' && (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center">
              <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Em breve: opções para personalizar o rodapé apenas nesta página.
              </p>
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
