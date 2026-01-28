import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

interface PaymentMethodGateProps {
  children: ReactNode;
  /** Tipo de bloqueio visual */
  mode?: 'block' | 'blur' | 'alert';
  /** Título customizado */
  title?: string;
  /** Descrição customizada */
  description?: string;
  /** Ação específica que está sendo bloqueada */
  action?: string;
  /** Se deve mostrar o gate mesmo para quem já tem cartão (debug) */
  forceShow?: boolean;
}

/**
 * Componente que bloqueia ações/conteúdo até o usuário cadastrar um método de pagamento.
 * 
 * Usado principalmente para:
 * - Bloquear publicação de loja no plano básico
 * - Bloquear funcionalidades que requerem método de pagamento ativo
 */
export function PaymentMethodGate({
  children,
  mode = 'block',
  title = 'Cadastre seu cartão de crédito',
  description,
  action = 'continuar',
  forceShow = false,
}: PaymentMethodGateProps) {
  const navigate = useNavigate();
  const { needsPaymentMethod, isBasicPlan, isLoading } = useSubscriptionStatus();

  // Se está carregando, mostrar children (evita flash)
  if (isLoading) {
    return <>{children}</>;
  }

  // Se não precisa de método de pagamento (e não está forçando), liberar
  if (!needsPaymentMethod && !forceShow) {
    return <>{children}</>;
  }

  const defaultDescription = isBasicPlan
    ? `Para ${action} no plano básico, você precisa cadastrar um cartão de crédito. Isso é necessário para cobranças da taxa sobre vendas.`
    : `Para ${action}, você precisa cadastrar um método de pagamento válido.`;

  const handleAddPayment = () => {
    navigate('/settings/add-payment-method');
  };

  if (mode === 'alert') {
    return (
      <div className="space-y-4">
        <Alert variant="destructive" className="border-amber-500 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-500">Ação bloqueada</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {description || defaultDescription}
            <Button 
              variant="link" 
              className="px-0 h-auto text-primary" 
              onClick={handleAddPayment}
            >
              Cadastrar cartão agora
            </Button>
          </AlertDescription>
        </Alert>
        {children}
      </div>
    );
  }

  if (mode === 'blur') {
    return (
      <div className="relative">
        <div className="blur-sm pointer-events-none select-none opacity-50">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="max-w-md mx-4">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description || defaultDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleAddPayment} className="w-full" size="lg">
                <CreditCard className="h-4 w-4 mr-2" />
                Cadastrar cartão de crédito
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Seus dados estão protegidos e são processados com segurança.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // mode === 'block'
  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Lock className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-base">
          {description || defaultDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">Por que preciso cadastrar um cartão?</p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
            <li>Garantir cobranças automáticas de taxas sobre vendas</li>
            <li>Evitar interrupções no serviço</li>
            <li>Permitir upgrade de plano a qualquer momento</li>
          </ul>
        </div>

        <Button onClick={handleAddPayment} className="w-full" size="lg">
          <CreditCard className="h-4 w-4 mr-2" />
          Cadastrar cartão de crédito
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          🔒 Seus dados são criptografados e processados com segurança pelo Mercado Pago.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Hook wrapper para verificar se pode realizar ação
 */
export function useCanPerformAction() {
  const { canPublishStore, canUseFullFeatures, needsPaymentMethod, isBasicPlan } = useSubscriptionStatus();

  return {
    canPublishStore,
    canUseFullFeatures,
    needsPaymentMethod,
    isBasicPlan,
    /** Verificar se uma ação específica pode ser realizada */
    checkAction: (action: 'publish' | 'full_features') => {
      if (action === 'publish') return canPublishStore;
      if (action === 'full_features') return canUseFullFeatures;
      return true;
    },
  };
}
