// =============================================
// BRIEFING STEP — User describes the theme/goal
// =============================================

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface BriefingStepProps {
  value?: string;
  onChange: (text: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function BriefingStep({
  value = '',
  onChange,
  placeholder = 'Descreva o que deseja...',
  required = false,
}: BriefingStepProps) {
  return (
    <div className="space-y-2">
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
  );
}
