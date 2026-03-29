// =============================================
// BRIEFING STEP — User describes the theme/goal
// v4.3.0: Added optional layoutPreset selector for Banner
// =============================================

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BriefingStepProps {
  value?: string;
  onChange: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  /** If provided, show a layout/proportion selector for Banner */
  showLayoutPreset?: boolean;
  layoutPreset?: string;
  onLayoutPresetChange?: (preset: string) => void;
}

export function BriefingStep({
  value = '',
  onChange,
  placeholder = 'Descreva o que deseja...',
  required = false,
  showLayoutPreset = false,
  layoutPreset = 'standard',
  onLayoutPresetChange,
}: BriefingStepProps) {
  return (
    <div className="space-y-3">
      {showLayoutPreset && onLayoutPresetChange && (
        <div className="space-y-1.5">
          <Label className="text-sm">Proporção do Banner</Label>
          <Select value={layoutPreset} onValueChange={onLayoutPresetChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[220px]">
              <SelectItem value="standard" className="text-xs py-2">
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">Padrão</span>
                  <span className="text-[10px] opacity-70">1920×800 (12:5) — largura total</span>
                </div>
              </SelectItem>
              <SelectItem value="compact-centered" className="text-xs py-2">
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">Compacto centralizado</span>
                  <span className="text-[10px] opacity-70">1200×400 — contido, altura reduzida</span>
                </div>
              </SelectItem>
              <SelectItem value="compact-full" className="text-xs py-2">
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">Compacto cheio</span>
                  <span className="text-[10px] opacity-70">1920×400 — largura total, altura reduzida</span>
                </div>
              </SelectItem>
              <SelectItem value="large" className="text-xs py-2">
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">Grande</span>
                  <span className="text-[10px] opacity-70">1920×1080 (16:9) — tela cheia</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm">
          Briefing {required && <span className="text-destructive">*</span>}
        </Label>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Descreva o tema, objetivo ou contexto para a IA gerar conteúdo adequado.
        </p>
      </div>
    </div>
  );
}