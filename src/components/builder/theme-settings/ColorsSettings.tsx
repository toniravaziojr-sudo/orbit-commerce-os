// =============================================
// COLORS SETTINGS - Theme color palette for buttons and text
// Uses centralized useThemeSettings hook (template-wide)
// =============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { useThemeColors, DEFAULT_THEME_COLORS, ThemeColors } from '@/hooks/useThemeSettings';

interface ColorsSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

interface ColorInput {
  id: keyof ThemeColors;
  label: string;
  description: string;
  group: 'primary' | 'secondary' | 'text' | 'tags';
}

const colorInputs: ColorInput[] = [
  // Primary button group
  { 
    id: 'buttonPrimaryBg', 
    label: 'Fundo do Botão Primário', 
    description: 'Aplicado em: botão "Comprar agora", "Adicionar ao carrinho", "Finalizar pedido"', 
    group: 'primary' 
  },
  { 
    id: 'buttonPrimaryText', 
    label: 'Texto do Botão Primário', 
    description: 'Texto dentro dos botões primários. Use cor clara para fundos escuros', 
    group: 'primary' 
  },
  { 
    id: 'buttonPrimaryHover', 
    label: 'Hover do Botão Primário', 
    description: 'Cor de fundo ao passar o mouse sobre o botão primário', 
    group: 'primary' 
  },
  // Secondary button group
  { 
    id: 'buttonSecondaryBg', 
    label: 'Fundo do Botão Secundário', 
    description: 'Botões "Cancelar", "Voltar", "Ver detalhes" e ações secundárias', 
    group: 'secondary' 
  },
  { 
    id: 'buttonSecondaryText', 
    label: 'Texto do Botão Secundário', 
    description: 'Texto dentro dos botões secundários', 
    group: 'secondary' 
  },
  { 
    id: 'buttonSecondaryHover', 
    label: 'Hover do Botão Secundário', 
    description: 'Cor de fundo ao passar o mouse sobre o botão secundário', 
    group: 'secondary' 
  },
  // Accent color
  { 
    id: 'accentColor', 
    label: 'Cor de Destaque', 
    description: 'Ícones de check, setas, indicadores de etapas, links, "Grátis" e detalhes da interface. Também afeta tags de sucesso se não configuradas.', 
    group: 'text' 
  },
  // Text colors
  { 
    id: 'textPrimary', 
    label: 'Texto Principal', 
    description: 'Títulos, nomes de produtos, preços e textos de destaque', 
    group: 'text' 
  },
  { 
    id: 'textSecondary', 
    label: 'Texto Secundário', 
    description: 'Descrições, legendas, informações de frete e textos auxiliares', 
    group: 'text' 
  },
  // Special tags - success
  { 
    id: 'successBg', 
    label: 'Fundo Tags Sucesso', 
    description: 'Tags "Grátis", "Frete Grátis", "5% OFF", indicadores positivos', 
    group: 'tags' 
  },
  { 
    id: 'successText', 
    label: 'Texto Tags Sucesso', 
    description: 'Texto dentro das tags de sucesso', 
    group: 'tags' 
  },
  // Special tags - warning
  { 
    id: 'warningBg', 
    label: 'Fundo Tags Destaque', 
    description: 'Tags "Mais Vendido", "Novo", "Promoção", destaques de produtos', 
    group: 'tags' 
  },
  { 
    id: 'warningText', 
    label: 'Texto Tags Destaque', 
    description: 'Texto dentro das tags de destaque', 
    group: 'tags' 
  },
  // Special tags - danger
  { 
    id: 'dangerBg', 
    label: 'Fundo Tags Desconto', 
    description: 'Tags "-37%", "Últimas unidades", alertas e descontos', 
    group: 'tags' 
  },
  { 
    id: 'dangerText', 
    label: 'Texto Tags Desconto', 
    description: 'Texto dentro das tags de desconto/alerta', 
    group: 'tags' 
  },
  // Special tags - highlight
  { 
    id: 'highlightBg', 
    label: 'Fundo Tags Info', 
    description: 'Tags "Novo", informativos, badges de categoria', 
    group: 'tags' 
  },
  { 
    id: 'highlightText', 
    label: 'Texto Tags Info', 
    description: 'Texto dentro das tags informativas', 
    group: 'tags' 
  },
];

