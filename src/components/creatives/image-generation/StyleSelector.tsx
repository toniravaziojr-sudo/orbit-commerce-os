/**
 * Seletor de Estilo de Geração
 * Single-select entre 3 estilos
 */

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Package, User, Sparkles } from 'lucide-react';
import { ImageStyle, IMAGE_STYLE_CONFIG } from './types';

interface StyleSelectorProps {
  value: ImageStyle;
  onChange: (style: ImageStyle) => void;
  disabled?: boolean;
}

const STYLE_ICONS = {
  product_natural: Package,
  person_interacting: User,
  promotional: Sparkles,
};

export function StyleSelector({ value, onChange, disabled }: StyleSelectorProps) {
  const styles = Object.values(IMAGE_STYLE_CONFIG);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Estilo de Geração</Label>
      
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as ImageStyle)}
        disabled={disabled}
        className="grid gap-3"
      >
        {styles.map((style) => {
          const Icon = STYLE_ICONS[style.id];
          const isSelected = value === style.id;
          
          return (
            <label
              key={style.id}
              className={`
                flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                ${isSelected 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-muted-foreground/30'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <RadioGroupItem value={style.id} className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium text-sm">{style.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {style.description}
                </p>
              </div>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
