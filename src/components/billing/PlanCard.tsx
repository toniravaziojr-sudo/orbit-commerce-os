import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star } from 'lucide-react';
import { Plan, formatCurrency, formatPercentage } from '@/hooks/usePlans';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan?: boolean;
  isPopular?: boolean;
  onSelect?: (planKey: string) => void;
  disabled?: boolean;
}

export function PlanCard({ plan, isCurrentPlan, isPopular, onSelect, disabled }: PlanCardProps) {
  const features = [
    'Todos os módulos disponíveis',
    'SSL grátis',
    'Migração automática',
    `Até ${plan.order_limit || '∞'} pedidos/mês`,
    `Taxa por venda: ${formatPercentage(plan.fee_bps)}`,
  ];

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
            {plan.monthly_fee_cents === 0 ? 'Grátis' : formatCurrency(plan.monthly_fee_cents)}
          </span>
          {plan.monthly_fee_cents > 0 && (
            <span className="text-muted-foreground">/mês</span>
          )}
        </div>

        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
          <li className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <span className="text-sm text-muted-foreground">IA cobrada sob consumo</span>
          </li>
        </ul>
      </CardContent>

      <CardFooter>
        {plan.is_custom ? (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.open('https://wa.me/5511999999999?text=Quero%20saber%20mais%20sobre%20o%20plano%20Custom', '_blank')}
          >
            Fale Conosco
          </Button>
        ) : isCurrentPlan ? (
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
            {plan.monthly_fee_cents === 0 ? 'Começar Grátis' : 'Assinar Agora'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
