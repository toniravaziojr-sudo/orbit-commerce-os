// =============================================
// FOOTER SETTINGS - Global footer configuration
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Palette, ChevronDown, Settings, Type } from 'lucide-react';
import { toast } from 'sonner';
import type { BlockNode } from '@/lib/builder/types';
import type { Json } from '@/integrations/supabase/types';

interface FooterSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

// Default footer props
const defaultFooterProps: Record<string, unknown> = {
  menuId: '',
  showSocial: true,
  showLogo: true,
  showSac: true,
  showStoreInfo: true,
  showCopyright: true,
  copyrightText: '',
  sacTitle: '',
  footer1Title: '',
  footer2Title: '',
  footerTitlesColor: '',
};

// Color input component - instant preview with auto-save
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
  
  // Sync with external value on initial load only
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue); // Instant callback
  };
  
  const handleClear = () => {
    setLocalValue('');
    onChange('');
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

export function FooterSettings({ tenantId, templateSetId }: FooterSettingsProps) {
  const queryClient = useQueryClient();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    colors: true,
    general: false,
    texts: false,
  });
  
  // Local state for optimistic updates
  const [localProps, setLocalProps] = useState<Record<string, unknown>>(defaultFooterProps);
  const initialLoadDone = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedPropsRef = useRef<string>('');

  // Fetch current footer config from global layout
  const { data: footerConfig, isLoading } = useQuery({
    queryKey: ['footer-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data: layout, error } = await supabase
        .from('storefront_global_layout')
        .select('footer_config')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (error) {
        console.error('[FooterSettings] Error fetching:', error);
        return null;
      }
      
      const config = layout?.footer_config as unknown as BlockNode | null;
      return config?.props || null;
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // Initialize local state from fetched data (only once)
  useEffect(() => {
    if (footerConfig && !initialLoadDone.current) {
      const merged = { ...defaultFooterProps, ...footerConfig };
      setLocalProps(merged);
      lastSavedPropsRef.current = JSON.stringify(merged);
      initialLoadDone.current = true;
    } else if (!footerConfig && !isLoading && !initialLoadDone.current) {
      setLocalProps(defaultFooterProps);
      lastSavedPropsRef.current = JSON.stringify(defaultFooterProps);
      initialLoadDone.current = true;
    }
  }, [footerConfig, isLoading]);

  // Save footer config - preserves BlockNode structure
  const saveMutation = useMutation({
    mutationFn: async (allProps: Record<string, unknown>) => {
      const updatedConfig: BlockNode = {
        id: 'global-footer',
        type: 'Footer',
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
          .update({ footer_config: updatedConfig as unknown as Json })
          .eq('tenant_id', tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('storefront_global_layout')
          .insert({
            tenant_id: tenantId,
            footer_config: updatedConfig as unknown as Json,
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
      console.error('[FooterSettings] Save error:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  // Update cache immediately for instant preview
  const updateCacheOptimistically = useCallback((propsToSave: Record<string, unknown>) => {
    const updatedConfig: BlockNode = {
      id: 'global-footer',
      type: 'Footer',
      props: propsToSave,
    };
    
    // Update the global layout cache immediately
    queryClient.setQueryData(['global-layout-editor', tenantId], (old: unknown) => {
      if (!old || typeof old !== 'object') return old;
      return { ...old, footer_config: updatedConfig };
    });
  }, [queryClient, tenantId]);

  // Debounced save function to prevent spam
  const debouncedSave = useCallback((propsToSave: Record<string, unknown>) => {
    const propsJson = JSON.stringify(propsToSave);
    if (propsJson === lastSavedPropsRef.current) return;
    
    // Update cache immediately for instant preview
    updateCacheOptimistically(propsToSave);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      lastSavedPropsRef.current = propsJson;
      saveMutation.mutate(propsToSave);
    }, 400);
  }, [saveMutation, updateCacheOptimistically]);

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
      // Update cache immediately for instant preview
      updateCacheOptimistically(updated);
      lastSavedPropsRef.current = JSON.stringify(updated);
      saveMutation.mutate(updated);
      return updated;
    });
  }, [saveMutation, updateCacheOptimistically]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;
  }

  const props = localProps;

  return (
    <div className="space-y-2">
      {/* === CORES DO RODAPÉ === */}
      <Collapsible open={openSections.colors} onOpenChange={() => toggleSection('colors')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-primary" />
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
          />
          <ColorInput
            label="Cor do Texto"
            value={(props.footerTextColor as string) || ''}
            onChange={(v) => updateProp('footerTextColor', v)}
          />
          <ColorInput
            label="Cor dos Títulos"
            value={(props.footerTitlesColor as string) || ''}
            onChange={(v) => updateProp('footerTitlesColor', v)}
            placeholder="Padrão: mesma cor do texto"
          />
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* === SEÇÕES DO RODAPÉ === */}
      <Collapsible open={openSections.general} onOpenChange={() => toggleSection('general')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Seções do Rodapé</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.general ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Logo</Label>
              <p className="text-[10px] text-muted-foreground">Exibe logo no rodapé</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(props.showLogo ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showLogo', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Informações da Loja</Label>
              <p className="text-[10px] text-muted-foreground">Exibe nome, CNPJ e descrição</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(props.showStoreInfo ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showStoreInfo', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Atendimento (SAC)</Label>
              <p className="text-[10px] text-muted-foreground">Exibe seção de contato</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(props.showSac ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showSac', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Redes Sociais</Label>
              <p className="text-[10px] text-muted-foreground">Exibe links das redes sociais</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(props.showSocial ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showSocial', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Copyright</Label>
              <p className="text-[10px] text-muted-foreground">Exibe texto de direitos autorais</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(props.showCopyright ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showCopyright', v)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* === PERSONALIZAR TÍTULOS RODAPÉ === */}
      <Collapsible open={openSections.texts} onOpenChange={() => toggleSection('texts')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Personalizar Títulos Rodapé</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.texts ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[10px]">Título Atendimento</Label>
            <Input
              value={(props.sacTitle as string) || ''}
              onChange={(e) => updateProp('sacTitle', e.target.value)}
              placeholder="Atendimento (SAC)"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Deixe vazio para usar o padrão</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Título Footer 1</Label>
            <Input
              value={(props.footer1Title as string) || ''}
              onChange={(e) => updateProp('footer1Title', e.target.value)}
              placeholder="Categorias"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Primeira coluna de links</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Título Footer 2</Label>
            <Input
              value={(props.footer2Title as string) || ''}
              onChange={(e) => updateProp('footer2Title', e.target.value)}
              placeholder="Institucional"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Segunda coluna de links</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Texto do Copyright</Label>
            <textarea
              value={(props.copyrightText as string) || ''}
              onChange={(e) => updateProp('copyrightText', e.target.value)}
              placeholder="© {ano} {nome da loja}. Todos os direitos reservados. CNPJ: ..."
              className="w-full h-16 px-2 py-1 text-xs rounded-md border border-input bg-background resize-none"
            />
            <p className="text-[10px] text-muted-foreground">Deixe vazio para usar o padrão automático</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
