// =============================================
// PRICING TABLE BLOCK - Plans/pricing comparison
// =============================================

import React from 'react';
import { Check, X, Sparkles, Zap, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanFeature {
  name: string;
  included: boolean | string;
}

interface PricingPlan {
  id?: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  period?: string;
  features: PlanFeature[];
  isPopular?: boolean;
  buttonText?: string;
  buttonUrl?: string;
  icon?: 'sparkles' | 'zap' | 'crown';
}

interface PricingTableBlockProps {
  title?: string;
  subtitle?: string;
  layout?: 'cards' | 'table' | 'horizontal';
  showAnnualToggle?: boolean;
  annualDiscount?: number;
  plans?: PricingPlan[];
  isEditing?: boolean;
}

const defaultPlans: PricingPlan[] = [
  {
    id: '1',
    name: 'Básico',
    description: 'Para quem está começando',
    price: 29.90,
    period: '/mês',
    icon: 'sparkles',
    features: [
      { name: 'Até 100 produtos', included: true },
      { name: 'Suporte por email', included: true },
      { name: 'Relatórios básicos', included: true },
      { name: 'Integrações', included: '3 integrações' },
      { name: 'Domínio personalizado', included: false },
      { name: 'Checkout personalizado', included: false },
    ],
    buttonText: 'Começar grátis',
  },
  {
    id: '2',
    name: 'Profissional',
    description: 'Para negócios em crescimento',
    price: 79.90,
    originalPrice: 99.90,
    period: '/mês',
    icon: 'zap',
    isPopular: true,
    features: [
      { name: 'Até 1.000 produtos', included: true },
      { name: 'Suporte prioritário', included: true },
      { name: 'Relatórios avançados', included: true },
      { name: 'Integrações', included: 'Ilimitadas' },
      { name: 'Domínio personalizado', included: true },
      { name: 'Checkout personalizado', included: false },
    ],
    buttonText: 'Assinar agora',
  },
  {
    id: '3',
    name: 'Enterprise',
    description: 'Para grandes operações',
    price: 199.90,
    period: '/mês',
    icon: 'crown',
    features: [
      { name: 'Produtos ilimitados', included: true },
      { name: 'Suporte 24/7', included: true },
      { name: 'Relatórios customizados', included: true },
      { name: 'Integrações', included: 'Ilimitadas' },
      { name: 'Domínio personalizado', included: true },
      { name: 'Checkout personalizado', included: true },
    ],
    buttonText: 'Falar com vendas',
  },
];

const IconMap = {
  sparkles: Sparkles,
  zap: Zap,
  crown: Crown,
};

export function PricingTableBlock({
  title = 'Escolha o Plano Ideal',
  subtitle = 'Comece gratuitamente e escale conforme cresce',
  layout = 'cards',
  showAnnualToggle = true,
  annualDiscount = 20,
  plans,
  isEditing = false,
}: PricingTableBlockProps) {
  const [isAnnual, setIsAnnual] = React.useState(false);
  const displayPlans = plans?.length ? plans : defaultPlans;

  const formatPrice = (price: number) => {
    const finalPrice = isAnnual ? price * (1 - annualDiscount / 100) : price;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(finalPrice);
  };

  // Layout: Table
  if (layout === 'table') {
    const allFeatures = Array.from(
      new Set(displayPlans.flatMap((p) => p.features.map((f) => f.name)))
    );

    return (
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">{title}</h2>
            {subtitle && <p className="text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-4 border-b border-border"></th>
                  {displayPlans.map((plan) => (
                    <th
                      key={plan.id || plan.name}
                      className={cn(
                        'p-4 border-b border-border text-center min-w-[200px]',
                        plan.isPopular && 'bg-primary/5'
                      )}
                    >
                      {plan.isPopular && (
                        <span className="inline-block mb-2 px-3 py-1 text-xs font-semibold uppercase bg-primary text-primary-foreground rounded-full">
                          Mais popular
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                      <div className="mt-2">
                        <span className="text-3xl font-bold text-foreground">
                          {formatPrice(plan.price)}
                        </span>
                        <span className="text-muted-foreground">{plan.period}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allFeatures.map((featureName, idx) => (
                  <tr key={idx} className="border-b border-border">
                    <td className="p-4 text-foreground font-medium">{featureName}</td>
                    {displayPlans.map((plan) => {
                      const feature = plan.features.find((f) => f.name === featureName);
                      return (
                        <td
                          key={plan.id || plan.name}
                          className={cn('p-4 text-center', plan.isPopular && 'bg-primary/5')}
                        >
                          {!feature || feature.included === false ? (
                            <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                          ) : feature.included === true ? (
                            <Check className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />
                          ) : (
                            <span className="text-sm text-foreground">{feature.included}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="p-4"></td>
                  {displayPlans.map((plan) => (
                    <td
                      key={plan.id || plan.name}
                      className={cn('p-4 text-center', plan.isPopular && 'bg-primary/5')}
                    >
                      <button
                        className={cn(
                          'w-full py-3 px-6 rounded-lg font-semibold transition-colors',
                          plan.isPopular
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'bg-muted text-foreground hover:bg-muted/80'
                        )}
                      >
                        {plan.buttonText || 'Selecionar'}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  // Layout: Cards (padrão)
  return (
    <section className="py-16 px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">{title}</h2>
          {subtitle && <p className="text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>}

          {/* Toggle Anual/Mensal */}
          {showAnnualToggle && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <span className={cn('text-sm', !isAnnual && 'font-semibold text-foreground')}>
                Mensal
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={cn(
                  'relative w-14 h-7 rounded-full transition-colors',
                  isAnnual ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow-sm',
                    isAnnual ? 'translate-x-8' : 'translate-x-1'
                  )}
                />
              </button>
              <span className={cn('text-sm', isAnnual && 'font-semibold text-foreground')}>
                Anual
                <span className="ml-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                  -{annualDiscount}%
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {displayPlans.map((plan, index) => {
            const Icon = IconMap[plan.icon || 'sparkles'];
            return (
              <div
                key={plan.id || index}
                className={cn(
                  'relative bg-card rounded-2xl border transition-all duration-300',
                  plan.isPopular
                    ? 'border-primary shadow-xl shadow-primary/10 scale-[1.02]'
                    : 'border-border hover:border-primary/50 hover:shadow-lg'
                )}
              >
                {/* Popular Badge */}
                {plan.isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold uppercase bg-primary text-primary-foreground rounded-full shadow-lg">
                      <Zap className="w-3.5 h-3.5" />
                      Mais popular
                    </span>
                  </div>
                )}

                <div className="p-6 lg:p-8">
                  {/* Plan Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={cn(
                        'p-2.5 rounded-xl',
                        plan.isPopular
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {plan.originalPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPrice(plan.originalPrice)}
                      </span>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        {formatPrice(plan.price)}
                      </span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-3">
                        {feature.included === false ? (
                          <X className="w-5 h-5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        )}
                        <span
                          className={cn(
                            'text-sm',
                            feature.included === false
                              ? 'text-muted-foreground/60'
                              : 'text-foreground'
                          )}
                        >
                          {feature.name}
                          {typeof feature.included === 'string' && (
                            <span className="ml-1 text-muted-foreground">
                              ({feature.included})
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    className={cn(
                      'w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200',
                      plan.isPopular
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    )}
                  >
                    {plan.buttonText || 'Selecionar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {isEditing && (
          <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-dashed border-border">
            <p className="text-sm text-muted-foreground text-center">
              💡 Configure os planos e preços através das propriedades do bloco
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
