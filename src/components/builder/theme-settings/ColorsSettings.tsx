// =============================================
// COLORS SETTINGS - Theme color palette (Phase 3: Reorganized UI)
// Uses centralized useThemeSettings hook (template-wide)
// IMPORTANT: Colors update DRAFT state for real-time preview
// Changes are NOT saved until user clicks "Salvar" in toolbar
//
// Groups:
//   1. Cores Globais — textos, preço, destaque (aplicam em toda a loja)
//   2. Botões e Estados — primário, secundário, WhatsApp + hover
//   3. Tags e Badges — sucesso, destaque, desconto, info
//
// NOTE: Header/Footer/NoticeBar colors are configured in their
// own zone panels. Cart/Checkout overrides are in Páginas settings.
// This panel manages ONLY the global theme palette.
// =============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { useThemeColors, DEFAULT_THEME_COLORS, ThemeColors } from '@/hooks/useThemeSettings';
import { useBuilderDraftTheme } from '@/hooks/useBuilderDraftTheme';
import { useBuilderStore } from '@/hooks/useBuilderStore';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ColorsSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

interface ColorInput {
  id: keyof ThemeColors;
  label: string;
  description: string;
}

// ── Group definitions ──

const globalColorInputs: ColorInput[] = [
  { id: 'textPrimary', label: 'Texto Principal', description: 'Títulos, nomes de produtos e textos de destaque' },
  { id: 'textSecondary', label: 'Texto Secundário', description: 'Descrições, legendas, informações de frete e textos auxiliares' },
  { id: 'priceColor', label: 'Valor com Desconto', description: 'Cor exclusiva do preço final (com desconto). Aplicado em grids, categorias, página do produto' },
  { id: 'accentColor', label: 'Cor de Destaque', description: 'Ícones de check, setas, indicadores de etapas, links, "Grátis" e detalhes da interface' },
];

const primaryButtonInputs: ColorInput[] = [
  { id: 'buttonPrimaryBg', label: 'Fundo', description: '"Comprar agora", "Adicionar ao carrinho", "Finalizar pedido"' },
  { id: 'buttonPrimaryText', label: 'Texto', description: 'Texto dentro dos botões primários. Use cor clara para fundos escuros' },
  { id: 'buttonPrimaryHover', label: 'Hover', description: 'Cor de fundo ao passar o mouse' },
];

const secondaryButtonInputs: ColorInput[] = [
  { id: 'buttonSecondaryBg', label: 'Fundo', description: '"Cancelar", "Voltar", "Ver detalhes" e ações secundárias' },
  { id: 'buttonSecondaryText', label: 'Texto', description: 'Texto dentro dos botões secundários' },
  { id: 'buttonSecondaryHover', label: 'Hover', description: 'Cor de fundo ao passar o mouse' },
];

const whatsappInputs: ColorInput[] = [
  { id: 'whatsappColor', label: 'Cor Principal', description: 'Cor da borda e texto do botão "Comprar pelo WhatsApp"' },
  { id: 'whatsappHover', label: 'Hover', description: 'Cor de fundo ao passar o mouse sobre o botão WhatsApp' },
];

const tagsInputs: ColorInput[] = [
  { id: 'successBg', label: 'Fundo — Sucesso', description: 'Tags "Grátis", "Frete Grátis", "5% OFF", indicadores positivos' },
  { id: 'successText', label: 'Texto — Sucesso', description: 'Texto dentro das tags de sucesso' },
  { id: 'warningBg', label: 'Fundo — Destaque', description: 'Tags "Mais Vendido", "Novo", "Promoção"' },
  { id: 'warningText', label: 'Texto — Destaque', description: 'Texto dentro das tags de destaque' },
  { id: 'dangerBg', label: 'Fundo — Desconto/Alerta', description: 'Tags "-37%", "Últimas unidades", alertas' },
  { id: 'dangerText', label: 'Texto — Desconto/Alerta', description: 'Texto dentro das tags de desconto/alerta' },
  { id: 'highlightBg', label: 'Fundo — Info', description: 'Tags informativas, badges de categoria' },
  { id: 'highlightText', label: 'Texto — Info', description: 'Texto dentro das tags informativas' },
];

// ── Component ──

