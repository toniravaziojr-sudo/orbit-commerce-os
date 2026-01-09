import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

interface SessionStatus {
  id: string;
  status: string;
  plan_key: string;
  billing_cycle: string;
  email: string;
  store_name: string;
  has_tenant: boolean;
}

export default function StartPending() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [message, setMessage] = useState('Verificando status do pagamento...');
  const [nextStep, setNextStep] = useState<string>('wait');
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);

  const sessionId = searchParams.get('session');
  const paymentError = searchParams.get('error');

  const checkStatus = useCallback(async () => {
    if (!sessionId) {
      setError('Sessão não encontrada');
      setPolling(false);
      return;
    }

    try {
      const response = await supabase.functions.invoke('start-checkout-status', {
        body: { session_id: sessionId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error);
      }

      setSession(result.session);
      setMessage(result.message);
      setNextStep(result.next_step);

      // Parar polling se não precisa mais esperar
      if (result.next_step !== 'wait') {
        setPolling(false);
      }
    } catch (err: any) {
      console.error('Status check error:', err);
      setError(err.message);
      setPolling(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (paymentError) {
      setError('O pagamento não foi concluído. Tente novamente.');
      setPolling(false);
      return;
    }

    checkStatus();

    // Polling a cada 5 segundos
    const interval = setInterval(() => {
      if (polling) {
        checkStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [paymentError, checkStatus, polling]);

  const renderContent = () => {
    if (error) {
      return (
        <>
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-center mb-2">Ops!</CardTitle>
          <CardDescription className="text-center mb-4">{error}</CardDescription>
          <Button onClick={() => navigate('/start')} className="w-full">
            Tentar novamente
          </Button>
        </>
      );
    }

    switch (nextStep) {
      case 'wait':
        return (
          <>
            <div className="flex justify-center mb-4">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            </div>
            <CardTitle className="text-center mb-2">Aguardando confirmação</CardTitle>
            <CardDescription className="text-center mb-4">{message}</CardDescription>
            <Alert>
              <AlertDescription className="text-center text-sm">
                Estamos verificando seu pagamento. Isso pode levar alguns instantes.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              onClick={checkStatus}
              className="w-full mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar agora
            </Button>
          </>
        );

      case 'check_email':
        return (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-center mb-2">Pagamento confirmado!</CardTitle>
            <CardDescription className="text-center mb-4">{message}</CardDescription>
            <Alert className="mb-4">
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Enviamos um e-mail para <strong>{session?.email}</strong> com o link para criar sua conta.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground text-center">
              Não recebeu? Verifique sua pasta de spam ou aguarde alguns minutos.
            </p>
          </>
        );

      case 'login':
        return (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-center mb-2">Tudo pronto!</CardTitle>
            <CardDescription className="text-center mb-4">{message}</CardDescription>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Fazer login
            </Button>
          </>
        );

      case 'retry':
        return (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-center mb-2">Pagamento não concluído</CardTitle>
            <CardDescription className="text-center mb-4">{message}</CardDescription>
            <Button onClick={() => navigate('/start')} className="w-full">
              Tentar novamente
            </Button>
          </>
        );

      case 'restart':
        return (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-muted-foreground" />
            </div>
            <CardTitle className="text-center mb-2">Sessão expirada</CardTitle>
            <CardDescription className="text-center mb-4">{message}</CardDescription>
            <Button onClick={() => navigate('/start')} className="w-full">
              Iniciar novo checkout
            </Button>
          </>
        );

      default:
        return (
          <>
            <div className="flex justify-center mb-4">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            </div>
            <CardTitle className="text-center mb-2">Processando...</CardTitle>
            <CardDescription className="text-center">{message}</CardDescription>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader />
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </div>
  );
}
