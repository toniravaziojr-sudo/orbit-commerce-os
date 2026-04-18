import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CheckoutStep, StepDef } from './types';

interface ProgressTimelineProps {
  steps: ReadonlyArray<StepDef>;
  currentStep: CheckoutStep;
  onStepClick: (step: CheckoutStep) => void;
}

// Progress Timeline Component (modern horizontal style like builder)
// Mobile-friendly: wraps properly and shows smaller labels
export function ProgressTimeline({ steps, currentStep, onStepClick }: ProgressTimelineProps) {
  return (
    <div className="mb-6 md:mb-8">
      {/* Desktop: horizontal pills with labels */}
      <div className="hidden sm:flex items-center justify-center gap-2 flex-wrap">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => step.id <= currentStep && onStepClick(step.id as CheckoutStep)}
                disabled={step.id > currentStep}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-full text-sm whitespace-nowrap transition-colors",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                style={isCurrent ? {
                  backgroundColor: 'var(--theme-button-primary-bg, hsl(var(--primary)))',
                  color: 'var(--theme-button-primary-text, hsl(var(--primary-foreground)))',
                } : isCompleted ? {
                  backgroundColor: 'color-mix(in srgb, var(--theme-button-primary-bg, var(--theme-accent-color, #22c55e)) 15%, transparent)',
                  color: 'var(--theme-button-primary-bg, var(--theme-accent-color, #22c55e))',
                  cursor: 'pointer',
                } : undefined}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                <span className="font-medium">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile: compact numbered circles with current step label */}
      <div className="flex sm:hidden flex-col items-center gap-3">
        <div className="flex items-center gap-1">
          {steps.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => step.id <= currentStep && onStepClick(step.id as CheckoutStep)}
                  disabled={step.id > currentStep}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                  style={isCurrent ? {
                    backgroundColor: 'var(--theme-button-primary-bg, hsl(var(--primary)))',
                    color: 'var(--theme-button-primary-text, hsl(var(--primary-foreground)))',
                  } : isCompleted ? {
                    backgroundColor: 'var(--theme-button-primary-bg, var(--theme-accent-color, #22c55e))',
                    color: 'white',
                  } : undefined}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={cn("w-6 h-0.5", !isCompleted && "bg-muted")}
                    style={currentStep > step.id ? {
                      backgroundColor: 'var(--theme-button-primary-bg, var(--theme-accent-color, #22c55e))',
                    } : undefined}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {/* Current step label */}
        <span className="text-sm font-medium text-foreground">
          {steps.find(s => s.id === currentStep)?.label}
        </span>
      </div>
    </div>
  );
}
