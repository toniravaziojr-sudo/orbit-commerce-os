// =============================================
// AI FILL WIZARD DIALOG — Multi-step modal for guided AI content generation
// Phase 3.1: Infrastructure only (generation not yet wired)
// =============================================

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WizardBlockContract } from '@/lib/builder/aiWizardRegistry';
import { useAIBlockWizard } from '@/hooks/useAIBlockWizard';
import { WizardStepRenderer } from './WizardStepRenderer';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface AIFillWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: WizardBlockContract;
  blockType: string;
  blockLabel: string;
  currentProps: Record<string, unknown>;
}

export function AIFillWizardDialog({
  open,
  onOpenChange,
  contract,
  blockType,
  blockLabel,
  currentProps,
}: AIFillWizardDialogProps) {
  const wizard = useAIBlockWizard({
    contract,
    blockType,
    currentProps,
  });

  const handleClose = () => {
    wizard.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            IA — {blockLabel}
          </DialogTitle>
          <DialogDescription>
            Passo {wizard.currentStepIndex + 1} de {wizard.totalSteps}
          </DialogDescription>
        </DialogHeader>

        {/* Step label */}
        <div className="pb-1">
          <p className="text-sm font-medium">{wizard.currentStep.label}</p>
        </div>

        {/* Step content */}
        <div className="min-h-[160px]">
          <WizardStepRenderer
            step={wizard.currentStep}
            data={wizard.getStepData(wizard.currentStep.id)}
            onChange={(data) => wizard.setStepData(wizard.currentStep.id, data)}
            contract={contract}
            collectedData={wizard.collectedData}
            allSteps={wizard.steps}
            blockType={blockType}
            currentProps={currentProps}
          />
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {wizard.steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= wizard.currentStepIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={wizard.canGoBack ? wizard.goBack : handleClose}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {wizard.canGoBack ? 'Voltar' : 'Cancelar'}
          </Button>

          {wizard.isConfirmStep ? (
            <Button
              size="sm"
              disabled
              className="gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Em breve
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={wizard.goNext}
              disabled={!wizard.canGoNext}
              className="gap-1"
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
