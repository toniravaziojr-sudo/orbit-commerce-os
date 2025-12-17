// =============================================
// RATING SUMMARY - Reusable star rating display component
// Used in product pages and product cards
// =============================================

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingSummaryProps {
  average: number; // 0-5, can be decimal
  count: number; // Number of reviews
  variant?: 'productTitle' | 'card'; // Display variant
  onClick?: () => void; // Optional click handler (e.g., scroll to reviews)
  className?: string;
}

export function RatingSummary({
  average,
  count,
  variant = 'productTitle',
  onClick,
  className,
}: RatingSummaryProps) {
  // Don't render if no reviews
  if (count === 0) {
    return null;
  }

  // Round to 1 decimal place for display
  const displayAverage = Math.round(average * 10) / 10;
  
  // Generate aria label for accessibility
  const ariaLabel = `Avaliação média ${displayAverage.toFixed(1).replace('.', ',')} de 5 com ${count} ${count === 1 ? 'avaliação' : 'avaliações'}`;

  const renderStars = () => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          // Calculate fill: full, half, or empty
          const diff = average - star + 1;
          let fillPercent = 0;
          if (diff >= 1) {
            fillPercent = 100;
          } else if (diff > 0) {
            fillPercent = Math.round(diff * 100);
          }

          return (
            <div key={star} className="relative">
              {/* Empty star (background) */}
              <Star
                className={cn(
                  variant === 'card' ? 'h-3.5 w-3.5' : 'h-4 w-4',
                  'text-muted-foreground/30'
                )}
              />
              {/* Filled star (overlay with clip) */}
              {fillPercent > 0 && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fillPercent}%` }}
                >
                  <Star
                    className={cn(
                      variant === 'card' ? 'h-3.5 w-3.5' : 'h-4 w-4',
                      'text-yellow-400 fill-yellow-400'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const content = (
    <div
      className={cn(
        'flex items-center gap-1.5',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {renderStars()}
      {variant === 'productTitle' ? (
        <span className="text-sm text-muted-foreground">
          {count} {count === 1 ? 'Avaliação' : 'Avaliações'}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          ({count})
        </span>
      )}
    </div>
  );

  return content;
}
