// =============================================
// CREATIVE STYLE STEP — User selects creative style + per-style config
// Phase 1: Reusable for all visual blocks
// Uses same enums as creative-image-generate module
// =============================================

import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, User, Sparkles } from 'lucide-react';

export type CreativeStyleType = 'product_natural' | 'person_interacting' | 'promotional';

export interface CreativeStyleData {
  creativeStyle: CreativeStyleType;
  styleConfig: Record<string, unknown>;
}

interface CreativeStyleStepProps {
  value?: CreativeStyleData;
  onChange: (data: CreativeStyleData) => void;
}

const STYLES = [
  {
    id: 'product_natural' as const,
    label: 'Produto + Cenário',
    description: 'Produto em cenário natural, sem pessoas',
    Icon: Package,
  },
  {
    id: 'person_interacting' as const,
    label: 'Pessoa + Produto',
    description: 'Pessoa segurando ou usando o produto',
    Icon: User,
  },
  {
    id: 'promotional' as const,
    label: 'Promocional',
    description: 'Visual de anúncio com efeitos e impacto',
    Icon: Sparkles,
  },
];

const ENVIRONMENTS = [
  { value: 'studio', label: 'Estúdio (fundo neutro)' },
  { value: 'bathroom', label: 'Banheiro' },
  { value: 'counter', label: 'Bancada/Pia' },
  { value: 'nature', label: 'Natureza' },
  { value: 'kitchen', label: 'Cozinha' },
  { value: 'bedroom', label: 'Quarto' },
  { value: 'office', label: 'Escritório' },
  { value: 'gym', label: 'Academia' },
];

const ACTIONS = [
  { value: 'holding', label: 'Segurando o produto' },
  { value: 'using', label: 'Usando/aplicando' },
  { value: 'showing', label: 'Mostrando para câmera' },
];

const TONES = [
  { value: 'lifestyle', label: 'Lifestyle editorial' },
  { value: 'ugc', label: 'UGC (caseiro)' },
  { value: 'demo', label: 'Demonstração' },
  { value: 'review', label: 'Review/Avaliação' },
];

const INTENSITIES = [
  { value: 'low', label: 'Sutil' },
  { value: 'medium', label: 'Moderado' },
  { value: 'high', label: 'Intenso' },
];

export function CreativeStyleStep({ value, onChange }: CreativeStyleStepProps) {
  const style = value?.creativeStyle || 'product_natural';
  const config = value?.styleConfig || {};

  useEffect(() => {
    if (!value) {
      onChange({
        creativeStyle: 'product_natural',
        styleConfig: { environment: 'studio', lighting: 'natural', mood: 'clean' },
      });
    }
  }, []);

  const handleStyleChange = (newStyle: string) => {
    const s = newStyle as CreativeStyleType;
    let defaultConfig: Record<string, unknown> = {};
    if (s === 'product_natural') defaultConfig = { environment: 'studio', lighting: 'natural', mood: 'clean' };
    if (s === 'person_interacting') defaultConfig = { action: 'holding', tone: 'lifestyle' };
    if (s === 'promotional') defaultConfig = { effectsIntensity: 'medium' };
    onChange({ creativeStyle: s, styleConfig: defaultConfig });
  };

  const updateConfig = (key: string, val: unknown) => {
    onChange({ creativeStyle: style, styleConfig: { ...config, [key]: val } });
  };

  return (
    <div className="space-y-4">
      <RadioGroup value={style} onValueChange={handleStyleChange} className="space-y-2">
        {STYLES.map((s) => (
          <div
            key={s.id}
            className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
          >
            <RadioGroupItem value={s.id} id={`style-${s.id}`} className="mt-0.5" />
            <s.Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <Label htmlFor={`style-${s.id}`} className="text-sm font-medium cursor-pointer">
                {s.label}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>

      {/* Per-style config */}
      {style === 'product_natural' && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <Label className="text-xs mb-1.5 block">Ambiente</Label>
            <Select value={(config.environment as string) || 'studio'} onValueChange={(v) => updateConfig('environment', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENVIRONMENTS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {style === 'person_interacting' && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <Label className="text-xs mb-1.5 block">Ação</Label>
            <Select value={(config.action as string) || 'holding'} onValueChange={(v) => updateConfig('action', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Tom visual</Label>
            <Select value={(config.tone as string) || 'lifestyle'} onValueChange={(v) => updateConfig('tone', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {style === 'promotional' && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <Label className="text-xs mb-1.5 block">Intensidade dos efeitos</Label>
            <Select value={(config.effectsIntensity as string) || 'medium'} onValueChange={(v) => updateConfig('effectsIntensity', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTENSITIES.map((i) => (
                  <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
