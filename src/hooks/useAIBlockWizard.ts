// =============================================
// useAIBlockWizard — Hook para gerenciar estado do wizard de IA
// Fase 3.1: Navegação de steps e coleta de dados
// =============================================

import { useState, useCallback, useMemo } from 'react';
import {
  WizardBlockContract,
  WizardStepConfig,
  BannerAssociationPayload,
  WizardCollectedData,
} from '@/lib/builder/aiWizardRegistry';

interface UseAIBlockWizardParams {
  contract: WizardBlockContract;
  blockType: string;
  currentProps: Record<string, unknown>;
}

interface UseAIBlockWizardReturn {
  /** Current step index */
  currentStepIndex: number;
  /** Current step config */
  currentStep: WizardStepConfig;
  /** All steps (expanded for per-slide steps) */
  steps: WizardStepConfig[];
  /** Total step count */
  totalSteps: number;
  /** Collected data so far */
  collectedData: Record<string, unknown>;
  /** Whether user can go to next step */
  canGoNext: boolean;
  /** Whether user can go back */
  canGoBack: boolean;
  /** Whether we're on the confirm step */
  isConfirmStep: boolean;
  /** Go to next step */
  goNext: () => void;
  /** Go to previous step */
  goBack: () => void;
  /** Set data for a specific step */
  setStepData: (stepId: string, data: unknown) => void;
  /** Get data for a step */
  getStepData: (stepId: string) => unknown;
  /** Reset wizard */
  reset: () => void;
}

/**
 * Expands steps that are perSlide into N repeated steps based on slideCount.
 * In Phase 3.1, we resolve this dynamically as the user picks slideCount.
 */
function expandSteps(
  baseSteps: WizardStepConfig[],
  collectedData: Record<string, unknown>
): WizardStepConfig[] {
  const expanded: WizardStepConfig[] = [];

  for (const step of baseSteps) {
    if (step.perSlide) {
      const slideCount = (collectedData['slideCount'] as number) || 1;
      for (let i = 0; i < slideCount; i++) {
        expanded.push({
          ...step,
          id: `${step.id}_${i}`,
          label: `${step.label} ${i + 1}`,
        });
      }
    } else {
      expanded.push(step);
    }
  }

  return expanded;
}

/**
 * Validates whether the current step has enough data to proceed.
 */
function isStepComplete(
  step: WizardStepConfig,
  data: unknown,
  currentProps: Record<string, unknown>
): boolean {
  if (!step.required) return true;

  switch (step.type) {
    case 'banner-association': {
      const assoc = data as BannerAssociationPayload | undefined;
      if (!assoc) return false;
      if (assoc.associationType === 'product') return !!assoc.productId;
      if (assoc.associationType === 'category') return !!assoc.categoryId;
      if (assoc.associationType === 'url') return !!assoc.manualUrl;
      if (assoc.associationType === 'none') return true;
      return false;
    }
    case 'quantity-select':
      return typeof data === 'number' && data >= (step.min || 1);
    case 'source-select': {
      // Reads from current props — source must be set and if manual, productIds must exist
      const source = currentProps.source as string;
      if (!source) return false;
      if (source === 'manual') {
        const ids = currentProps.productIds as string[];
        return Array.isArray(ids) && ids.length > 0;
      }
      if (source === 'category') {
        return !!currentProps.categoryId;
      }
      return false;
    }
    case 'briefing':
      return typeof data === 'string' && data.trim().length > 0;
    case 'confirm':
      return true;
    default:
      return true;
  }
}

export function useAIBlockWizard({
  contract,
  blockType,
  currentProps,
}: UseAIBlockWizardParams): UseAIBlockWizardReturn {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [collectedData, setCollectedData] = useState<Record<string, unknown>>({});

  // Expand perSlide steps dynamically
  const steps = useMemo(
    () => expandSteps(contract.steps, collectedData),
    [contract.steps, collectedData]
  );

  const currentStep = steps[currentStepIndex] || steps[0];
  const totalSteps = steps.length;
  const isConfirmStep = currentStep?.type === 'confirm';

  const canGoNext = useMemo(() => {
    if (currentStepIndex >= totalSteps - 1) return false;
    return isStepComplete(currentStep, collectedData[currentStep.id], currentProps);
  }, [currentStepIndex, totalSteps, currentStep, collectedData, currentProps]);

  const canGoBack = currentStepIndex > 0;

  const goNext = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, totalSteps]);

  const goBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const setStepData = useCallback((stepId: string, data: unknown) => {
    setCollectedData((prev) => ({ ...prev, [stepId]: data }));
  }, []);

  const getStepData = useCallback(
    (stepId: string) => collectedData[stepId],
    [collectedData]
  );

  const reset = useCallback(() => {
    setCurrentStepIndex(0);
    setCollectedData({});
  }, []);

  return {
    currentStepIndex,
    currentStep,
    steps,
    totalSteps,
    collectedData,
    canGoNext,
    canGoBack,
    isConfirmStep,
    goNext,
    goBack,
    setStepData,
    getStepData,
    reset,
  };
}
