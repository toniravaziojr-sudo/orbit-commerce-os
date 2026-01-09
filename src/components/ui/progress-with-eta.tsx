import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";
import { Loader2, Clock } from "lucide-react";

interface ProgressWithETAProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Current progress value (0-100) */
  value?: number;
  /** Show indeterminate state (animated loading) */
  indeterminate?: boolean;
  /** Label to show above the progress bar */
  label?: string;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
  /** Current step description */
  currentStep?: string;
  /** Total steps count */
  totalSteps?: number;
  /** Current step number */
  currentStepNumber?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s restantes`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return secs > 0 ? `${minutes}min ${secs}s restantes` : `${minutes}min restantes`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}min restantes` : `${hours}h restantes`;
  }
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const variantClasses = {
  default: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  destructive: 'bg-destructive',
};

const ProgressWithETA = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressWithETAProps
>(({ 
  className, 
  value = 0, 
  indeterminate = false,
  label,
  showPercentage = true,
  estimatedTimeRemaining,
  currentStep,
  totalSteps,
  currentStepNumber,
  size = 'md',
  variant = 'default',
  ...props 
}, ref) => {
  const progressValue = indeterminate ? 0 : Math.min(100, Math.max(0, value));
  
  return (
    <div className="w-full space-y-2">
      {/* Header with label, step count, and percentage */}
      {(label || showPercentage || (totalSteps && currentStepNumber)) && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {indeterminate && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {label && <span className="font-medium text-foreground">{label}</span>}
            {totalSteps && currentStepNumber && (
              <span className="text-muted-foreground">
                (Etapa {currentStepNumber} de {totalSteps})
              </span>
            )}
          </div>
          {showPercentage && !indeterminate && (
            <span className="text-muted-foreground font-medium">{Math.round(progressValue)}%</span>
          )}
        </div>
      )}
      
      {/* Progress bar */}
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-secondary",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full flex-1 transition-all duration-300 ease-in-out",
            variantClasses[variant],
            indeterminate && "animate-progress-indeterminate"
          )}
          style={{ 
            transform: indeterminate ? undefined : `translateX(-${100 - progressValue}%)`,
            width: indeterminate ? '30%' : '100%',
          }}
        />
      </ProgressPrimitive.Root>
      
      {/* Footer with current step and ETA */}
      {(currentStep || estimatedTimeRemaining !== undefined) && (
        <div className="flex items-center justify-between text-xs">
          {currentStep && (
            <span className="text-muted-foreground truncate max-w-[60%]">{currentStep}</span>
          )}
          {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
              <Clock className="h-3 w-3" />
              {formatTimeRemaining(estimatedTimeRemaining)}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

ProgressWithETA.displayName = "ProgressWithETA";

export { ProgressWithETA, formatTimeRemaining };
export type { ProgressWithETAProps };
