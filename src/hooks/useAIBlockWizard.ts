// =============================================
// useAIBlockWizard — Hook para gerenciar estado do wizard de IA
// Phase 3.3: Supports banner-mode-select, scope-select, dynamic step expansion
// =============================================

import { useState, useCallback, useMemo } from 'react';
import {
  WizardBlockContract,
  WizardStepConfig,
  BannerAssociationPayload,
} from '@/lib/builder/aiWizardRegistry';
import type { BannerModeData } from '@/components/builder/ai-wizard/steps/BannerModeStep';
import type { GenerationScope } from '@/components/builder/ai-wizard/steps/ScopeSelectStep';

interface UseAIBlockWizardParams {
  contract: WizardBlockContract;
  blockType: string;
  currentProps: Record<string, unknown>;
}

interface UseAIBlockWizardReturn {
  currentStepIndex: number;
  currentStep: WizardStepConfig;
  steps: WizardStepConfig[];
  totalSteps: number;
  collectedData: Record<string, unknown>;
  canGoNext: boolean;
  canGoBack: boolean;
  isConfirmStep: boolean;
  goNext: () => void;
  goBack: () => void;
  setStepData: (stepId: string, data: unknown) => void;
  getStepData: (stepId: string) => unknown;
  reset: () => void;
}

/**
 * Expands steps dynamically based on collected data:
 * - perSlide steps are expanded based on bannerMode data (carousel → N slides)
 * - For single mode, perSlide steps appear once without index suffix
 */
function expandSteps(
  baseSteps: WizardStepConfig[],
  collectedData: Record<string, unknown>
): WizardStepConfig[] {
  const expanded: WizardStepConfig[] = [];
  const modeData = collectedData['bannerMode'] as BannerModeData | undefined;

  for (const step of baseSteps) {
    if (step.perSlide) {
      if (modeData?.bannerMode === 'carousel') {
        const slideCount = modeData.slideCount || 2;
        for (let i = 0; i < slideCount; i++) {
          expanded.push({
            ...step,
            id: `${step.id}_${i}`,
            label: `${step.label} (Slide ${i + 1})`,
          });
        }
      } else {
        // Single mode: show once without suffix
        expanded.push(step);
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
    case 'banner-mode-select': {
      const modeData = data as BannerModeData | undefined;
      if (!modeData) return false;
      return modeData.bannerMode === 'single' || 
        (modeData.bannerMode === 'carousel' && modeData.slideCount >= 2 && modeData.slideCount <= 3);
    }
    case 'scope-select': {
      const scope = data as GenerationScope | undefined;
      return scope === 'images' || scope === 'texts' || scope === 'all';
    }
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

  // Expand perSlide steps dynamically based on mode selection
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