export function ColorsSettings({ tenantId, templateSetId }: ColorsSettingsProps) {
  const { colors: savedColors, updateColors, isLoading, isSaving } = useThemeColors(tenantId, templateSetId);
  const [localColors, setLocalColors] = useState<ThemeColors>(DEFAULT_THEME_COLORS);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  // Initialize local state from hook data
  useEffect(() => {
    if (savedColors && !initialLoadDone.current) {
      setLocalColors(savedColors);
      initialLoadDone.current = true;
    }
  }, [savedColors]);

  // Debounced save
  const debouncedSave = useCallback((newColors: Partial<ThemeColors>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      updateColors(newColors);
    }, 500);
  }, [updateColors]);

  const handleColorChange = (id: keyof ThemeColors, value: string) => {
    setLocalColors(prev => {
      const updated = { ...prev, [id]: value };
      debouncedSave({ [id]: value });
      return updated;
    });
  };

  const primaryInputs = colorInputs.filter(c => c.group === 'primary');
  const secondaryInputs = colorInputs.filter(c => c.group === 'secondary');
  const textInputs = colorInputs.filter(c => c.group === 'text');
  const tagsInputs = colorInputs.filter(c => c.group === 'tags');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderColorGroup = (inputs: ColorInput[], title: string) => (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {inputs.map((colorInput, index) => (
        <div key={colorInput.id}>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{colorInput.label}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localColors[colorInput.id] || '#000000'}
                onChange={(e) => handleColorChange(colorInput.id, e.target.value)}
                className="w-9 h-7 rounded border cursor-pointer shrink-0"
              />
              <Input
                value={localColors[colorInput.id] || ''}
                onChange={(e) => handleColorChange(colorInput.id, e.target.value)}
                placeholder="#000000"
                className="flex-1 h-7 font-mono text-xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">{colorInput.description}</p>
          </div>
          {index < inputs.length - 1 && <div className="my-2" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Configure as cores dos botões e textos. Alterações são salvas automaticamente.
      </p>

      {/* Button Primary */}
      {renderColorGroup(primaryInputs, 'Botão Primário')}
      
      <Separator />
      
      {/* Button Secondary */}
      {renderColorGroup(secondaryInputs, 'Botão Secundário')}
      
      <Separator />
      
      {/* Text Colors */}
      {renderColorGroup(textInputs, 'Cores de Texto')}

      <Separator />
      
      {/* Tags Colors */}
      {renderColorGroup(tagsInputs, 'Cores das Tags Especiais')}

      <Separator />

      {/* Preview */}
      <div className="p-4 rounded-lg border space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
        
        {/* Buttons Preview with Hover */}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground">Passe o mouse para ver o hover</p>
          <div className="flex flex-wrap gap-2">
            <button 
              className="px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{ 
                backgroundColor: localColors.buttonPrimaryBg,
                color: localColors.buttonPrimaryText,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = localColors.buttonPrimaryHover || localColors.buttonPrimaryBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = localColors.buttonPrimaryBg}
            >
              Comprar
            </button>
            <button 
              className="px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{ 
                backgroundColor: localColors.buttonSecondaryBg,
                color: localColors.buttonSecondaryText,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = localColors.buttonSecondaryHover || localColors.buttonSecondaryBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = localColors.buttonSecondaryBg}
            >
              Cancelar
            </button>
          </div>
        </div>

        {/* Accent Color Preview */}
        <div className="flex items-center gap-3 p-3 bg-background rounded border">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ 
              backgroundColor: (localColors.accentColor || '#22c55e') + '20',
              color: localColors.accentColor || '#22c55e',
            }}
          >
            ✓
          </div>
          <div>
            <p className="text-sm font-medium">Cor de Destaque</p>
            <p className="text-xs text-muted-foreground">Checkmarks, ícones, indicadores</p>
          </div>
        </div>

        {/* Text Preview */}
        <div className="space-y-1 p-3 bg-background rounded border">
          <p className="font-medium" style={{ color: localColors.textPrimary }}>
            Título de exemplo
          </p>
          <p className="text-sm" style={{ color: localColors.textSecondary }}>
            Descrição secundária com texto auxiliar
          </p>
        </div>

        {/* Tags Preview */}
        <div className="flex flex-wrap gap-2">
          <span 
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ 
              backgroundColor: localColors.successBg,
              color: localColors.successText,
            }}
          >
            Frete Grátis
          </span>
          <span 
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ 
              backgroundColor: localColors.warningBg,
              color: localColors.warningText,
            }}
          >
            Mais Vendido
          </span>
          <span 
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ 
              backgroundColor: localColors.dangerBg,
              color: localColors.dangerText,
            }}
          >
            -37%
          </span>
          <span 
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ 
              backgroundColor: localColors.highlightBg,
              color: localColors.highlightText,
            }}
          >
            Novo
          </span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        {isSaving ? '💾 Salvando...' : '✓ Cores salvas automaticamente neste template'}
      </p>
    </div>
  );
}
