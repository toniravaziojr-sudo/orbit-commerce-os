import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface Plan {
  plan_key: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  feature_bullets: unknown;
  is_recommended: boolean | null;
}

export default function StartPlan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>(searchParams.get('plan') || '');
  const [cycle, setCycle] = useState<'monthly' | 'annual'>(
    (searchParams.get('cycle') as 'monthly' | 'annual') || 'monthly'
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      const { data, error } = await supabase
        .from('billing_plans')
        .select('plan_key, name, description, price_monthly_cents, price_annual_cents, feature_bullets, is_recommended')
        .eq('is_active', true)
        .eq('is_public', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setPlans(data);
        if (!selectedPlan && data.length > 0) {
          const recommended = data.find(p => p.is_recommended);
          setSelectedPlan(recommended?.plan_key || data[0].plan_key);
        }
      }
      setLoading(false);
    }
    loadPlans();
  }, [selectedPlan]);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getMonthlyEquivalent = (annualCents: number) => {
    return formatPrice(annualCents / 12);
  };

  const handleContinue = () => {
    if (!selectedPlan) return;
    navigate(`/start/info?plan=${selectedPlan}&cycle=${cycle}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Escolha seu plano</h1>
          <p className="text-muted-foreground">
            Comece sua jornada com o Comando Central
          </p>
        </div>

        {/* Cycle toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-muted rounded-lg p-1 inline-flex">
            <button
              onClick={() => setCycle('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                cycle === 'monthly'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setCycle('annual')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                cycle === 'annual'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Anual
              <Badge variant="secondary" className="ml-2 text-xs">
                -15%
              </Badge>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <RadioGroup
          value={selectedPlan}
          onValueChange={setSelectedPlan}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {plans.map((plan) => {
            const price = cycle === 'annual' ? plan.price_annual_cents : plan.price_monthly_cents;
            const features = Array.isArray(plan.feature_bullets) ? plan.feature_bullets : [];

            return (
              <Card
                key={plan.plan_key}
                className={`relative cursor-pointer transition-all hover:shadow-lg ${
                  selectedPlan === plan.plan_key
                    ? 'ring-2 ring-primary border-primary'
                    : 'hover:border-primary/50'
                } ${plan.is_recommended ? 'border-primary' : ''}`}
                onClick={() => setSelectedPlan(plan.plan_key)}
              >
                {plan.is_recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Recomendado</Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      {plan.description && (
                        <CardDescription className="mt-1">{plan.description}</CardDescription>
                      )}
                    </div>
                    <RadioGroupItem value={plan.plan_key} id={plan.plan_key} className="mt-1" />
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <div className="mb-4">
                    <span className="text-3xl font-bold">
                      {cycle === 'annual' ? getMonthlyEquivalent(price) : formatPrice(price)}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                    {cycle === 'annual' && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatPrice(price)} cobrado anualmente
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Label
                    htmlFor={plan.plan_key}
                    className="w-full text-center text-sm text-muted-foreground cursor-pointer"
                  >
                    Clique para selecionar
                  </Label>
                </CardFooter>
              </Card>
            );
          })}
        </RadioGroup>

        {/* Continue button */}
        <div className="mt-10 flex justify-center">
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={!selectedPlan}
            className="px-8"
          >
            Continuar
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Você pode alterar seu plano a qualquer momento
        </p>
      </div>
    </div>
  );
}
