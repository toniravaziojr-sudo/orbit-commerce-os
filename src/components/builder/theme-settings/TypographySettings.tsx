// =============================================
// TYPOGRAPHY SETTINGS - Font configuration
// =============================================

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

interface TypographySettingsProps {
  tenantId: string;
  templateSetId?: string;
}

const fontFamilies = [
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'open-sans', label: 'Open Sans' },
  { value: 'lato', label: 'Lato' },
  { value: 'montserrat', label: 'Montserrat' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'nunito', label: 'Nunito' },
  { value: 'playfair', label: 'Playfair Display' },
];

export function TypographySettings({ tenantId, templateSetId }: TypographySettingsProps) {
  const [headingFont, setHeadingFont] = useState('inter');
  const [bodyFont, setBodyFont] = useState('inter');
  const [baseFontSize, setBaseFontSize] = useState(16);

  return (
    <div className="space-y-6">
      {/* Heading Font */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Fonte dos títulos</Label>
        <Select value={headingFont} onValueChange={setHeadingFont}>
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
        <Select value={bodyFont} onValueChange={setBodyFont}>
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
          <span className="text-sm text-muted-foreground">{baseFontSize}px</span>
        </div>
        <Slider
          value={[baseFontSize]}
          onValueChange={([v]) => setBaseFontSize(v)}
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
        <h3 className="text-lg font-bold">Título de exemplo</h3>
        <p className="text-sm">Este é um parágrafo de exemplo para visualizar a tipografia selecionada.</p>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ Alterações serão aplicadas ao salvar o tema
      </p>
    </div>
  );
}
