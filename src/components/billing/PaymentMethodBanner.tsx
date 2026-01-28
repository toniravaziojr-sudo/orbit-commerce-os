import { CreditCard, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

/**
 * Banner de aviso para usuários do plano básico que precisam cadastrar cartão.
 * Aparece no dashboard e em outras páginas estratégicas.
 */
export function PaymentMethodBanner() {
  const navigate = useNavigate();
  const { needsPaymentMethod, isBasicPlan, isLoading } = useSubscriptionStatus();

  // Não mostrar se está carregando ou se não precisa de cartão
  if (isLoading || !needsPaymentMethod || !isBasicPlan) {
    return null;
  }

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10 mb-6">
      <CreditCard className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-600 dark:text-amber-400">
        Cadastre seu cartão de crédito
      </AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-muted-foreground">
          Para publicar sua loja e usar todas as funcionalidades, você precisa cadastrar um cartão de crédito.
        </span>
        <Button 
          onClick={() => navigate('/settings/add-payment-method')}
          size="sm"
          className="w-fit"
        >
          Cadastrar agora
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
