import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, CreditCard, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PlanInfo {
  plan_key: string;
  name: string;
  price_monthly_cents: number;
  price_annual_cents: number;
}

const formSchema = z.object({
  email: z.string().email('E-mail inválido'),
  owner_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  store_name: z.string().min(2, 'Nome da loja deve ter pelo menos 2 caracteres'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
  terms: z.boolean().refine(val => val === true, 'Você deve aceitar os termos'),
});

type FormData = z.infer<typeof formSchema>;

export default function StartInfo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [signupData, setSignupData] = useState<{
    email?: string;
    fullName?: string;
    businessName?: string;
    password?: string;
  } | null>(null);
  
  // Estado para usuário OAuth já autenticado
  const [existingUser, setExistingUser] = useState<{
    id: string;
    email: string;
    fullName?: string;
  } | null>(null);

  const planKey = searchParams.get('plan') || 'basico';
  const cycle = (searchParams.get('cycle') as 'monthly' | 'annual') || 'monthly';
  const testToken = searchParams.get('test_token') || undefined;

  // Verifica se é plano básico (gratuito, sem pagamento inicial)
  const isBasicPlan = planKey === 'basico';

  // Block test10 plan without valid test_token in URL
  const isTestPlanBlocked = planKey === 'test10' && !testToken;

  // Detectar se usuário já está autenticado (OAuth) - carregar dados
  useEffect(() => {
    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const user = session.user;
        setExistingUser({
          id: user.id,
          email: user.email || '',
          fullName: user.user_metadata?.full_name || user.user_metadata?.name || '',
        });
        console.log('[StartInfo] Detected existing OAuth user:', user.email);
      }
    }
    checkExistingSession();
  }, []);

  // Carregar dados do signup prévio (se veio do Auth.tsx)
  useEffect(() => {
    const storedData = sessionStorage.getItem('signup_data');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        setSignupData(parsed);
      } catch (e) {
        console.error('Error parsing signup data:', e);
      }
    }
  }, []);

  // Fetch plan info
  useEffect(() => {
    async function loadPlanInfo() {
      setPlanLoading(true);
      const { data, error } = await supabase
        .from('billing_plans')
        .select('plan_key, name, price_monthly_cents, price_annual_cents')
        .eq('plan_key', planKey)
        .eq('is_active', true)
        .single();

      if (!error && data) {
        setPlanInfo(data);
      }
      setPlanLoading(false);
    }
    loadPlanInfo();
  }, [planKey]);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const displayPrice = planInfo 
    ? (cycle === 'annual' ? planInfo.price_annual_cents : planInfo.price_monthly_cents) 
    : 0;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: signupData?.email || '',
      owner_name: signupData?.fullName || '',
      store_name: signupData?.businessName || '',
      phone: '',
      password: '',
      terms: false,
    },
  });

  // Atualizar form quando signupData ou existingUser carregar
  useEffect(() => {
    // Prioridade: existingUser (OAuth) > signupData (formulário normal)
    if (existingUser) {
      form.setValue('email', existingUser.email || '');
      form.setValue('owner_name', existingUser.fullName || '');
    } else if (signupData) {
      form.setValue('email', signupData.email || '');
      form.setValue('owner_name', signupData.fullName || '');
      form.setValue('store_name', signupData.businessName || '');
    }
  }, [signupData, existingUser, form]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);

    try {
      // Para plano básico: criar conta diretamente sem pagamento
      if (isBasicPlan) {
        // CASO 1: Usuário OAuth já está autenticado - apenas criar tenant
        if (existingUser) {
          console.log('[StartInfo] OAuth user detected - creating tenant only');
          
          // Gerar slug a partir do nome da loja
          const slug = data.store_name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
          
          // Usar RPC para criar tenant (já corrigida para usar pending_payment_method)
          const { data: newTenant, error: createError } = await supabase
            .rpc('create_tenant_for_user', {
              p_name: data.store_name,
              p_slug: slug,
            });
          
          if (createError) {
            if (createError.message?.includes('Slug already exists')) {
              toast({
                title: 'Nome em uso',
                description: 'Este nome de loja já está em uso. Escolha outro.',
                variant: 'destructive',
              });
              setLoading(false);
              return;
            }
            throw createError;
          }
          
          // Atualizar profile com nome se não tiver
          if (data.owner_name && data.owner_name !== existingUser.fullName) {
            await supabase
              .from('profiles')
              .update({ full_name: data.owner_name })
              .eq('id', existingUser.id);
          }
          
          // Limpar dados do signup
          sessionStorage.removeItem('signup_data');
          
          toast({
            title: 'Loja criada com sucesso!',
            description: 'Bem-vindo ao Comando Central!',
          });
          
          // Forçar refresh da página para recarregar dados do usuário
          window.location.href = '/getting-started';
          return;
        }
        
        // CASO 2: Novo usuário - criar conta completa
        const password = signupData?.password || data.password;
        
        if (!password || password.length < 6) {
          toast({
            title: 'Senha necessária',
            description: 'Por favor, informe uma senha com pelo menos 6 caracteres.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Chamar edge function para criar conta + tenant + subscription (basico)
        const response = await supabase.functions.invoke('start-create-basic-account', {
          body: {
            email: data.email,
            password: password,
            owner_name: data.owner_name,
            store_name: data.store_name,
            phone: data.phone || undefined,
            utm: Object.fromEntries(
              Array.from(searchParams.entries()).filter(([key]) => key.startsWith('utm_'))
            ),
          },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const result = response.data;

        if (!result.success) {
          throw new Error(result.error || 'Erro ao criar conta');
        }

        // Limpar dados do signup
        sessionStorage.removeItem('signup_data');

        // Fazer login automático
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: password,
        });

        if (signInError) {
          toast({
            title: 'Conta criada!',
            description: 'Faça login para continuar.',
          });
          navigate('/auth');
        } else {
          toast({
            title: 'Conta criada com sucesso!',
            description: 'Bem-vindo ao Comando Central!',
          });
          // Redirecionar para getting-started ou dashboard
          navigate('/getting-started');
        }

        return;
      }

      // Para planos pagos: criar checkout no Mercado Pago
      const response = await supabase.functions.invoke('start-create-checkout', {
        body: {
          plan_key: planKey,
          cycle: cycle,
          email: data.email,
          owner_name: data.owner_name,
          store_name: data.store_name,
          phone: data.phone || undefined,
          test_token: testToken,
          utm: Object.fromEntries(
            Array.from(searchParams.entries()).filter(([key]) => key.startsWith('utm_'))
          ),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar checkout');
      }

      // Limpar dados do signup
      sessionStorage.removeItem('signup_data');

      // Redirecionar para o Mercado Pago
      if (result.init_point) {
        window.location.href = result.init_point;
      } else {
        throw new Error('URL de pagamento não recebida');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível processar',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(`/start?plan=${planKey}&cycle=${cycle}`)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Seus dados</CardTitle>
            <CardDescription>
              {isBasicPlan 
                ? 'Preencha os dados para criar sua conta' 
                : 'Preencha os dados para continuar com o pagamento'}
            </CardDescription>
            {planInfo && !planLoading && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="outline">{planInfo.name}</Badge>
                  {isBasicPlan ? (
                    <span className="font-semibold text-lg text-green-600">
                      Gratuito
                    </span>
                  ) : (
                    <>
                      <span className="font-semibold text-lg">
                        {formatPrice(displayPrice)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        /{cycle === 'monthly' ? 'mês' : 'ano'}
                      </span>
                    </>
                  )}
                </div>
                {isBasicPlan && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Taxa de 2,5% sobre vendas
                  </p>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent>
            {isBasicPlan && (
              <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm">
                  Para publicar sua loja e usar todas as funcionalidades, você precisará cadastrar um cartão de crédito após criar a conta.
                </AlertDescription>
              </Alert>
            )}

            {isTestPlanBlocked ? (
              <div className="text-center py-8">
                <p className="text-destructive font-medium">Plano de teste indisponível</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Este plano requer um token de acesso válido.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/start')} 
                  className="mt-4"
                >
                  Ver planos disponíveis
                </Button>
              </div>
            ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="seu@email.com"
                          {...field}
                          disabled={!!existingUser}
                          className={existingUser ? 'bg-muted' : ''}
                        />
                      </FormControl>
                      {existingUser && (
                        <p className="text-xs text-muted-foreground">
                          Logado como {existingUser.email}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="owner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seu nome</FormLabel>
                      <FormControl>
                        <Input placeholder="João Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="store_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da sua loja</FormLabel>
                      <FormControl>
                        <Input placeholder="Minha Loja" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Campo de senha para plano básico (se não veio do signup E não é OAuth) */}
                {isBasicPlan && !signupData?.password && !existingUser && (
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Mínimo 6 caracteres"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          Li e aceito os{' '}
                          <a href="/termos" target="_blank" className="text-primary underline">
                            termos de uso
                          </a>{' '}
                          e a{' '}
                          <a href="/privacidade" target="_blank" className="text-primary underline">
                            política de privacidade
                          </a>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : isBasicPlan ? (
                    existingUser ? 'Criar minha loja' : 'Criar minha conta'
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Ir para pagamento
                    </>
                  )}
                </Button>
              </form>
            </Form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {isBasicPlan 
            ? '🔒 Seus dados estão protegidos'
            : 'Pagamento seguro via Mercado Pago'}
        </p>
      </div>
    </div>
  );
}
