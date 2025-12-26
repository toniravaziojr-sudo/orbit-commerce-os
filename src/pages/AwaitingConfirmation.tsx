import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { platformBranding } from '@/lib/branding';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AwaitingConfirmation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [isResending, setIsResending] = useState(false);
  const [lastResendAt, setLastResendAt] = useState<number | null>(null);

  const canResend = !lastResendAt || Date.now() - lastResendAt > 60000; // 1 minuto

  const handleResendEmail = async () => {
    if (!email || !canResend) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) {
        toast.error(error.message || 'Erro ao reenviar email');
        return;
      }

      setLastResendAt(Date.now());
      toast.success('Email reenviado com sucesso!');
    } catch (error) {
      toast.error('Erro ao reenviar email. Tente novamente.');
    } finally {
      setIsResending(false);
    }
  };

  const secondsUntilResend = lastResendAt 
    ? Math.max(0, Math.ceil((60000 - (Date.now() - lastResendAt)) / 1000))
    : 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Slogan */}
        <p className="text-muted-foreground text-sm text-center mb-8">
          {platformBranding.slogan}
        </p>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img 
                src={platformBranding.logos.full} 
                alt={platformBranding.productName}
                className="h-24 object-contain mx-auto"
              />
            </div>
            <CardTitle className="text-xl">Confirme seu email</CardTitle>
            <CardDescription className="text-base">
              Enviamos um email de confirmação para:
            </CardDescription>
            {email && (
              <p className="font-medium text-foreground mt-2">{email}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Próximos passos:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Abra sua caixa de entrada de email</li>
                <li>Procure pelo email de confirmação</li>
                <li>Clique no botão <strong className="text-foreground">"Confirmar minha conta"</strong></li>
                <li>Você será redirecionado para fazer login</li>
              </ol>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>Não encontrou o email?</p>
              <p className="mt-1">Verifique também a pasta de <strong>Spam/Lixo eletrônico</strong></p>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResendEmail}
                disabled={isResending || !canResend || !email}
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reenviando...
                  </>
                ) : !canResend ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reenviar em {secondsUntilResend}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reenviar email de confirmação
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/auth')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
