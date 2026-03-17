// =============================================
// WIZARD STEP RENDERER — Renders the right component for each step type
// Phase 1: Added creative-style-select step
// =============================================

import { WizardStepConfig, WizardBlockContract } from '@/lib/builder/aiWizardRegistry';
import { BannerAssociationStep } from './steps/BannerAssociationStep';
import { BannerModeStep } from './steps/BannerModeStep';
import { ScopeSelectStep } from './steps/ScopeSelectStep';
import { QuantitySelectStep } from './steps/QuantitySelectStep';
import { BriefingStep } from './steps/BriefingStep';
import { SourceSelectStep } from './steps/SourceSelectStep';
import { ConfirmStep } from './steps/ConfirmStep';
import { CreativeStyleStep } from './steps/CreativeStyleStep';
import { OutputModeStep } from './steps/OutputModeStep';

interface WizardStepRendererProps {
  step: WizardStepConfig;
  data: unknown;
  onChange: (data: unknown) => void;
  contract: WizardBlockContract;
  collectedData: Record<string, unknown>;
  allSteps: WizardStepConfig[];
  blockType: string;
  currentProps: Record<string, unknown>;
}

export function WizardStepRenderer({
  step,
  data,
  onChange,
  contract,
  collectedData,
  allSteps,
  blockType,
  currentProps,
}: WizardStepRendererProps) {
  switch (step.type) {
    case 'banner-mode-select':
      return (
        <BannerModeStep
          value={data as any}
          onChange={onChange}
        />
      );

    case 'creative-style-select':
      return (
        <CreativeStyleStep
          value={data as any}
          onChange={onChange}
        />
      );

    case 'output-mode-select':
      return (
        <OutputModeStep
          value={data as any}
          onChange={onChange}
        />
      );

    case 'scope-select':
      return (
        <ScopeSelectStep
          value={data as any}
          onChange={onChange}
          hasImages={contract.requiresImageGeneration}
          hasTexts={contract.hasTextGeneration !== false}
        />
      );

    case 'banner-association':
      return (
        <BannerAssociationStep
          value={data as any}
          onChange={onChange}
        />
      );

    case 'quantity-select':
      return (
        <QuantitySelectStep
          value={data as number | undefined}
          onChange={onChange}
          min={step.min}
          max={step.max}
          defaultValue={step.defaultValue}
        />
      );

    case 'briefing':
      return (
        <BriefingStep
          value={data as string | undefined}
          onChange={onChange}
          placeholder={step.placeholder}
          required={step.required}
        />
      );

    case 'source-select':
      return (
        <SourceSelectStep currentProps={currentProps} />
      );

    case 'confirm':
      return (
        <ConfirmStep
          contract={contract}
          collectedData={collectedData}
          steps={allSteps}
          blockType={blockType}
        />
      );

    default:
      return <p className="text-sm text-muted-foreground">Step não reconhecido</p>;
  }
}
