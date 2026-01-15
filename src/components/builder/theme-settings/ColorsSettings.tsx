// =============================================
// COLORS SETTINGS - Theme color palette for buttons and text
// =============================================

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ColorsSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

interface ThemeColors {
  // Primary button
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonPrimaryHover: string;
  // Secondary button
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  buttonSecondaryHover: string;
  // Text colors
  textPrimary: string;
  textSecondary: string;
}

const defaultColors: ThemeColors = {
  buttonPrimaryBg: '#3b82f6',
  buttonPrimaryText: '#ffffff',
  buttonPrimaryHover: '#2563eb',
  buttonSecondaryBg: '#f1f5f9',
  buttonSecondaryText: '#1e293b',
  buttonSecondaryHover: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
};

interface ColorInput {
  id: keyof ThemeColors;
  label: string;
  description: string;
  group: 'primary' | 'secondary' | 'text';
}

const colorInputs: ColorInput[] = [
  // Primary button group
  { id: 'buttonPrimaryBg', label: 'Fundo do Botão Primário', description: 'Cor de fundo dos botões principais (Comprar, Adicionar ao carrinho)', group: 'primary' },
  { id: 'buttonPrimaryText', label: 'Texto do Botão Primário', description: 'Cor do texto nos botões principais', group: 'primary' },
  { id: 'buttonPrimaryHover', label: 'Hover do Botão Primário', description: 'Cor ao passar o mouse sobre botões principais', group: 'primary' },
  // Secondary button group
  { id: 'buttonSecondaryBg', label: 'Fundo do Botão Secundário', description: 'Cor de fundo dos botões secundários (Cancelar, Voltar)', group: 'secondary' },
  { id: 'buttonSecondaryText', label: 'Texto do Botão Secundário', description: 'Cor do texto nos botões secundários', group: 'secondary' },
  { id: 'buttonSecondaryHover', label: 'Hover do Botão Secundário', description: 'Cor ao passar o mouse sobre botões secundários', group: 'secondary' },
  // Text colors
  { id: 'textPrimary', label: 'Texto Primário', description: 'Cor principal para títulos e textos importantes', group: 'text' },
  { id: 'textSecondary', label: 'Texto Secundário', description: 'Cor para descrições e textos auxiliares', group: 'text' },
];

export function ColorsSettings({ tenantId, templateSetId }: ColorsSettingsProps) {
  const queryClient = useQueryClient();
  const [colors, setColors] = useState<ThemeColors>(defaultColors);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch colors from template set
  const { data: savedColors, isLoading } = useQuery({
    queryKey: ['template-colors', templateSetId],
    queryFn: async () => {
      if (!templateSetId) return null;
      
      const { data, error } = await supabase
        .from('storefront_template_sets')
        .select('draft_content')
        .eq('id', templateSetId)
        .single();
      
      if (error) throw error;
      
      // Extract theme colors from draft_content
      const draftContent = data?.draft_content as Record<string, any> | null;
      return draftContent?.themeColors as ThemeColors | undefined;
    },
    enabled: !!templateSetId,
  });

  // Load saved colors when data is available
  useEffect(() => {
    if (savedColors) {
      setColors(prev => ({ ...defaultColors, ...savedColors }));
    }
  }, [savedColors]);

  // Save colors mutation
  const saveMutation = useMutation({
    mutationFn: async (newColors: ThemeColors) => {
      if (!templateSetId) throw new Error('Template set ID is required');

      // Get current draft content
      const { data: current, error: fetchError } = await supabase
        .from('storefront_template_sets')
        .select('draft_content')
        .eq('id', templateSetId)
        .single();

      if (fetchError) throw fetchError;

      const draftContent = (current?.draft_content as Record<string, any>) || {};

      // Update with new theme colors
      const updatedContent: Record<string, unknown> = {
        ...draftContent,
        themeColors: { ...newColors },
      };

      const { error: updateError } = await supabase
        .from('storefront_template_sets')
        .update({ 
          draft_content: updatedContent as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateSetId);

      if (updateError) throw updateError;

      return newColors;
    },
    onSuccess: () => {
      setHasChanges(false);
      toast.success('Cores salvas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['template-colors', templateSetId] });
      queryClient.invalidateQueries({ queryKey: ['template-set-content', templateSetId] });
    },
    onError: (error) => {
      toast.error(`Erro ao salvar cores: ${error.message}`);
    },
  });

  const handleColorChange = (id: keyof ThemeColors, value: string) => {
    setColors(prev => ({ ...prev, [id]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(colors);
  };

  const handleReset = () => {
    setColors(defaultColors);
    setHasChanges(true);
  };

  const primaryInputs = colorInputs.filter(c => c.group === 'primary');
  const secondaryInputs = colorInputs.filter(c => c.group === 'secondary');
  const textInputs = colorInputs.filter(c => c.group === 'text');

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
                value={colors[colorInput.id]}
                onChange={(e) => handleColorChange(colorInput.id, e.target.value)}
                className="w-9 h-7 rounded border cursor-pointer shrink-0"
              />
              <Input
                value={colors[colorInput.id]}
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
        Configure as cores dos botões e textos padrão do tema. Essas cores serão aplicadas em blocos/seções que não têm personalização própria.
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

      {/* Preview */}
      <div className="p-4 rounded-lg border space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
        
        {/* Buttons Preview */}
        <div className="flex flex-wrap gap-2">
          <button 
            className="px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{ 
              backgroundColor: colors.buttonPrimaryBg,
              color: colors.buttonPrimaryText,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonPrimaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.buttonPrimaryBg}
          >
            Comprar
          </button>
          <button 
            className="px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{ 
              backgroundColor: colors.buttonSecondaryBg,
              color: colors.buttonSecondaryText,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonSecondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.buttonSecondaryBg}
          >
            Cancelar
          </button>
        </div>

        {/* Text Preview */}
        <div className="space-y-1 p-3 bg-background rounded border">
          <p className="font-medium" style={{ color: colors.textPrimary }}>
            Título de exemplo
          </p>
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            Descrição secundária com texto auxiliar
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || saveMutation.isPending}
          size="sm"
          className="flex-1"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : hasChanges ? null : (
            <Check className="h-4 w-4 mr-2" />
          )}
          {saveMutation.isPending ? 'Salvando...' : hasChanges ? 'Salvar Cores' : 'Salvo'}
        </Button>
        <Button 
          onClick={handleReset}
          variant="outline"
          size="sm"
          disabled={saveMutation.isPending}
        >
          Restaurar
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        As cores são salvas no rascunho do template e serão publicadas junto com o tema.
      </p>
    </div>
  );
}
