import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const formSchema = z.object({
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof formSchema>;

export default function CompleteSignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState<string>('');

  const token = searchParams.get('token');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setTokenValid(false);
        setValidating(false);
        return;
      }

      try {
        // Verificar status da sessão via edge function
        const response = await supabase.functions.invoke('start-checkout-status', {
          body: { session_id: token },
        });

        // Se não encontrou por session_id, pode ser o token de complete-signup
        // Vamos tentar o complete-signup com uma verificação prévia
        setTokenValid(true);
        if (response.data?.session?.email) {
          setEmail(response.data.session.email);
        }
      } catch (error) {
        console.error('Token validation error:', error);
        setTokenValid(true); // Deixar o complete-signup validar
      } finally {
        setValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const onSubmit = async (data: FormData) => {
    if (!token) return;

    setLoading(true);

    try {
      const response = await supabase.functions.invoke('complete-signup', {
        body: {
          token: token,
          password: data.password,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar conta');
      }

      setSuccess(true);
      setEmail(result.email);

      toast({
        title: 'Conta criada!',
        description: 'Você será redirecionado para o login.',
      });

      // Fazer login automático
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: data.password,
      });

      if (signInError) {
        // Se falhar login automático, redirecionar para login
        setTimeout(() => navigate('/auth'), 2000);
      } else {
        // Redirecionar para getting-started
        setTimeout(() => navigate('/getting-started'), 1000);
      }
    } catch (error: any) {
      console.error('Complete signup error:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível criar a conta',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Validando link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <XCircle className="h-16 w-16 text-destructive mb-4" />
              <CardTitle className="text-center mb-2">Link inválido ou expirado</CardTitle>
              <CardDescription className="text-center mb-4">
                Este link não é válido ou já expirou. Se você já criou sua conta, faça login.
              </CardDescription>
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={() => navigate('/start')} className="flex-1">
                  Novo cadastro
                </Button>
                <Button onClick={() => navigate('/auth')} className="flex-1">
                  Fazer login
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <CardTitle className="text-center mb-2">Conta criada com sucesso!</CardTitle>
              <CardDescription className="text-center mb-4">
                Você está sendo redirecionado...
              </CardDescription>
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Crie sua senha</CardTitle>
          <CardDescription>
            {email ? (
              <>Conta para <strong>{email}</strong></>
            ) : (
              'Defina uma senha para acessar sua conta'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Mínimo 8 caracteres"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
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
                    <FormLabel>Confirme a senha</FormLabel>
                    <FormControl>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Digite novamente"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  'Criar conta'
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-4">
            <Alert>
              <AlertDescription className="text-sm">
                Sua senha deve ter pelo menos 8 caracteres. Recomendamos usar letras, números e símbolos.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
