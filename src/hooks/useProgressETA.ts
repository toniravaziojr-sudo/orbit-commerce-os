import { useState, useEffect, useCallback, useRef } from 'react';

interface UseProgressETAOptions {
  /** Minimum progress change to update ETA (prevents jitter) */
  minProgressDelta?: number;
  /** Smoothing factor for ETA calculation (0-1, higher = more responsive) */
  smoothingFactor?: number;
}

interface UseProgressETAReturn {
  /** Current progress value (0-100) */
  progress: number;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining: number | null;
  /** Is the process currently running */
  isRunning: boolean;
  /** Current step name/description */
  currentStep: string;
  /** Start tracking progress */
  start: () => void;
  /** Stop tracking and reset */
  stop: () => void;
  /** Update progress and optionally the step name */
  updateProgress: (value: number, stepName?: string) => void;
  /** Reset all values without starting */
  reset: () => void;
}

/**
 * Hook to track progress and estimate time remaining for long-running operations.
 * Provides smooth ETA calculations with jitter prevention.
 */
export function useProgressETA(options: UseProgressETAOptions = {}): UseProgressETAReturn {
  const { minProgressDelta = 1, smoothingFactor = 0.3 } = options;
  
  const [progress, setProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  
  const startTimeRef = useRef<number | null>(null);
  const lastProgressRef = useRef(0);
  const lastETARef = useRef<number | null>(null);
  
  const start = useCallback(() => {
    startTimeRef.current = Date.now();
    lastProgressRef.current = 0;
    lastETARef.current = null;
    setProgress(0);
    setEstimatedTimeRemaining(null);
    setIsRunning(true);
    setCurrentStep('');
  }, []);
  
  const stop = useCallback(() => {
    setIsRunning(false);
    setCurrentStep('');
    startTimeRef.current = null;
    lastProgressRef.current = 0;
    lastETARef.current = null;
  }, []);
  
  const reset = useCallback(() => {
    setProgress(0);
    setEstimatedTimeRemaining(null);
    setIsRunning(false);
    setCurrentStep('');
    startTimeRef.current = null;
    lastProgressRef.current = 0;
    lastETARef.current = null;
  }, []);
  
  const updateProgress = useCallback((value: number, stepName?: string) => {
    const clampedValue = Math.min(100, Math.max(0, value));
    
    // Only update if progress changed significantly
    if (Math.abs(clampedValue - lastProgressRef.current) >= minProgressDelta || clampedValue === 100) {
      setProgress(clampedValue);
      lastProgressRef.current = clampedValue;
      
      // Calculate ETA
      if (startTimeRef.current && clampedValue > 0 && clampedValue < 100) {
        const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
        const estimatedTotal = (elapsedTime / clampedValue) * 100;
        const newETA = Math.max(0, estimatedTotal - elapsedTime);
        
        // Apply smoothing to prevent jitter
        if (lastETARef.current !== null) {
          const smoothedETA = lastETARef.current * (1 - smoothingFactor) + newETA * smoothingFactor;
          lastETARef.current = smoothedETA;
          setEstimatedTimeRemaining(smoothedETA);
        } else {
          lastETARef.current = newETA;
          setEstimatedTimeRemaining(newETA);
        }
      } else if (clampedValue >= 100) {
        setEstimatedTimeRemaining(0);
      }
    }
    
    if (stepName !== undefined) {
      setCurrentStep(stepName);
    }
  }, [minProgressDelta, smoothingFactor]);
  
  // Auto-stop when progress reaches 100%
  useEffect(() => {
    if (progress >= 100 && isRunning) {
      // Small delay to show 100% before stopping
      const timer = setTimeout(() => {
        setIsRunning(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [progress, isRunning]);
  
  return {
    progress,
    estimatedTimeRemaining,
    isRunning,
    currentStep,
    start,
    stop,
    updateProgress,
    reset,
  };
}