export function ColorsSettings({ tenantId, templateSetId }: ColorsSettingsProps) {
  const { colors: savedColors, isLoading } = useThemeColors(tenantId, templateSetId);
  const draftTheme = useBuilderDraftTheme();
  const [localColors, setLocalColors] = useState<ThemeColors>(DEFAULT_THEME_COLORS);
  const [hasChanges, setHasChanges] = useState(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (savedColors && !initialLoadDone.current) {
      const effectiveColors = draftTheme?.draftColors || savedColors;
      setLocalColors(effectiveColors);
      initialLoadDone.current = true;
      if (draftTheme?.draftColors) {
        setHasChanges(true);
      }
    }
  }, [savedColors, draftTheme?.draftColors]);

  const handleColorChange = (id: keyof ThemeColors, value: string) => {
    const updated = { ...localColors, [id]: value };
    setLocalColors(updated);
    setHasChanges(true);
    if (draftTheme) {
      draftTheme.setDraftColors(updated);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderColorFields = (inputs: ColorInput[]) => (
    <div className="space-y-3">
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
    <div className="space-y-3">
      {/* Pending changes notice */}
      {hasChanges && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Alterações pendentes. Clique em <strong>Salvar</strong> na barra superior para aplicar.</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Cores globais da loja — aplicadas em todas as páginas. Header, Footer e páginas específicas (Carrinho/Checkout) possuem overrides próprios nos seus painéis.
      </p>

      <Accordion type="multiple" defaultValue={['global', 'buttons']} className="w-full">
        {/* ── 1. Cores Globais ── */}
        <AccordionItem value="global">
          <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
            📝 Cores Globais
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-[10px] text-muted-foreground mb-3">
              Textos, preço e destaque — valem para toda a loja, a menos que uma zona ou página sobrescreva.
            </p>
            {renderColorFields(globalColorInputs)}
          </AccordionContent>
        </AccordionItem>

        {/* ── 2. Botões e Estados ── */}
        <AccordionItem value="buttons">
          <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
            🔵 Botões e Estados
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <p className="text-[10px] text-muted-foreground">
              Cores dos botões globais — Carrinho e Checkout podem sobrescrever em seus painéis.
            </p>

            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primário</h5>
              {renderColorFields(primaryButtonInputs)}
            </div>

            <Separator />

            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Secundário</h5>
              {renderColorFields(secondaryButtonInputs)}
            </div>

            <Separator />

            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp</h5>
              {renderColorFields(whatsappInputs)}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── 3. Tags e Badges ── */}
        <AccordionItem value="tags">
          <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
            🏷️ Tags e Badges
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-[10px] text-muted-foreground mb-3">
              Cores das etiquetas de produtos — desconto, frete grátis, destaque, etc. Aplicadas globalmente.
            </p>
            {renderColorFields(tagsInputs)}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Separator />

      {/* ── Preview ── */}
      <div className="p-4 rounded-lg border space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
        
        {/* Buttons Preview */}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground">Passe o mouse para ver o hover</p>
          <div className="flex flex-wrap gap-2">
            <button 
              className="px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{ backgroundColor: localColors.buttonPrimaryBg, color: localColors.buttonPrimaryText }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = localColors.buttonPrimaryHover || localColors.buttonPrimaryBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = localColors.buttonPrimaryBg}
            >
              Comprar
            </button>
            <button 
              className="px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{ backgroundColor: localColors.buttonSecondaryBg, color: localColors.buttonSecondaryText }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = localColors.buttonSecondaryHover || localColors.buttonSecondaryBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = localColors.buttonSecondaryBg}
            >
              Cancelar
            </button>
            <button 
              className="px-4 py-2 rounded text-sm font-medium transition-all border-2"
              style={{ 
                backgroundColor: 'transparent',
                color: localColors.whatsappColor || '#25D366',
                borderColor: localColors.whatsappColor || '#25D366',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = localColors.whatsappHover || '#128C7E';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = localColors.whatsappHover || '#128C7E';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = localColors.whatsappColor || '#25D366';
                e.currentTarget.style.borderColor = localColors.whatsappColor || '#25D366';
              }}
            >
              WhatsApp
            </button>
          </div>
        </div>

        {/* Accent */}
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

        {/* Text & Price */}
        <div className="space-y-1 p-3 bg-background rounded border">
          <p className="font-medium" style={{ color: localColors.textPrimary }}>Título de exemplo</p>
          <p className="text-sm" style={{ color: localColors.textSecondary }}>Descrição secundária com texto auxiliar</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs line-through" style={{ color: localColors.textSecondary }}>R$ 199,90</span>
            <span className="text-sm font-bold" style={{ color: localColors.priceColor || localColors.textPrimary }}>R$ 149,90</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: localColors.successBg, color: localColors.successText }}>Frete Grátis</span>
          <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: localColors.warningBg, color: localColors.warningText }}>Mais Vendido</span>
          <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: localColors.dangerBg, color: localColors.dangerText }}>-37%</span>
          <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: localColors.highlightBg, color: localColors.highlightText }}>Novo</span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        {hasChanges ? '⚠️ Alterações pendentes - clique em Salvar na barra superior' : '✓ Cores sincronizadas com o tema'}
      </p>
    </div>
  );
}