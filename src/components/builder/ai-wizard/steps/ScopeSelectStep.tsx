// =============================================
// SCOPE SELECT STEP — User chooses what to generate (images/texts/both)
// Phase 3.3: Scope decision inside the wizard
// =============================================

import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Image as ImageIcon, Type } from 'lucide-react';

export type GenerationScope = 'images' | 'texts' | 'all';

interface ScopeSelectStepProps {
  value?: GenerationScope;
  onChange: (scope: GenerationScope) => void;
  /** Whether images are available for this block */
  hasImages?: boolean;
  /** Whether texts are available for this block */
  hasTexts?: boolean;
}

export function ScopeSelectStep({
  value,
  onChange,
  hasImages = true,
  hasTexts = true,
}: ScopeSelectStepProps) {
  // Set initial value on mount so validation passes immediately
  useEffect(() => {
    if (value === undefined) {
      onChange('all');
    }
  }, []);

  const effectiveValue = value || 'all';
  const imagesChecked = effectiveValue === 'images' || effectiveValue === 'all';
  const textsChecked = effectiveValue === 'texts' || effectiveValue === 'all';

  const handleToggle = (type: 'images' | 'texts', checked: boolean) => {
    if (type === 'images') {
      if (checked && textsChecked) onChange('all');
      else if (checked) onChange('images');
      else if (textsChecked) onChange('texts');
      // Can't uncheck both — keep at least one
      else onChange('images');
    } else {
      if (checked && imagesChecked) onChange('all');
      else if (checked) onChange('texts');
      else if (imagesChecked) onChange('images');
      else onChange('texts');
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm">O que deseja gerar?</Label>
      <div className="space-y-2">
        {hasImages && (
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <Checkbox
              checked={imagesChecked}
              onCheckedChange={(checked) => handleToggle('images', !!checked)}
            />
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-sm font-medium">Imagens</span>
              <p className="text-xs text-muted-foreground">Banner desktop e mobile</p>
            </div>
          </label>
        )}
        {hasTexts && (
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
            <Checkbox
              checked={textsChecked}
              onCheckedChange={(checked) => handleToggle('texts', !!checked)}
            />
            <Type className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-sm font-medium">Textos</span>
              <p className="text-xs text-muted-foreground">Título, subtítulo e botão</p>
            </div>
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Selecione pelo menos uma opção. A IA só vai gerar o que você escolher.
      </p>
    </div>
  );
}
