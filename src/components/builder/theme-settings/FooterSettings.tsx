// =============================================
// FOOTER SETTINGS - Global footer configuration
// Inside ThemeSettingsPanel, replaces right-panel HeaderFooterPropsEditor
// =============================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Palette, ChevronDown, Settings, Info } from 'lucide-react';
import { toast } from 'sonner';

interface FooterSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

// Color input component
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

export function FooterSettings({ tenantId, templateSetId }: FooterSettingsProps) {
  const queryClient = useQueryClient();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    colors: true,
    general: false,
    texts: false,
  });

  // Fetch current footer props from global layout
  // Footer config is stored as a BlockNode: { id, type, props: {...} }
  const { data: footerProps, isLoading } = useQuery({
    queryKey: ['footer-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      
      const { data: layout } = await supabase
        .from('storefront_global_layout')
        .select('footer_config')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      // footer_config is a BlockNode with { id, type, props }
      const config = layout?.footer_config as { id?: string; type?: string; props?: Record<string, unknown> } | null;
      return config?.props || {};
    },
    enabled: !!tenantId,
  });

  // Save footer props - must preserve BlockNode structure
  const saveMutation = useMutation({
    mutationFn: async (newProps: Record<string, unknown>) => {
      // First fetch current config to preserve structure
      const { data: currentLayout } = await supabase
        .from('storefront_global_layout')
        .select('footer_config')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      const currentConfig = currentLayout?.footer_config as { id?: string; type?: string; props?: Record<string, unknown> } | null;
      
      // Build updated BlockNode preserving id/type
      const updatedConfig = {
        id: currentConfig?.id || 'global-footer',
        type: currentConfig?.type || 'Footer',
        props: { ...currentConfig?.props, ...newProps },
      };
      
      // Check if row exists
      const { data: existing } = await supabase
        .from('storefront_global_layout')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (existing) {
        await supabase
          .from('storefront_global_layout')
          .update({ footer_config: updatedConfig as unknown as Record<string, never> })
          .eq('tenant_id', tenantId);
      } else {
        await supabase
          .from('storefront_global_layout')
          .insert({
            tenant_id: tenantId,
            footer_config: updatedConfig as unknown as Record<string, never>,
          });
      }
      
      return newProps;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['footer-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['global-layout-editor'] });
      queryClient.invalidateQueries({ queryKey: ['public-global-layout'] });
      queryClient.invalidateQueries({ queryKey: ['builder-content'] });
      toast.success('Configurações salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const updateProp = (key: string, value: unknown) => {
    saveMutation.mutate({ [key]: value });
  };

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;
  }

  const props = footerProps || {};

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
              onCheckedChange={(v) => updateProp('showLogo', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Atendimento (SAC)</Label>
              <p className="text-[10px] text-muted-foreground">Exibe seção de contato</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(props.showSac ?? true)}
              onCheckedChange={(v) => updateProp('showSac', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Redes Sociais</Label>
              <p className="text-[10px] text-muted-foreground">Exibe links das redes sociais</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(props.showSocial ?? true)}
              onCheckedChange={(v) => updateProp('showSocial', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Informações Legais</Label>
              <p className="text-[10px] text-muted-foreground">Exibe CNPJ, endereço, copyright</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(props.showLegal ?? true)}
              onCheckedChange={(v) => updateProp('showLegal', v)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* === TEXTOS PERSONALIZADOS === */}
      <Collapsible open={openSections.texts} onOpenChange={() => toggleSection('texts')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 h-auto text-xs">
            <div className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Textos Personalizados</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.texts ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-3 space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[10px]">Título do SAC</Label>
            <Input
              value={(props.sacTitle as string) || ''}
              onChange={(e) => updateProp('sacTitle', e.target.value)}
              placeholder="Atendimento (SAC)"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Deixe vazio para usar o padrão</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Texto Legal Personalizado</Label>
            <textarea
              value={(props.legalTextOverride as string) || ''}
              onChange={(e) => updateProp('legalTextOverride', e.target.value)}
              placeholder="Deixe vazio para usar: © {ano} {nome}. Todos os direitos reservados. CNPJ: ..."
              className="w-full h-20 px-2 py-1 text-xs rounded-md border border-input bg-background resize-none"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
