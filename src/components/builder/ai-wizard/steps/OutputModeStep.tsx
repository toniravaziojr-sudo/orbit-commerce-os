// =============================================
// OUTPUT MODE STEP — User chooses editable vs complete creative (for per-slide wizard)
// Stores data as BannerModeData with bannerMode='single' for backend compatibility
// =============================================

import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Image, Layers } from 'lucide-react';
import type { BannerModeData } from './BannerModeStep';

interface OutputModeStepProps {
  value?: BannerModeData;
  onChange: (data: BannerModeData) => void;
}

export function OutputModeStep({ value, onChange }: OutputModeStepProps) {
  const outputMode = value?.outputMode || 'editable';

  useEffect(() => {
    if (!value) {
      onChange({ bannerMode: 'single', slideCount: 1, outputMode: 'editable' });
    }
  }, []);

  const handleOutputModeChange = (newOutputMode: string) => {
    onChange({
      bannerMode: 'single',
      slideCount: 1,
      outputMode: newOutputMode as 'editable' | 'complete',
    });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Modo de imagem</Label>
      <RadioGroup
        value={outputMode}
        onValueChange={handleOutputModeChange}
        className="space-y-2"
      >
        <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
          <RadioGroupItem value="editable" id="slide-output-editable" className="mt-0.5" />
          <Image className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <Label htmlFor="slide-output-editable" className="text-sm font-medium cursor-pointer">
              Editável
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Imagem de fundo + textos por cima (título, subtítulo, botão)
            </p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
          <RadioGroupItem value="complete" id="slide-output-complete" className="mt-0.5" />
          <Layers className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <Label htmlFor="slide-output-complete" className="text-sm font-medium cursor-pointer">
              Criativo Completo
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Peça publicitária pronta — a IA gera a imagem final sem textos sobrepostos
            </p>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
