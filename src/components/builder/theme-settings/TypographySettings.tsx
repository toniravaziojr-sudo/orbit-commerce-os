// =============================================
// TYPOGRAPHY SETTINGS - Font configuration
// Uses centralized useThemeSettings hook (template-wide)
// IMPORTANT: Typography updates DRAFT state for real-time preview
// Changes are NOT saved until user clicks "Salvar" in toolbar
// =============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertCircle } from 'lucide-react';
import { useThemeTypography, DEFAULT_THEME_TYPOGRAPHY, ThemeTypography } from '@/hooks/useThemeSettings';
import { getFontFamily } from '@/hooks/usePublicThemeSettings';
import { useBuilderDraftTheme } from '@/hooks/useBuilderDraftTheme';
import { useBuilderStore } from '@/hooks/useBuilderStore';

interface TypographySettingsProps {
  tenantId: string;
  templateSetId?: string;
}

const fontFamilies = [
  // Sans-serif fonts
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'open-sans', label: 'Open Sans' },
  { value: 'lato', label: 'Lato' },
  { value: 'montserrat', label: 'Montserrat' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'nunito', label: 'Nunito' },
  { value: 'raleway', label: 'Raleway' },
  { value: 'source-sans-pro', label: 'Source Sans Pro' },
  { value: 'ubuntu', label: 'Ubuntu' },
  { value: 'mulish', label: 'Mulish' },
  { value: 'work-sans', label: 'Work Sans' },
  { value: 'quicksand', label: 'Quicksand' },
  { value: 'dm-sans', label: 'DM Sans' },
  { value: 'manrope', label: 'Manrope' },
  { value: 'outfit', label: 'Outfit' },
  { value: 'plus-jakarta-sans', label: 'Plus Jakarta Sans' },
  // Serif fonts
  { value: 'playfair', label: 'Playfair Display' },
  { value: 'merriweather', label: 'Merriweather' },
  { value: 'lora', label: 'Lora' },
  { value: 'pt-serif', label: 'PT Serif' },
  { value: 'crimson-text', label: 'Crimson Text' },
  { value: 'libre-baskerville', label: 'Libre Baskerville' },
  { value: 'cormorant-garamond', label: 'Cormorant Garamond' },
  { value: 'eb-garamond', label: 'EB Garamond' },
  { value: 'bitter', label: 'Bitter' },
  // Display fonts
  { value: 'abril-fatface', label: 'Abril Fatface' },
  { value: 'bebas-neue', label: 'Bebas Neue' },
  { value: 'oswald', label: 'Oswald' },
  { value: 'josefin-sans', label: 'Josefin Sans' },
  { value: 'righteous', label: 'Righteous' },
];

export function TypographySettings({ tenantId, templateSetId }: TypographySettingsProps) {
  const { typography: savedTypography, isLoading } = useThemeTypography(tenantId, templateSetId);
  const draftTheme = useBuilderDraftTheme();
  const [localTypography, setLocalTypography] = useState<ThemeTypography>(DEFAULT_THEME_TYPOGRAPHY);
  const [hasChanges, setHasChanges] = useState(false);
  const initialLoadDone = useRef(false);

  // Initialize local state from saved typography (or draft if available)
  useEffect(() => {
    if (savedTypography && !initialLoadDone.current) {
      // If there's already a draft, use that; otherwise use saved
      const effectiveTypography = draftTheme?.draftTypography || savedTypography;
      setLocalTypography(effectiveTypography);
      initialLoadDone.current = true;
      // If draft exists, mark as having changes
      if (draftTheme?.draftTypography) {
        setHasChanges(true);
      }
    }
  }, [savedTypography, draftTheme?.draftTypography]);

  // Update draft for REAL-TIME PREVIEW without saving to database
  const handleChange = (key: keyof ThemeTypography, value: string | number) => {
    setLocalTypography(prev => {
      const updated = { ...prev, [key]: value };
      setHasChanges(true);
      // Update draft state for real-time preview in builder canvas
      if (draftTheme) {
        draftTheme.setDraftTypography(updated);
      }
      return updated;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notice about pending changes */}
      {hasChanges && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Alterações pendentes. Clique em <strong>Salvar</strong> na barra superior para aplicar.</span>
        </div>
      )}

      {/* Heading Font */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Fonte dos títulos</Label>
        <Select value={localTypography.headingFont} onValueChange={(v) => handleChange('headingFont', v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontFamilies.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Usada em H1, H2, H3 e títulos de seções
        </p>
      </div>

      <Separator />

      {/* Body Font */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Fonte do corpo</Label>
        <Select value={localTypography.bodyFont} onValueChange={(v) => handleChange('bodyFont', v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontFamilies.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Usada em parágrafos, botões e textos gerais
        </p>
      </div>

      <Separator />

      {/* Base Font Size */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Tamanho base</Label>
          <span className="text-sm text-muted-foreground">{localTypography.baseFontSize}px</span>
        </div>
        <Slider
          value={[localTypography.baseFontSize]}
          onValueChange={([v]) => handleChange('baseFontSize', v)}
          min={12}
          max={20}
          step={1}
        />
        <p className="text-xs text-muted-foreground">
          Tamanho padrão do texto (afeta proporcionalmente outros tamanhos)
        </p>
      </div>

      {/* Preview */}
      <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
        <h3 className="text-lg font-bold" style={{ fontFamily: getFontFamily(localTypography.headingFont) }}>
          Título de exemplo
        </h3>
        <p className="text-sm" style={{ fontFamily: getFontFamily(localTypography.bodyFont), fontSize: localTypography.baseFontSize }}>
          Este é um parágrafo de exemplo para visualizar a tipografia selecionada.
        </p>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        {hasChanges ? '⚠️ Alterações pendentes - clique em Salvar na barra superior' : '✓ Tipografia sincronizada com o tema'}
      </p>
    </div>
  );
}
