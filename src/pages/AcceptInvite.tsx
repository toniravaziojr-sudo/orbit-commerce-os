import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, LogIn } from 'lucide-react';
import { toast } from 'sonner';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, refreshProfile } = useAuth();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'login-required'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;
    
    if (!token) {
      setStatus('error');
      setErrorMessage('Token de convite não encontrado');
      return;
    }

    if (!user) {
      setStatus('login-required');
      return;
    }

    // Accept the invitation
    const acceptInvite = async () => {
      try {
        const response = await supabase.functions.invoke('tenant-user-accept-invite', {
          body: { token },
        });

        if (response.error) throw response.error;
        if (!response.data?.success) {
          throw new Error(response.data?.error || 'Erro ao aceitar convite');
        }

        setStatus('success');
        toast.success('Convite aceito com sucesso!');
        
        // Refresh profile to get new tenant
        await refreshProfile();
        
        // Redirect after 2 seconds
        setTimeout(() => navigate('/'), 2000);
      } catch (error: any) {
        console.error('Error accepting invite:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Erro ao aceitar convite');
      }
    };

    acceptInvite();
  }, [token, user, authLoading]);

  const handleLogin = () => {
    // Save token in sessionStorage to use after login
    if (token) {
      sessionStorage.setItem('pending_invite_token', token);
    }
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Aceitar Convite</CardTitle>
          <CardDescription>
            Você foi convidado para fazer parte de uma equipe
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Processando convite...</p>
            </>
          )}

          {status === 'login-required' && (
            <>
              <LogIn className="h-12 w-12 text-primary" />
              <p className="text-center text-muted-foreground">
                Faça login ou crie uma conta para aceitar o convite
              </p>
              <Button onClick={handleLogin} className="w-full">
                Fazer Login
              </Button>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-center text-muted-foreground">
                Convite aceito! Redirecionando...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-destructive">{errorMessage}</p>
              <Button variant="outline" onClick={() => navigate('/')}>
                Ir para o início
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
