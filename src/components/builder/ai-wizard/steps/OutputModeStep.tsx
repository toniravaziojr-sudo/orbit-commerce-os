// =============================================
// OUTPUT MODE STEP — User chooses editable vs complete creative
// v4.4.0: Used in Banner simplified wizard for image mode selection
// Stores data as BannerModeData with bannerMode='single' for backend compatibility
// =============================================

import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Image, Sparkles } from 'lucide-react';
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
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo de criativo</Label>
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
              Imagem de fundo limpa, sem texto integrado. Ideal para adicionar título, subtítulo e botão por cima.
            </p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
          <RadioGroupItem value="complete" id="slide-output-complete" className="mt-0.5" />
          <Sparkles className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <Label htmlFor="slide-output-complete" className="text-sm font-medium cursor-pointer">
              100% Criativo
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              A IA cria a peça completa — pode incluir textos, headlines e copy diretamente na imagem.
            </p>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
