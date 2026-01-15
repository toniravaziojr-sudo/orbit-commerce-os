// =============================================
// FOOTER SETTINGS - Global footer configuration
// Uses centralized useThemeSettings hook (template-wide)
// =============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Palette, ChevronDown, Settings, Type, Loader2 } from 'lucide-react';
import { useThemeFooter, DEFAULT_THEME_FOOTER, ThemeFooterConfig } from '@/hooks/useThemeSettings';

interface FooterSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

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
  const { footer: savedFooter, updateFooter, isLoading, isSaving } = useThemeFooter(tenantId, templateSetId);
  const [localProps, setLocalProps] = useState<ThemeFooterConfig>(DEFAULT_THEME_FOOTER);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    colors: true,
    general: false,
    texts: false,
  });
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  // Initialize local state from hook data
  useEffect(() => {
    if (savedFooter && !initialLoadDone.current) {
      setLocalProps(savedFooter);
      initialLoadDone.current = true;
    }
  }, [savedFooter]);

  // Debounced save for text inputs
  const debouncedSave = useCallback((updates: Partial<ThemeFooterConfig>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      updateFooter(updates);
    }, 400);
  }, [updateFooter]);

  // Update a single prop - immediate UI, debounced save
  const updateProp = useCallback((key: keyof ThemeFooterConfig, value: unknown) => {
    setLocalProps(prev => {
      const updated = { ...prev, [key]: value };
      debouncedSave({ [key]: value });
      return updated;
    });
  }, [debouncedSave]);

  // Update prop immediately (for switches)
  const updatePropImmediate = useCallback((key: keyof ThemeFooterConfig, value: unknown) => {
    setLocalProps(prev => {
      const updated = { ...prev, [key]: value };
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      updateFooter({ [key]: value });
      return updated;
    });
  }, [updateFooter]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            value={localProps.footerBgColor || ''}
            onChange={(v) => updateProp('footerBgColor', v)}
          />
          <ColorInput
            label="Cor do Texto"
            value={localProps.footerTextColor || ''}
            onChange={(v) => updateProp('footerTextColor', v)}
          />
          <ColorInput
            label="Cor dos Títulos"
            value={localProps.footerTitlesColor || ''}
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
              checked={Boolean(localProps.showLogo ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showLogo', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Informações da Loja</Label>
              <p className="text-[10px] text-muted-foreground">Exibe nome, CNPJ e descrição</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.showStoreInfo ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showStoreInfo', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Atendimento (SAC)</Label>
              <p className="text-[10px] text-muted-foreground">Exibe seção de contato</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.showSac ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showSac', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Redes Sociais</Label>
              <p className="text-[10px] text-muted-foreground">Exibe links das redes sociais</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.showSocial ?? true)}
              onCheckedChange={(v) => updatePropImmediate('showSocial', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0">
              <Label className="text-[11px]">Mostrar Copyright</Label>
              <p className="text-[10px] text-muted-foreground">Exibe texto de direitos autorais</p>
            </div>
            <Switch className="scale-90"
              checked={Boolean(localProps.showCopyright ?? true)}
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
              value={localProps.sacTitle || ''}
              onChange={(e) => updateProp('sacTitle', e.target.value)}
              placeholder="Atendimento (SAC)"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Deixe vazio para usar o padrão</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Título Footer 1</Label>
            <Input
              value={localProps.footer1Title || ''}
              onChange={(e) => updateProp('footer1Title', e.target.value)}
              placeholder="Categorias"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Primeira coluna de links</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Título Footer 2</Label>
            <Input
              value={localProps.footer2Title || ''}
              onChange={(e) => updateProp('footer2Title', e.target.value)}
              placeholder="Institucional"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Segunda coluna de links</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Texto do Copyright</Label>
            <textarea
              value={localProps.copyrightText || ''}
              onChange={(e) => updateProp('copyrightText', e.target.value)}
              placeholder="© {ano} {nome da loja}. Todos os direitos reservados. CNPJ: ..."
              className="w-full h-16 px-2 py-1 text-xs rounded-md border border-input bg-background resize-none"
            />
            <p className="text-[10px] text-muted-foreground">Deixe vazio para usar o padrão automático</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <p className="text-xs text-muted-foreground text-center pt-2">
        {isSaving ? '💾 Salvando...' : '✓ Configurações salvas automaticamente neste template'}
      </p>
    </div>
  );
}
