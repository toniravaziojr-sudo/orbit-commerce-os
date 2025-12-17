// =============================================
// BENEFIT PROGRESS BAR - Shows progress toward free shipping/gift
// Uses centralized cartTotals for consistency
// =============================================

import { useBenefit } from '@/contexts/StorefrontConfigContext';
import { useCart } from '@/contexts/CartContext';
import { Gift, Truck, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { calculateCartTotals } from '@/lib/cartTotals';

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

  return (
    <div 
      className="p-4 rounded-lg border"
      style={{ 
        backgroundColor: achieved ? `${config.progressColor}10` : 'hsl(var(--muted))',
        borderColor: achieved ? config.progressColor : 'hsl(var(--border))'
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div 
          className="p-2 rounded-full"
          style={{ backgroundColor: achieved ? config.progressColor : 'hsl(var(--muted-foreground) / 0.2)' }}
        >
          {achieved ? (
            <Check className="h-4 w-4 text-white" />
          ) : (
            <Icon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          {achieved ? (
            <p className="font-semibold" style={{ color: config.progressColor }}>
              {label}
            </p>
          ) : (
            <p className="text-sm">
              Faltam{' '}
              <span className="font-semibold">
                R$ {remaining.toFixed(2).replace('.', ',')}
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
          '--progress-background': config.progressColor 
        } as React.CSSProperties}
      />
    </div>
  );
}
