// =============================================
// COLORS SETTINGS - Theme color palette
// =============================================

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface ColorsSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

interface ColorInput {
  id: string;
  label: string;
  description: string;
  defaultValue: string;
}

const colorInputs: ColorInput[] = [
  { id: 'primary', label: 'Cor primária', description: 'Botões, links e destaques', defaultValue: '#3b82f6' },
  { id: 'secondary', label: 'Cor secundária', description: 'Elementos complementares', defaultValue: '#64748b' },
  { id: 'accent', label: 'Cor de destaque', description: 'Badges, promoções e CTAs', defaultValue: '#f59e0b' },
  { id: 'background', label: 'Fundo', description: 'Cor de fundo principal', defaultValue: '#ffffff' },
  { id: 'foreground', label: 'Texto', description: 'Cor principal dos textos', defaultValue: '#0f172a' },
  { id: 'muted', label: 'Muted', description: 'Textos secundários e bordas', defaultValue: '#f1f5f9' },
];

export function ColorsSettings({ tenantId, templateSetId }: ColorsSettingsProps) {
  const [colors, setColors] = useState<Record<string, string>>(
    Object.fromEntries(colorInputs.map(c => [c.id, c.defaultValue]))
  );

  const handleColorChange = (id: string, value: string) => {
    setColors(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Configure as cores do seu tema. As alterações são aplicadas em tempo real no preview.
      </p>

      <div className="space-y-4">
        {colorInputs.map((colorInput, index) => (
          <div key={colorInput.id}>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{colorInput.label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors[colorInput.id]}
                  onChange={(e) => handleColorChange(colorInput.id, e.target.value)}
                  className="w-10 h-8 rounded border cursor-pointer"
                />
                <Input
                  value={colors[colorInput.id]}
                  onChange={(e) => handleColorChange(colorInput.id, e.target.value)}
                  placeholder="#000000"
                  className="flex-1 h-8 font-mono text-xs"
                />
              </div>
              <p className="text-xs text-muted-foreground">{colorInput.description}</p>
            </div>
            {index < colorInputs.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </div>

      {/* Color Preview */}
      <div className="p-4 rounded-lg border space-y-3 mt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
        <div className="flex gap-2">
          {colorInputs.slice(0, 4).map((colorInput) => (
            <div
              key={colorInput.id}
              className="w-12 h-12 rounded-lg border shadow-sm"
              style={{ backgroundColor: colors[colorInput.id] }}
              title={colorInput.label}
            />
          ))}
        </div>
        <div 
          className="p-3 rounded-lg"
          style={{ 
            backgroundColor: colors.background,
            color: colors.foreground,
          }}
        >
          <p className="text-sm font-medium">Texto de exemplo</p>
          <button 
            className="mt-2 px-3 py-1 rounded text-sm text-white"
            style={{ backgroundColor: colors.primary }}
          >
            Botão primário
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ Alterações serão aplicadas ao salvar o tema
      </p>
    </div>
  );
}
