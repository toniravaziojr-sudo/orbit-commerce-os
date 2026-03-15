// =============================================
// BANNER MODE STEP — User chooses single vs carousel + slide count + output mode
// Phase 1: Added outputMode selection (editable vs complete)
// =============================================

import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image, Layers } from 'lucide-react';

export interface BannerModeData {
  bannerMode: 'single' | 'carousel';
  slideCount: number;
  /** Output mode: editable (for HTML overlay) or complete (finished piece) */
  outputMode: 'editable' | 'complete';
}

interface BannerModeStepProps {
  value?: BannerModeData;
  onChange: (data: BannerModeData) => void;
}

export function BannerModeStep({ value, onChange }: BannerModeStepProps) {
  const mode = value?.bannerMode || 'single';
  const slideCount = value?.slideCount || 2;
  const outputMode = value?.outputMode || 'editable';

  useEffect(() => {
    if (!value) {
      onChange({ bannerMode: 'single', slideCount: 1, outputMode: 'editable' });
    }
  }, []);

  const handleModeChange = (newMode: string) => {
    onChange({
      bannerMode: newMode as 'single' | 'carousel',
      slideCount: newMode === 'single' ? 1 : slideCount,
      outputMode,
    });
  };

  const handleSlideCountChange = (count: string) => {
    onChange({
      bannerMode: 'carousel',
      slideCount: Number(count),
      outputMode,
    });
  };

  const handleOutputModeChange = (newOutputMode: string) => {
    onChange({
      bannerMode: mode,
      slideCount,
      outputMode: newOutputMode as 'editable' | 'complete',
    });
  };

  return (
    <div className="space-y-5">
      {/* Banner type selection */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Formato</Label>
        <RadioGroup
          value={mode}
          onValueChange={handleModeChange}
          className="space-y-2"
        >
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <RadioGroupItem value="single" id="mode-single" className="mt-0.5" />
            <div>
              <Label htmlFor="mode-single" className="text-sm font-medium cursor-pointer">
                Banner Único
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Uma única imagem de destaque
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <RadioGroupItem value="carousel" id="mode-carousel" className="mt-0.5" />
            <div>
              <Label htmlFor="mode-carousel" className="text-sm font-medium cursor-pointer">
                Carrossel
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Múltiplos slides rotativos (até 3)
              </p>
            </div>
          </div>
        </RadioGroup>

        {mode === 'carousel' && (
          <div className="pt-1 pl-6">
            <Label className="text-sm mb-1.5 block">Quantos slides?</Label>
            <Select
              value={String(slideCount)}
              onValueChange={handleSlideCountChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 slides</SelectItem>
                <SelectItem value="3">3 slides</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Output mode selection */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Modo de imagem</Label>
        <RadioGroup
          value={outputMode}
          onValueChange={handleOutputModeChange}
          className="space-y-2"
        >
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <RadioGroupItem value="editable" id="output-editable" className="mt-0.5" />
            <Image className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <Label htmlFor="output-editable" className="text-sm font-medium cursor-pointer">
                Editável
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Imagem de fundo + textos por cima (título, subtítulo, botão)
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <RadioGroupItem value="complete" id="output-complete" className="mt-0.5" />
            <Layers className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <Label htmlFor="output-complete" className="text-sm font-medium cursor-pointer">
                Criativo Completo
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Peça publicitária pronta — a IA gera a imagem final sem textos sobrepostos
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
