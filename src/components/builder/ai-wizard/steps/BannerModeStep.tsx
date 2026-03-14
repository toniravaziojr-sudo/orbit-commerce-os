// =============================================
// BANNER MODE STEP — User chooses single vs carousel + slide count
// Phase 3.3: Structure decision inside the wizard
// =============================================

import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface BannerModeData {
  bannerMode: 'single' | 'carousel';
  slideCount: number;
}

interface BannerModeStepProps {
  value?: BannerModeData;
  onChange: (data: BannerModeData) => void;
}

export function BannerModeStep({ value, onChange }: BannerModeStepProps) {
  const mode = value?.bannerMode || 'single';
  const slideCount = value?.slideCount || 2;

  // Set default value on mount so validation passes
  useEffect(() => {
    if (!value) {
      onChange({ bannerMode: 'single', slideCount: 1 });
    }
  }, []);

  const handleModeChange = (newMode: string) => {
    onChange({
      bannerMode: newMode as 'single' | 'carousel',
      slideCount: newMode === 'single' ? 1 : slideCount,
    });
  };

  const handleSlideCountChange = (count: string) => {
    onChange({
      bannerMode: 'carousel',
      slideCount: Number(count),
    });
  };

  return (
    <div className="space-y-4">
      <RadioGroup
        value={mode}
        onValueChange={handleModeChange}
        className="space-y-3"
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
        <div className="pt-1">
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
  );
}
