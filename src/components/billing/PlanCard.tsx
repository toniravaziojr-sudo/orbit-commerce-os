import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star } from 'lucide-react';
import { formatCurrency } from '@/hooks/usePlans';
import { cn } from '@/lib/utils';

interface PlanCardPlan {
  plan_key: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  included_orders_per_month: number | null;
  feature_bullets: string[];
  is_recommended?: boolean;
  support_level?: string | null;
}

interface PlanCardProps {
  plan: PlanCardPlan;
  isCurrentPlan?: boolean;
  billingCycle?: 'monthly' | 'annual';
  onSelect?: (planKey: string) => void;
  disabled?: boolean;
}

export function PlanCard({ plan, isCurrentPlan, billingCycle = 'monthly', onSelect, disabled }: PlanCardProps) {
  const isPopular = plan.is_recommended;
  const displayPrice = billingCycle === 'annual' ? plan.price_annual_cents : plan.price_monthly_cents;
  const monthlyEquivalent = billingCycle === 'annual' 
    ? Math.round(plan.price_annual_cents / 12) 
    : plan.price_monthly_cents;

  return (
    <Card className={cn(
      'relative flex flex-col transition-all',
      isPopular && 'border-primary shadow-lg scale-105',
      isCurrentPlan && 'border-green-500 bg-green-50/50 dark:bg-green-950/20',
    )}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
          <Star className="h-3 w-3 mr-1" />
          Mais Popular
        </Badge>
      )}
      
      {isCurrentPlan && (
        <Badge className="absolute -top-3 right-4 bg-green-600">
          Plano Atual
        </Badge>
      )}

      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="text-center mb-6">
          <span className="text-4xl font-bold">
            {formatCurrency(monthlyEquivalent)}
          </span>
          <span className="text-muted-foreground">/mês</span>
          {billingCycle === 'annual' && (
            <p className="text-xs text-green-600 mt-1 font-medium">
              15% de desconto • {formatCurrency(displayPrice)}/ano
            </p>
          )}
        </div>

        <ul className="space-y-2.5">
          {(plan.feature_bullets || []).map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        {isCurrentPlan ? (
          <Button variant="outline" className="w-full" disabled>
            Plano Atual
          </Button>
        ) : (
          <Button 
            className="w-full" 
            variant={isPopular ? 'default' : 'outline'}
            onClick={() => onSelect?.(plan.plan_key)}
            disabled={disabled}
          >
            Assinar Agora
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
