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
import { Palette, ChevronDown, Settings, Bell } from 'lucide-react';
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

// Debounce hook for delayed save
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Color input component with INSTANT preview and debounced auto-save
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
  const debouncedValue = useDebounce(localValue, 600);
  const isFirstRender = useRef(true);
  const lastSavedValue = useRef(value);
  
  // Sync with external value on initial load
  useEffect(() => {
    if (value !== lastSavedValue.current) {
      setLocalValue(value);
      lastSavedValue.current = value;
    }
  }, [value]);
  
  // Auto-save after debounce (not on first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debouncedValue !== lastSavedValue.current) {
      lastSavedValue.current = debouncedValue;
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange]);
  
  const handleClear = () => {
    setLocalValue('');
    lastSavedValue.current = '';
    onChange('');
  };
  
  return (
    <div className="space-y-1">
      <Label className="text-[10px]">{label}</Label>
      <div className="flex gap-1.5">
        <input
          type="color"
          value={localValue || '#000000'}
          onChange={(e) => setLocalValue(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer"
        />
        <Input
          value={localValue || ''}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-7 text-xs"
        />
        {localValue && (
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
    notice: false,
  });
  
  // Local state for optimistic updates
  const [localProps, setLocalProps] = useState<Record<string, unknown>>(defaultHeaderProps);
  const initialLoadDone = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedPropsRef = useRef<string>('');

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
    staleTime: 60000,
  });

  // Initialize local state from fetched data (only once)
  useEffect(() => {
    if (headerConfig && !initialLoadDone.current) {
      const merged = { ...defaultHeaderProps, ...headerConfig };
      setLocalProps(merged);
      lastSavedPropsRef.current = JSON.stringify(merged);
      initialLoadDone.current = true;
    } else if (!headerConfig && !isLoading && !initialLoadDone.current) {
      setLocalProps(defaultHeaderProps);
      lastSavedPropsRef.current = JSON.stringify(defaultHeaderProps);
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
    },
    onError: (error) => {
      console.error('[HeaderSettings] Save error:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  // Debounced save function to prevent spam
  const debouncedSave = useCallback((propsToSave: Record<string, unknown>) => {
    const propsJson = JSON.stringify(propsToSave);
    if (propsJson === lastSavedPropsRef.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      lastSavedPropsRef.current = propsJson;
      saveMutation.mutate(propsToSave);
    }, 300);
  }, [saveMutation]);

  // Update a single prop - immediate UI, debounced save
  const updateProp = useCallback((key: string, value: unknown) => {
    setLocalProps(prev => {
      const updated = { ...prev, [key]: value };
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  // Update prop immediately (for switches - no extra debounce needed)
  const updatePropImmediate = useCallback((key: string, value: unknown) => {
    setLocalProps(prev => {
      const updated = { ...prev, [key]: value };
      // Clear any pending debounce and save immediately
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      lastSavedPropsRef.current = JSON.stringify(updated);
      saveMutation.mutate(updated);
      return updated;
    });
  }, [saveMutation]);

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

      {/* === BARRA SUPERIOR === */}
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
              onCheckedChange={(v) => updatePropImmediate('noticeEnabled', v)}
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
                  onCheckedChange={(v) => updatePropImmediate('noticeLinkEnabled', v)}
                />
              </div>
              {props.noticeLinkEnabled && (
                <>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Texto do Link</Label>
                    <Input
                      value={(props.noticeLinkLabel as string) || 'Clique Aqui'}
                      onChange={(e) => updateProp('noticeLinkLabel', e.target.value)}
                      placeholder="Ex: Clique Aqui"
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
                    value={(props.noticeLinkColor as string) || '#60a5fa'}
                    onChange={(v) => updateProp('noticeLinkColor', v)}
                  />
                </>
              )}
            </>
          )}
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
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Fixar ao rolar (Mobile)</Label>
            <Switch className="scale-90"
              checked={Boolean(props.stickyOnMobile ?? true)}
              onCheckedChange={(v) => updatePropImmediate('stickyOnMobile', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Fixo no Topo (Desktop)</Label>
            <Switch className="scale-90"
              checked={Boolean(props.sticky ?? true)}
              onCheckedChange={(v) => updatePropImmediate('sticky', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Mostrar Busca</Label>
            <Switch className="scale-90"
              checked={Boolean(props.showSearch ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showSearch', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Mostrar Carrinho</Label>
            <Switch className="scale-90"
              checked={Boolean(props.showCart ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showCart', v)}
            />
          </div>
          
          <Separator className="my-2" />
          
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Exibir "Minha Conta"</Label>
            <Switch className="scale-90"
              checked={Boolean(props.customerAreaEnabled)}
              onCheckedChange={(v) => updatePropImmediate('customerAreaEnabled', v)}
            />
          </div>
          
          <Separator className="my-2" />
          
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Exibir Promoções em Destaque</Label>
            <Switch className="scale-90"
              checked={Boolean(props.featuredPromosEnabled)}
              onCheckedChange={(v) => updatePropImmediate('featuredPromosEnabled', v)}
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
    </div>
  );
}