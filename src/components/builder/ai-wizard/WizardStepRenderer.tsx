// =============================================
// WIZARD STEP RENDERER — Renders the right component for each step type
// =============================================

import { WizardStepConfig } from '@/lib/builder/aiWizardRegistry';
import { BannerAssociationStep } from './steps/BannerAssociationStep';
import { QuantitySelectStep } from './steps/QuantitySelectStep';
import { BriefingStep } from './steps/BriefingStep';
import { SourceSelectStep } from './steps/SourceSelectStep';
import { ConfirmStep } from './steps/ConfirmStep';
import { WizardBlockContract } from '@/lib/builder/aiWizardRegistry';

interface WizardStepRendererProps {
  step: WizardStepConfig;
  data: unknown;
  onChange: (data: unknown) => void;
  /** Full contract for confirm step */
  contract: WizardBlockContract;
  /** All collected data for confirm step */
  collectedData: Record<string, unknown>;
  /** All steps for confirm step */
  allSteps: WizardStepConfig[];
  /** Block type for confirm step */
  blockType: string;
  /** Current block props (for source-select validation) */
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
