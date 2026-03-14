// =============================================
// CONFIRM STEP — Summary of collected data before generation
// Phase 3.2: Placeholder removed, ready for real generation
// =============================================

import { WizardBlockContract, WizardStepConfig } from '@/lib/builder/aiWizardRegistry';
import { Badge } from '@/components/ui/badge';
import { Image as ImageIcon, Type } from 'lucide-react';

interface ConfirmStepProps {
  contract: WizardBlockContract;
  collectedData: Record<string, unknown>;
  steps: WizardStepConfig[];
  blockType: string;
}

function summarizeStepData(step: WizardStepConfig, data: unknown): string {
  if (!data) return '—';

  switch (step.type) {
    case 'banner-association': {
      const assoc = data as { associationType: string; productName?: string; categoryName?: string; manualUrl?: string };
      if (assoc.associationType === 'product') return `Produto: ${assoc.productName || assoc.associationType}`;
      if (assoc.associationType === 'category') return `Categoria: ${assoc.categoryName || assoc.associationType}`;
      if (assoc.associationType === 'url') return `URL: ${assoc.manualUrl}`;
      return 'Nenhum (institucional)';
    }
    case 'quantity-select':
      return `${data}`;
    case 'briefing': {
      const text = data as string;
      return text.length > 60 ? `${text.substring(0, 60)}...` : text;
    }
    case 'source-select':
      return 'Configurado no bloco';
    default:
      return '—';
  }
}

export function ConfirmStep({ contract, collectedData, steps, blockType }: ConfirmStepProps) {
  const nonConfirmSteps = steps.filter((s) => s.type !== 'confirm');
  const textProps = contract.aiGenerates.filter(
    (p) => !contract.imageSpecs?.some((spec) => spec.key === p)
  );
  const hasImages = contract.requiresImageGeneration;

  return (
    <div className="space-y-4">
      {/* Summary of choices */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suas escolhas</p>
        {nonConfirmSteps.map((step) => (
          <div key={step.id} className="flex justify-between items-center py-1.5 border-b border-muted/50 last:border-0">
            <span className="text-sm text-muted-foreground">{step.label}</span>
            <span className="text-sm font-medium text-right max-w-[60%] truncate">
              {summarizeStepData(step, collectedData[step.id])}
            </span>
          </div>
        ))}
      </div>

      {/* What AI will generate */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">O que a IA vai gerar</p>
        <div className="flex flex-wrap gap-1.5">
          {hasImages && (
            <Badge variant="secondary" className="gap-1">
              <ImageIcon className="h-3 w-3" />
              Imagens
            </Badge>
          )}
          {textProps.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Type className="h-3 w-3" />
              Textos
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Clique em "Gerar com IA" para criar as imagens e textos. O processo pode levar até 1 minuto.
      </p>
    </div>
  );
}
