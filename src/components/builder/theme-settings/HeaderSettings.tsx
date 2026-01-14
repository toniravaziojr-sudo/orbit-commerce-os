// =============================================
// HEADER SETTINGS - Global header configuration
// Inside ThemeSettingsPanel, replaces right-panel HeaderFooterPropsEditor
// =============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, ChevronDown, Smartphone, User, Tag, Bell, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { BlockNode } from '@/lib/builder/types';
import type { Json } from '@/integrations/supabase/types';

interface HeaderSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

// Default header config to ensure we always have valid structure
const defaultHeaderProps: Record<string, unknown> = {
  menuId: '',
  showSearch: true,
  showCart: true,
  sticky: true,
  stickyOnMobile: true,
  noticeEnabled: false,
  customerAreaEnabled: false,
  featuredPromosEnabled: false,
};

// Color input component with INSTANT preview (no debounce)
// Shows preview in real-time, only saves on "Apply" button
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
  const [localValue, setLocalValue] = useState(value);
  const [isDirty, setIsDirty] = useState(false);
  
  // Sync with external value when it changes (on initial load or after save)
  useEffect(() => {
    setLocalValue(value);
    setIsDirty(false);
  }, [value]);
  
  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    setIsDirty(newValue !== value);
  };
  
  const handleApply = () => {
    if (isDirty) {
      onChange(localValue);
      setIsDirty(false);
    }
  };
  
  const handleClear = () => {
    setLocalValue('');
    onChange('');
    setIsDirty(false);
  };
  
  return (
    <div className="space-y-1">
      <Label className="text-[10px]">{label}</Label>
      <div className="flex gap-1.5">
        <input
          type="color"
          value={localValue || '#000000'}
          onChange={(e) => handleChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer"
        />
        <Input
          value={localValue || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-7 text-xs"
        />
        {isDirty && (
          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
            className="h-7 px-2 text-xs gap-1"
          >
            <Check className="h-3 w-3" />
            Aplicar
          </Button>
        )}
        {localValue && !isDirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
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
  const queryClient = useQueryClient();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    colors: true,
    general: false,
    customerArea: false,
    promos: false,
    notice: false,
  });
  
  // Local state for optimistic updates
  const [localProps, setLocalProps] = useState<Record<string, unknown>>(defaultHeaderProps);
  const initialLoadDone = useRef(false);

  // Fetch current header config from global layout
  const { data: headerConfig, isLoading } = useQuery({
    queryKey: ['header-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data: layout, error } = await supabase
        .from('storefront_global_layout')
        .select('header_config')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (error) {
        console.error('[HeaderSettings] Error fetching:', error);
        return null;
      }
      
      const config = layout?.header_config as unknown as BlockNode | null;
      return config?.props || null;
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  // Initialize local state from fetched data (only once)
  useEffect(() => {
    if (headerConfig && !initialLoadDone.current) {
      setLocalProps({ ...defaultHeaderProps, ...headerConfig });
      initialLoadDone.current = true;
    } else if (!headerConfig && !isLoading && !initialLoadDone.current) {
      setLocalProps(defaultHeaderProps);
      initialLoadDone.current = true;
    }
  }, [headerConfig, isLoading]);

  // Save header config - preserves BlockNode structure
  const saveMutation = useMutation({
    mutationFn: async (allProps: Record<string, unknown>) => {
      const updatedConfig: BlockNode = {
        id: 'global-header',
        type: 'Header',
        props: allProps,
      };
      
      // Check if row exists
      const { data: existing } = await supabase
        .from('storefront_global_layout')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from('storefront_global_layout')
          .update({ header_config: updatedConfig as unknown as Json })
          .eq('tenant_id', tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('storefront_global_layout')
          .insert({
            tenant_id: tenantId,
            header_config: updatedConfig as unknown as Json,
          });
        if (error) throw error;
      }
      
      return updatedConfig;
    },
    onSuccess: () => {
      // Invalidate queries to update builder canvas
      queryClient.invalidateQueries({ queryKey: ['global-layout-editor', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['public-global-layout'] });
      toast.success('Configurações salvas');
    },
    onError: (error) => {
      console.error('[HeaderSettings] Save error:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  // Update a single prop - immediate for switches, with save
  const updateProp = useCallback((key: string, value: unknown) => {
    const updated = { ...localProps, [key]: value };
    setLocalProps(updated);
    saveMutation.mutate(updated);
  }, [localProps, saveMutation]);

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

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;
  }

  const props = localProps;

  return (
    <div className="space-y-2">
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
            <Label className="text-[11px]">Fixar ao rolar (Mobile)</Label>
            <Switch className="scale-90"
              checked={Boolean(props.stickyOnMobile ?? true)}
              onCheckedChange={(v) => updateProp('stickyOnMobile', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Fixo no Topo (Desktop)</Label>
            <Switch className="scale-90"
              checked={Boolean(props.sticky ?? true)}
              onCheckedChange={(v) => updateProp('sticky', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Mostrar Busca</Label>
            <Switch className="scale-90"
              checked={Boolean(props.showSearch ?? true)}
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
        </CollapsibleContent>
      </Collapsible>

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
            <Label className="text-[11px]">Exibir "Minha Conta"</Label>
            <Switch className="scale-90"
              checked={Boolean(props.customerAreaEnabled)}
              onCheckedChange={(v) => updateProp('customerAreaEnabled', v)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* === PROMOÇÕES EM DESTAQUE === */}
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
            <Label className="text-[11px]">Exibir link de Promoções</Label>
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
              
              {pages && pages.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[10px]">Página de destino</Label>
                  <Select
                    value={(props.featuredPromosPageId as string) || ''}
                    onValueChange={(v) => updateProp('featuredPromosPageId', v)}
                  >
                    <SelectTrigger className="w-full h-7 text-xs">
                      <SelectValue placeholder="Selecione uma página" />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.map((page) => (
                        <SelectItem key={page.id} value={page.id}>
                          {page.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

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
                value={(props.noticeBgColor as string) || '#1e40af'}
                onChange={(v) => updateProp('noticeBgColor', v)}
              />
              <ColorInput
                label="Cor do Texto"
                value={(props.noticeTextColor as string) || '#ffffff'}
                onChange={(v) => updateProp('noticeTextColor', v)}
              />
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">Exibir Link</Label>
                <Switch className="scale-90"
                  checked={Boolean(props.noticeLinkEnabled)}
                  onCheckedChange={(v) => updateProp('noticeLinkEnabled', v)}
                />
              </div>
              {props.noticeLinkEnabled && (
                <>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Texto do Link</Label>
                    <Input
                      value={(props.noticeLinkText as string) || 'Clique Aqui'}
                      onChange={(e) => updateProp('noticeLinkText', e.target.value)}
                      placeholder="Ex: Saiba mais"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">URL do Link</Label>
                    <Input
                      value={(props.noticeLinkUrl as string) || ''}
                      onChange={(e) => updateProp('noticeLinkUrl', e.target.value)}
                      placeholder="Ex: /promocoes"
                      className="h-7 text-xs"
                    />
                  </div>
                  <ColorInput
                    label="Cor do Link"
                    value={(props.noticeLinkColor as string) || '#93c5fd'}
                    onChange={(v) => updateProp('noticeLinkColor', v)}
                  />
                </>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
