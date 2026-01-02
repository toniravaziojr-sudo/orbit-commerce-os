import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface StatItem {
  id?: string;
  number: string;
  label: string;
  prefix?: string;
  suffix?: string;
}

interface StatsNumbersBlockProps {
  title?: string;
  subtitle?: string;
  items: StatItem[];
  layout?: 'horizontal' | 'grid';
  animateNumbers?: boolean;
  backgroundColor?: string;
  accentColor?: string;
  textColor?: string;
}

function AnimatedNumber({ value, animate }: { value: string; animate: boolean }) {
  const [displayValue, setDisplayValue] = useState(animate ? '0' : value);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!animate || hasAnimated.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          hasAnimated.current = true;
          
          // Extract numeric part
          const numericMatch = value.match(/[\d,.]+/);
          if (!numericMatch) {
            setDisplayValue(value);
            return;
          }

          const numericValue = parseFloat(numericMatch[0].replace(/,/g, ''));
          const prefix = value.slice(0, value.indexOf(numericMatch[0]));
          const suffix = value.slice(value.indexOf(numericMatch[0]) + numericMatch[0].length);
          
          const duration = 2000;
          const steps = 60;
          const stepValue = numericValue / steps;
          let current = 0;
          let step = 0;

          const timer = setInterval(() => {
            step++;
            current = Math.min(stepValue * step, numericValue);
            
            // Format with same style as original
            let formatted = numericMatch[0].includes(',') || numericMatch[0].includes('.')
              ? current.toLocaleString('pt-BR')
              : Math.round(current).toString();
            
            setDisplayValue(`${prefix}${formatted}${suffix}`);

            if (step >= steps) {
              clearInterval(timer);
              setDisplayValue(value);
            }
          }, duration / steps);

          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [value, animate]);

  return <span ref={ref}>{displayValue}</span>;
}

export function StatsNumbersBlock({
  title,
  subtitle,
  items = [],
  layout = 'horizontal',
  animateNumbers = true,
  backgroundColor = 'transparent',
  accentColor = '#6366f1',
  textColor,
}: StatsNumbersBlockProps) {
  const isGrid = layout === 'grid' || items.length > 4;

  return (
    <section 
      className="py-12 md:py-16 px-4"
      style={{ backgroundColor }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        {(title || subtitle) && (
          <div className="text-center mb-10 md:mb-12">
            {title && (
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Stats */}
        <div className={cn(
          'gap-6 md:gap-10',
          isGrid 
            ? 'grid grid-cols-2 md:grid-cols-4' 
            : 'flex flex-wrap justify-center items-start'
        )}>
          {items.map((item, index) => (
            <div 
              key={item.id || index}
              className={cn(
                'text-center',
                !isGrid && 'px-6 md:px-10'
              )}
            >
              <div 
                className="text-3xl md:text-5xl font-bold mb-2"
                style={{ color: accentColor }}
              >
                {item.prefix}
                <AnimatedNumber value={item.number} animate={animateNumbers} />
                {item.suffix}
              </div>
              <p 
                className="text-sm md:text-base"
                style={{ color: textColor || 'hsl(var(--muted-foreground))' }}
              >
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Adicione estatísticas ou números de destaque
          </div>
        )}
      </div>
    </section>
  );
}

export default StatsNumbersBlock;
