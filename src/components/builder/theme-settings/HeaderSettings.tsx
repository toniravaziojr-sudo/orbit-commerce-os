// =============================================
// HEADER SETTINGS - Global header configuration
// Uses centralized useThemeSettings hook (template-wide)
// =============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, ChevronDown, Settings, Bell, Loader2, Upload, X, Image as ImageIcon, Navigation } from 'lucide-react';
import { useThemeHeader, DEFAULT_THEME_HEADER, ThemeHeaderConfig, MenuVisualStyle, LogoSizeType } from '@/hooks/useThemeSettings';
import { ImageUpload } from '@/components/settings/ImageUpload';
import { useAuth } from '@/hooks/useAuth';

interface HeaderSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

// Color input component - calls onChange on every change for instant preview
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

export function HeaderSettings({ tenantId, templateSetId }: HeaderSettingsProps) {
  const { user } = useAuth();
  const { header: savedHeader, updateHeader, isLoading, isSaving } = useThemeHeader(tenantId, templateSetId);
  const [localProps, setLocalProps] = useState<ThemeHeaderConfig>(DEFAULT_THEME_HEADER);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    colors: true,
    visualMenus: false,
    general: false,
    notice: false,
  });
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  // Initialize local state from hook data
  useEffect(() => {
    if (savedHeader && !initialLoadDone.current) {
      setLocalProps(savedHeader);
      initialLoadDone.current = true;
    }
  }, [savedHeader]);

  // Debounced save for text inputs
  const debouncedSave = useCallback((updates: Partial<ThemeHeaderConfig>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      updateHeader(updates);
    }, 400);
  }, [updateHeader]);

  // Update a single prop - immediate UI, debounced save
  const updateProp = useCallback((key: keyof ThemeHeaderConfig, value: unknown) => {
    setLocalProps(prev => {
      const updated = { ...prev, [key]: value };
      debouncedSave({ [key]: value });
      return updated;
    });
  }, [debouncedSave]);

  // Update prop immediately (for switches)
  const updatePropImmediate = useCallback((key: keyof ThemeHeaderConfig, value: unknown) => {
    setLocalProps(prev => {
      const updated = { ...prev, [key]: value };
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      updateHeader({ [key]: value });
      return updated;
    });
  }, [updateHeader]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch pages for promos selection
  const { data: pages } = useQuery({
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

  // Fetch categories for promos selection
  const { data: categories } = useQuery({
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* === CORES === */}
      <Collapsible open={openSections.colors} onOpenChange={() => toggleSection('colors')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Cores</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.colors ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-3">
          <ColorInput
            label="Cor de Fundo"
            value={localProps.headerBgColor || ''}
            onChange={(v) => updateProp('headerBgColor', v)}
          />
          <ColorInput
            label="Cor do Texto"
            value={localProps.headerTextColor || ''}
            onChange={(v) => updateProp('headerTextColor', v)}
          />
          <ColorInput
            label="Cor dos Ícones"
            value={localProps.headerIconColor || ''}
            onChange={(v) => updateProp('headerIconColor', v)}
          />
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* === BARRA SUPERIOR === */}
      <Collapsible open={openSections.notice} onOpenChange={() => toggleSection('notice')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Barra Superior</span>
              {localProps.noticeEnabled && (
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
              checked={Boolean(localProps.noticeEnabled)}
              onCheckedChange={(v) => updatePropImmediate('noticeEnabled', v)}
            />
          </div>
          
          {localProps.noticeEnabled && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[10px]">Efeito de Animação</Label>
                <Select
                  value={localProps.noticeAnimation || 'fade'}
                  onValueChange={(v) => updatePropImmediate('noticeAnimation', v as 'none' | 'fade' | 'slide' | 'marquee')}
                >
                  <SelectTrigger className="w-full h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (estático)</SelectItem>
                    <SelectItem value="fade">Fade (suave)</SelectItem>
                    <SelectItem value="slide">Slide (desliza vertical)</SelectItem>
                    <SelectItem value="marquee">Marquee (desliza horizontal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Texto do Aviso</Label>
                <Input
                  value={localProps.noticeText || ''}
                  onChange={(e) => updateProp('noticeText', e.target.value)}
                  placeholder="Ex: Frete grátis em compras acima de R$199!"
                  className="h-7 text-xs"
                />
              </div>
              <ColorInput
                label="Cor de Fundo"
                value={localProps.noticeBgColor || ''}
                onChange={(v) => updateProp('noticeBgColor', v)}
                placeholder="Herda do tema"
              />
              <ColorInput
                label="Cor do Texto"
                value={localProps.noticeTextColor || ''}
                onChange={(v) => updateProp('noticeTextColor', v)}
                placeholder="Herda do tema"
              />
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">Exibir Link</Label>
                <Switch className="scale-90"
                  checked={Boolean(localProps.noticeLinkEnabled)}
                  onCheckedChange={(v) => updatePropImmediate('noticeLinkEnabled', v)}
                />
              </div>
              {localProps.noticeLinkEnabled && (
                <>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Texto do Link</Label>
                    <Input
                      value={localProps.noticeLinkLabel || 'Clique Aqui'}
                      onChange={(e) => updateProp('noticeLinkLabel', e.target.value)}
                      placeholder="Ex: Clique Aqui"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">URL do Link</Label>
                    <Input
                      value={localProps.noticeLinkUrl || ''}
                      onChange={(e) => updateProp('noticeLinkUrl', e.target.value)}
                      placeholder="Ex: /promocoes"
                      className="h-7 text-xs"
                    />
                  </div>
                  <ColorInput
                    label="Cor do Link"
                    value={localProps.noticeLinkColor || '#60a5fa'}
                    onChange={(v) => updateProp('noticeLinkColor', v)}
                  />
                </>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* === VISUAL MENUS === */}
      <Collapsible open={openSections.visualMenus} onOpenChange={() => toggleSection('visualMenus')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Visual Menus</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.visualMenus ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px]">Estilo do Dropdown</Label>
            <Select 
              value={localProps.menuVisualStyle || 'classic'} 
              onValueChange={(v) => updatePropImmediate('menuVisualStyle', v as MenuVisualStyle)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione o estilo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Clássico</span>
                    <span className="text-[10px] text-muted-foreground">Dropdown tradicional com setas e cabeçalhos</span>
                  </div>
                </SelectItem>
                <SelectItem value="elegant" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Elegante</span>
                    <span className="text-[10px] text-muted-foreground">Animações suaves e efeito de fade</span>
                  </div>
                </SelectItem>
                <SelectItem value="minimal" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Minimalista</span>
                    <span className="text-[10px] text-muted-foreground">Limpo e simples, sem bordas extras</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Define a aparência dos menus dropdown no header
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Exibir Título da Categoria</Label>
              <p className="text-[10px] text-muted-foreground">Mostra o nome da categoria no topo do dropdown</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.menuShowParentTitle ?? true)}
              onCheckedChange={(v) => updatePropImmediate('menuShowParentTitle', v)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* === CONFIGURAÇÕES GERAIS === */}
      <Collapsible open={openSections.general} onOpenChange={() => toggleSection('general')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Configurações Gerais</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.general ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-2.5">
          {/* Logo Size */}
          <div className="space-y-1">
            <Label className="text-[10px]">Tamanho da Logo</Label>
            <Select 
              value={localProps.logoSize || 'medium'} 
              onValueChange={(v) => updatePropImmediate('logoSize', v as LogoSizeType)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione o tamanho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Pequeno</span>
                    <span className="text-[10px] text-muted-foreground">Logo mais compacta (32px)</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Médio</span>
                    <span className="text-[10px] text-muted-foreground">Tamanho padrão (40px)</span>
                  </div>
                </SelectItem>
                <SelectItem value="large" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Grande</span>
                    <span className="text-[10px] text-muted-foreground">Logo maior e destacada (56px)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Separator className="my-2" />
          
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Fixar ao rolar (Mobile)</Label>
            <Switch className="scale-90"
              checked={Boolean(localProps.stickyOnMobile ?? true)}
              onCheckedChange={(v) => updatePropImmediate('stickyOnMobile', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Fixo no Topo (Desktop)</Label>
            <Switch className="scale-90"
              checked={Boolean(localProps.sticky ?? true)}
              onCheckedChange={(v) => updatePropImmediate('sticky', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Mostrar Busca</Label>
            <Switch className="scale-90"
              checked={Boolean(localProps.showSearch ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showSearch', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Mostrar Carrinho</Label>
            <Switch className="scale-90"
              checked={Boolean(localProps.showCart ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showCart', v)}
            />
          </div>
          
          <Separator className="my-2" />
          
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Exibir "Minha Conta"</Label>
            <Switch className="scale-90"
              checked={Boolean(localProps.customerAreaEnabled)}
              onCheckedChange={(v) => updatePropImmediate('customerAreaEnabled', v)}
            />
          </div>
          
          <Separator className="my-2" />
          
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Exibir Promoções em Destaque</Label>
            <Switch className="scale-90"
              checked={Boolean(localProps.featuredPromosEnabled)}
              onCheckedChange={(v) => updatePropImmediate('featuredPromosEnabled', v)}
            />
          </div>
          
          {localProps.featuredPromosEnabled && (
            <div className="space-y-3 pl-2 border-l-2 border-primary/20 ml-1">
              <div className="space-y-1">
                <Label className="text-[10px]">Label do Link</Label>
                <Input
                  value={localProps.featuredPromosLabel || ''}
                  onChange={(e) => updateProp('featuredPromosLabel', e.target.value)}
                  placeholder="Ex: 🔥 Promoções"
                  className="h-7 text-xs"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px]">Destino</Label>
                <Select 
                  value={localProps.featuredPromosTarget || ''} 
                  onValueChange={(v) => updatePropImmediate('featuredPromosTarget', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione o destino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      <span className="text-muted-foreground">Nenhum destino</span>
                    </SelectItem>
                    {categories && categories.filter(cat => cat.id && cat.slug).length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                          Categorias
                        </div>
                        {categories.filter(cat => cat.id && cat.slug).map((cat) => (
                          <SelectItem key={cat.id} value={`category:${cat.slug}`} className="text-xs">
                            📁 {cat.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {pages && pages.filter(page => page.id && page.slug).length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                          Páginas
                        </div>
                        {pages.filter(page => page.id && page.slug).map((page) => (
                          <SelectItem key={page.id} value={`page:${page.slug}`} className="text-xs">
                            📄 {page.title}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Selecione uma categoria ou página para o link de promoções
                </p>
              </div>

              <ColorInput
                label="Cor do Texto"
                value={localProps.featuredPromosTextColor || ''}
                onChange={(v) => updateProp('featuredPromosTextColor', v)}
                placeholder="Padrão: cor primária"
              />

              <ColorInput
                label="Cor do Destaque"
                value={localProps.featuredPromosBgColor || ''}
                onChange={(v) => updateProp('featuredPromosBgColor', v)}
                placeholder="Padrão: cor primária"
              />
              
              {/* Thumbnail Upload - Desktop Only */}
              <div className="space-y-1.5 pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3 text-muted-foreground" />
                  <Label className="text-[10px] font-medium">Miniatura (Desktop)</Label>
                </div>
                <p className="text-[9px] text-muted-foreground leading-tight">
                  Exibida ao passar o mouse. 240x96px recomendado.
                </p>
                {localProps.featuredPromosThumbnail ? (
                  <div className="relative group w-full mt-2">
                    <img 
                      src={localProps.featuredPromosThumbnail} 
                      alt="Miniatura" 
                      className="w-full h-16 object-cover rounded-md border bg-muted"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => updatePropImmediate('featuredPromosThumbnail', '')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="mt-2 border-2 border-dashed border-muted-foreground/20 rounded-lg p-3 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
                    onClick={() => document.getElementById('featured-promo-upload')?.click()}
                  >
                    <ImageIcon className="h-5 w-5 mx-auto text-muted-foreground/50 mb-1" />
                    <p className="text-[10px] text-muted-foreground">Clique para selecionar</p>
                    <input
                      id="featured-promo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user?.id) return;
                        const { uploadAndRegisterToSystemDrive } = await import('@/lib/uploadAndRegisterToSystemDrive');
                        const result = await uploadAndRegisterToSystemDrive({
                          file,
                          tenantId,
                          userId: user.id,
                          source: 'header_featured_promo',
                          subPath: 'header',
                        });
                        if (result?.publicUrl) {
                          updatePropImmediate('featuredPromosThumbnail', result.publicUrl);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <p className="text-xs text-muted-foreground text-center pt-2">
        {isSaving ? '💾 Salvando...' : '✓ Configurações salvas automaticamente neste template'}
      </p>
    </div>
  );
}
