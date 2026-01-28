import React from 'react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id?: string;
  number?: number;
  title: string;
  description: string;
}

interface StepsTimelineBlockProps {
  title?: string;
  subtitle?: string;
  steps: Step[];
  layout?: 'horizontal' | 'vertical';
  accentColor?: string;
  showNumbers?: boolean;
  backgroundColor?: string;
}

export function StepsTimelineBlock({
  title = 'Como Funciona',
  subtitle,
  steps = [],
  layout = 'horizontal',
  accentColor,
  showNumbers = true,
  backgroundColor = 'transparent',
}: StepsTimelineBlockProps) {
  const isHorizontal = layout === 'horizontal';
  // Use theme color if no custom accentColor is set
  const effectiveAccentColor = accentColor || 'var(--theme-button-primary-bg, #1a1a1a)';
  
  return (
    <section 
      className="py-12 md:py-16 px-4"
      style={{ backgroundColor }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        {(title || subtitle) && (
          <div className="text-center mb-10 md:mb-14">
            {title && (
              <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-3">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Steps */}
        <div className={cn(
          'relative',
          isHorizontal 
            ? 'flex flex-col md:flex-row md:items-start md:justify-between gap-8 md:gap-4' 
            : 'flex flex-col gap-8'
        )}>
          {/* Connection line (horizontal) */}
          {isHorizontal && steps.length > 1 && (
            <div 
              className="hidden md:block absolute top-8 left-0 right-0 h-0.5 z-0"
              style={{ 
                background: `linear-gradient(to right, ${effectiveAccentColor}40, ${effectiveAccentColor}, ${effectiveAccentColor}40)`,
                left: '10%',
                right: '10%',
              }}
            />
          )}
          
          {steps.map((step, index) => (
            <div 
              key={step.id || index}
              className={cn(
                'relative z-10',
                isHorizontal ? 'flex-1 flex flex-col items-center text-center' : 'flex gap-4 items-start'
              )}
            >
              {/* Number circle */}
              <div 
                className={cn(
                  'flex items-center justify-center rounded-full font-bold text-lg shrink-0',
                  isHorizontal ? 'w-16 h-16 mb-4' : 'w-12 h-12'
                )}
                style={{ 
                  backgroundColor: effectiveAccentColor,
                  color: '#ffffff',
                  boxShadow: `0 4px 14px ${effectiveAccentColor}40`,
                }}
              >
                {showNumbers ? (step.number ?? index + 1) : (
                  <LucideIcons.Check className="w-6 h-6" />
                )}
              </div>

              {/* Vertical line connector */}
              {!isHorizontal && index < steps.length - 1 && (
                <div 
                  className="absolute left-6 top-14 w-0.5 h-full -translate-x-1/2"
                  style={{ backgroundColor: `${effectiveAccentColor}30` }}
                />
              )}

              {/* Content */}
              <div className={cn(
                isHorizontal ? 'max-w-xs' : 'flex-1 pb-8'
              )}>
                <h3 className="font-semibold text-lg text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default StepsTimelineBlock;
