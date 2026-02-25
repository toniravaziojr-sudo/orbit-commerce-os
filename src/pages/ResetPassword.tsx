import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { platformBranding } from '@/lib/branding';
import { LogoFull } from '@/components/branding/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { Loader2, Lock, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  // Check if user has a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      
      if (!session) {
        console.log('[ResetPassword] No session found, waiting for PASSWORD_RECOVERY event');
      }
    };
    checkSession();

    // Listen for auth state changes (user clicking reset link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ResetPassword] Auth event:', event);
      if (event === 'PASSWORD_RECOVERY') {
        setHasSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });
      
      if (error) {
        if (error.message.includes('New password should be different')) {
          toast.error('A nova senha deve ser diferente da anterior');
        } else if (error.message.includes('session')) {
          toast.error('Sessão expirada. Solicite um novo link de recuperação.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      setIsSuccess(true);
      toast.success('Senha alterada com sucesso!');
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      toast.error('Erro ao alterar senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo + Slogan */}
        <div className="flex flex-col items-center mb-8">
          <LogoFull iconSize={56} layout="vertical" className="mb-4" />
          <p className="text-muted-foreground text-sm text-center">
            {platformBranding.slogan}
          </p>
        </div>

        <Card className="shadow-lg border-border/50">
          {isSuccess ? (
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Senha Alterada!</h3>
                  <p className="text-muted-foreground">
                    Sua senha foi alterada com sucesso. Você será redirecionado em instantes...
                  </p>
                </div>
              </div>
            </CardContent>
          ) : hasSession === false ? (
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Lock className="h-8 w-8 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Link Inválido ou Expirado</h3>
                  <p className="text-muted-foreground">
                    O link de recuperação é inválido ou expirou. Solicite um novo link.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/auth')}
                >
                  Voltar ao login
                </Button>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-xl">Nova Senha</CardTitle>
                <CardDescription>
                  Digite sua nova senha abaixo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nova Senha</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Mínimo 6 caracteres"
                                className="pl-10 pr-10"
                                disabled={isLoading || hasSession === null}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Nova Senha</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="password"
                                placeholder="Repita a senha"
                                className="pl-10"
                                disabled={isLoading || hasSession === null}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={isLoading || hasSession === null}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Alterar Senha
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
