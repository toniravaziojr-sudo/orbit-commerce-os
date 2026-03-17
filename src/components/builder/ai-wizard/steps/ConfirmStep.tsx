// =============================================
// CONFIRM STEP — Summary of collected data before generation
// Phase 3.3: Shows mode, scope, creative style, and associations
// =============================================

import { WizardBlockContract, WizardStepConfig } from '@/lib/builder/aiWizardRegistry';
import { Badge } from '@/components/ui/badge';
import { Image as ImageIcon, Type, Layers } from 'lucide-react';
import type { BannerModeData } from './BannerModeStep';
import type { GenerationScope } from './ScopeSelectStep';
import type { CreativeStyleData } from './CreativeStyleStep';

interface ConfirmStepProps {
  contract: WizardBlockContract;
  collectedData: Record<string, unknown>;
  steps: WizardStepConfig[];
  blockType: string;
}

const STYLE_LABELS: Record<string, string> = {
  product_natural: 'Produto + Cenário',
  person_interacting: 'Pessoa + Produto',
  promotional: 'Promocional',
};

const OUTPUT_MODE_LABELS: Record<string, string> = {
  editable: 'Editável',
  complete: 'Criativo Completo',
};

const STEP_TYPE_LABELS: Record<string, string> = {
  'output-mode-select': 'Modo de imagem',
};

function summarizeStepData(step: WizardStepConfig, data: unknown): string {
  if (!data) return '—';

  switch (step.type) {
    case 'banner-mode-select': {
      const d = data as BannerModeData;
      const modeLabel = d.bannerMode === 'single' ? 'Banner Único' : `Carrossel (${d.slideCount} slides)`;
      const outputLabel = OUTPUT_MODE_LABELS[d.outputMode] || 'Editável';
      return `${modeLabel} · ${outputLabel}`;
    }
    case 'creative-style-select': {
      const d = data as CreativeStyleData;
      return STYLE_LABELS[d.creativeStyle] || d.creativeStyle;
    }
    case 'scope-select': {
      const scope = data as GenerationScope;
      if (scope === 'images') return 'Só imagens';
      if (scope === 'texts') return 'Só textos';
      return 'Imagens + textos';
    }
    case 'banner-association': {
      const assoc = data as { associationType: string; productName?: string; categoryName?: string; manualUrl?: string };
      if (assoc.associationType === 'product') return `Produto: ${assoc.productName || 'selecionado'}`;
      if (assoc.associationType === 'category') return `Categoria: ${assoc.categoryName || 'selecionada'}`;
      if (assoc.associationType === 'url') return `URL: ${assoc.manualUrl}`;
      return 'Nenhum (institucional)';
    }
    case 'quantity-select':
      return `${data}`;
    case 'briefing': {
      const text = data as string;
      return text.length > 50 ? `${text.substring(0, 50)}…` : text;
    }
    case 'source-select':
      return 'Configurado no bloco';
    default:
      return '—';
  }
}

export function ConfirmStep({ contract, collectedData, steps, blockType }: ConfirmStepProps) {
  const nonConfirmSteps = steps.filter((s) => s.type !== 'confirm');
  const scope = (collectedData.scope as GenerationScope) || 'all';
  const includeImages = scope === 'images' || scope === 'all';
  const includeTexts = scope === 'texts' || scope === 'all';
  const modeData = collectedData.bannerMode as BannerModeData | undefined;

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* Summary of choices */}
      <div className="space-y-2 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suas escolhas</p>
        {nonConfirmSteps.map((step) => (
          <div key={step.id} className="flex justify-between items-start gap-2 py-1.5 border-b border-muted/50 last:border-0 min-w-0">
            <span className="text-sm text-muted-foreground shrink-0 max-w-[40%]">{step.label}</span>
            <span className="text-sm font-medium text-right min-w-0 break-words">
              {summarizeStepData(step, collectedData[step.id])}
            </span>
          </div>
        ))}
      </div>

      {/* What AI will generate */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">O que a IA vai gerar</p>
        <div className="flex flex-wrap gap-1.5">
          {modeData?.bannerMode === 'carousel' && (
            <Badge variant="secondary" className="gap-1">
              <Layers className="h-3 w-3" />
              {modeData.slideCount} slides
            </Badge>
          )}
          {includeImages && (
            <Badge variant="secondary" className="gap-1">
              <ImageIcon className="h-3 w-3" />
              Imagens
            </Badge>
          )}
          {includeTexts && (
            <Badge variant="secondary" className="gap-1">
              <Type className="h-3 w-3" />
              Textos
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Clique em "Gerar com IA" para criar o conteúdo. O processo pode levar até 1 minuto.
      </p>
    </div>
  );
}
