// =============================================
// BENEFIT PROGRESS BAR - Shows progress toward free shipping/gift
// Uses centralized cartTotals for consistency
// =============================================

import { useBenefit } from '@/contexts/StorefrontConfigContext';
import { useCart } from '@/contexts/CartContext';
import { Gift, Truck, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { calculateCartTotals, formatPrice } from '@/lib/cartTotals';

export function BenefitProgressBar() {
  const { items, shipping } = useCart();
  const { config, getProgress, isLoading } = useBenefit();

  // Use centralized totals calculation
  const totals = calculateCartTotals({
    items,
    selectedShipping: shipping.selected,
    discountAmount: 0,
  });

  if (isLoading) return null;

  const { enabled, progress, remaining, achieved, label } = getProgress(totals.subtotal);

  if (!enabled) return null;

  const Icon = config.mode === 'gift' ? Gift : Truck;

  // Use theme accent color as fallback when config.progressColor is the default green
  const progressColor = config.progressColor === '#22c55e' 
    ? 'var(--theme-accent-color, #22c55e)' 
    : config.progressColor;

  return (
    <div 
      className="p-4 rounded-lg border"
      style={{ 
        backgroundColor: achieved ? `color-mix(in srgb, ${progressColor} 10%, transparent)` : 'hsl(var(--muted))',
        borderColor: achieved ? progressColor : 'hsl(var(--border))'
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div 
          className="p-2 rounded-full"
          style={{ backgroundColor: achieved ? progressColor : 'hsl(var(--muted-foreground) / 0.2)' }}
        >
          {achieved ? (
            <Check className="h-4 w-4 text-white" />
          ) : (
            <Icon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          {achieved ? (
            <p className="font-semibold" style={{ color: progressColor }}>
              {label}
            </p>
          ) : (
            <p className="text-sm">
              Faltam{' '}
              <span className="font-semibold">
                R$ {formatPrice(remaining)}
              </span>{' '}
              para {label.toLowerCase()}
            </p>
          )}
        </div>
      </div>

      <Progress 
        value={progress} 
        className="h-2"
        style={{ 
          '--progress-background': progressColor 
        } as React.CSSProperties}
      />
    </div>
  );
}
