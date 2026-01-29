import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import logoHorizontal from '@/assets/logo-horizontal.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, User, ArrowLeft, Building2 } from 'lucide-react';
import { generateSlug } from '@/lib/slugPolicy';
import { usePlanFromUrl, savePlanSelectionToStorage } from '@/hooks/usePlanFromUrl';

// Schemas de validação
const loginSchema = z.object({
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

// Schema completo para signup normal (owner criando loja)
const signUpSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  businessName: z.string().min(2, 'Nome do negócio deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

// Schema simplificado para signup de convidado (não cria loja)
const inviteSignUpSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const resetPasswordSchema = z.object({
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;
type InviteSignUpFormData = z.infer<typeof inviteSignUpSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp, resetPassword, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    // Detectar tab inicial via URL (para links diretos como /auth?tab=signup)
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    return urlTab === 'signup' ? 'signup' : 'login';
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Detectar modo convite (usuário convidado não cria loja)
  const isInviteMode = !!sessionStorage.getItem('pending_invite_token');
  
  // Capturar plano e UTMs da URL
  const planParams = usePlanFromUrl();
  
  // Salvar plano e UTMs no storage quando presentes na URL
  // E também definir tab inicial baseado na URL e mostrar erros de OAuth
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    const errorParam = searchParams.get('error');
    
    // Mostrar erro se veio de bloqueio de OAuth (usuário novo tentando login)
    if (errorParam === 'no_account') {
      toast.error('Esta conta não existe. Por favor, crie uma conta primeiro.');
      setActiveTab('signup');
      // Limpar o parâmetro de erro da URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      window.history.replaceState({}, '', newUrl.toString());
      return;
    }
    
    if (urlTab === 'signup') {
      setActiveTab('signup');
    }
    
    if (planParams.plan && !isInviteMode) {
      savePlanSelectionToStorage(planParams);
      // Se tem plano selecionado, ir direto para signup
      setActiveTab('signup');
    }
  }, [planParams.plan, isInviteMode, searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      // Check for pending invite token first
      const pendingInviteToken = sessionStorage.getItem('pending_invite_token');
      if (pendingInviteToken) {
        navigate('/accept-invite', { replace: true });
        return;
      }
      
      // Verificar se é um signup via Google (novo usuário)
      // O oauth_intent ainda pode estar no localStorage se acabou de retornar do OAuth
      const oauthIntent = localStorage.getItem('oauth_intent');
      if (oauthIntent === 'signup') {
        // Não limpar aqui - deixar o useAuth lidar
        // Redirecionar direto para /start para criar loja
        console.log('[Auth] Google signup detected - redirecting to /start');
        navigate('/start', { replace: true });
        return;
      }
      
      // Se tem plano salvo, redirecionar para billing
      const storedPlan = sessionStorage.getItem('selected_plan');
      if (storedPlan) {
        navigate('/settings/billing', { replace: true });
      } else {
        const redirectTo = searchParams.get('redirect') || '/';
        navigate(redirectTo, { replace: true });
      }
    }
  }, [user, authLoading, navigate, searchParams]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', businessName: '', email: '', password: '', confirmPassword: '' },
  });

  // Form simplificado para convite (sem businessName)
  const inviteSignUpForm = useForm<InviteSignUpFormData>({
    resolver: zodResolver(inviteSignUpSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '' },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const { error } = await signIn(data.email, data.password);
      
      if (error) {
        const errorMsg = error.message?.toLowerCase() || '';
        
        // Detectar diferentes variações de erro de email não confirmado
        if (
          errorMsg.includes('email not confirmed') ||
          errorMsg.includes('email_not_confirmed') ||
          errorMsg.includes('confirm your email') ||
          errorMsg.includes('email confirmation')
        ) {
          setLoginError('Por favor, confirme seu email');
        } else if (
          errorMsg.includes('invalid login credentials') ||
          errorMsg.includes('invalid_credentials') ||
          errorMsg.includes('wrong password') ||
          errorMsg.includes('invalid password')
        ) {
          setLoginError('Login ou senha incorreto, tente novamente');
        } else {
          setLoginError('Login ou senha incorreto, tente novamente');
        }
        return;
      }

      toast.success('Login realizado com sucesso!');
    } catch (error) {
      setLoginError('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (data: SignUpFormData) => {
    setIsLoading(true);
    try {
      // NOVO FLUXO UNIFICADO: Redirecionar para seleção de planos
      // Salvar dados do signup para usar após seleção do plano
      sessionStorage.setItem('signup_data', JSON.stringify({
        email: data.email,
        fullName: data.fullName,
        businessName: data.businessName,
        password: data.password,
      }));
      
      toast.success('Ótimo! Agora escolha seu plano para continuar.');
      
      // Redirecionar para seleção de planos
      navigate('/start');
    } catch (error) {
      toast.error('Erro ao processar cadastro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler simplificado para signup de convidado (não cria tenant)
  const handleInviteSignUp = async (data: InviteSignUpFormData) => {
    setIsLoading(true);
    try {
      // Criar conta do usuário SEM criar tenant
      const { error } = await signUp(data.email, data.password, data.fullName);
      
      if (error) {
        if (error.message.includes('User already registered')) {
          toast.error('Este email já está cadastrado. Tente fazer login.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Aguardar a sessão ser criada (auto-confirm ativo)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData?.session?.user) {
        // Persist the full name to profiles table
        const userId = sessionData.session.user.id;
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: data.fullName })
          .eq('id', userId);
        
        if (profileError) {
          console.error('Error updating profile with name:', profileError);
          // Don't block the flow, just log
        }
        
        toast.success('Conta criada! Aceitando convite...');
        // Redirecionar para accept-invite (onde o token ainda está no sessionStorage)
        navigate('/accept-invite', { replace: true });
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    } catch (error) {
      toast.error('Erro ao criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para LOGIN com Google (apenas usuários existentes)
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      // Marcar intenção como LOGIN - usa localStorage para persistir após redirect
      localStorage.setItem('oauth_intent', 'login');
      
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: `${window.location.origin}/auth`,
      });
      
      if (result.error) {
        localStorage.removeItem('oauth_intent');
        toast.error('Erro ao fazer login com Google. Tente novamente.');
        setIsLoading(false);
      }
      // Se redirected, o usuário foi redirecionado para o Google
    } catch (error) {
      localStorage.removeItem('oauth_intent');
      toast.error('Erro ao fazer login com Google. Tente novamente.');
      setIsLoading(false);
    }
  };

  // Handler para SIGNUP com Google (cria novo usuário)
  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      // Marcar intenção como SIGNUP - usa localStorage para persistir após redirect
      localStorage.setItem('oauth_intent', 'signup');
      
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: `${window.location.origin}/auth`,
      });
      
      if (result.error) {
        localStorage.removeItem('oauth_intent');
        toast.error('Erro ao criar conta com Google. Tente novamente.');
        setIsLoading(false);
      }
      // Se redirected, o usuário foi redirecionado para o Google
    } catch (error) {
      localStorage.removeItem('oauth_intent');
      toast.error('Erro ao criar conta com Google. Tente novamente.');
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await resetPassword(data.email);
      
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setShowResetPassword(false);
    } catch (error) {
      toast.error('Erro ao enviar email de recuperação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo centralizada */}
        <div className="flex flex-col items-center mb-8">
          <img src={logoHorizontal} alt="Comando Central" className="h-12" />
        </div>

        <Card className="shadow-lg border-border/50">
          {showResetPassword ? (
            <>
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowResetPassword(false)}
                    className="h-8 w-8"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-xl">Recuperar Senha</CardTitle>
                </div>
                <CardDescription>
                  Digite seu email para receber um link de recuperação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...resetPasswordForm}>
                  <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-4">
                    <FormField
                      control={resetPasswordForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="email"
                                placeholder="seu@email.com"
                                className="pl-10"
                                disabled={isLoading}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enviar Link de Recuperação
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-xl">
                  {isInviteMode ? 'Aceitar Convite' : 'Bem-vindo'}
                </CardTitle>
                <CardDescription>
                  {isInviteMode 
                    ? 'Entre ou crie uma conta para aceitar o convite' 
                    : 'Entre na sua conta ou crie uma nova'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">Entrar</TabsTrigger>
                    <TabsTrigger value="signup">Criar Conta</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-4">
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    {...field}
                                    type="email"
                                    placeholder="seu@email.com"
                                    className="pl-10"
                                    disabled={isLoading}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Senha</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    {...field}
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-10"
                                    disabled={isLoading}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading}>
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Entrar
                        </Button>
                        
                        {loginError && (
                          <p className="text-sm text-destructive text-center mt-3">
                            {loginError}
                          </p>
                        )}
                      </form>
                    </Form>

                    <div className="text-center">
                      <Button
                        variant="link"
                        onClick={() => setShowResetPassword(true)}
                        className="text-sm text-muted-foreground"
                      >
                        Esqueceu sua senha?
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4">
                    {isInviteMode ? (
                      // Formulário simplificado para convidados (sem businessName)
                      <Form {...inviteSignUpForm}>
                        <form onSubmit={inviteSignUpForm.handleSubmit(handleInviteSignUp)} className="space-y-4">
                          <div className="p-3 bg-primary/10 rounded-md border border-primary/20 mb-4">
                            <p className="text-sm text-center text-muted-foreground">
                              Você está aceitando um convite para fazer parte de uma equipe.
                            </p>
                          </div>
                          <FormField
                            control={inviteSignUpForm.control}
                            name="fullName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Seu Nome</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      placeholder="Seu nome completo"
                                      className="pl-10"
                                      disabled={isLoading}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={inviteSignUpForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      type="email"
                                      placeholder="seu@email.com"
                                      className="pl-10"
                                      disabled={isLoading}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={inviteSignUpForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Senha</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      type="password"
                                      placeholder="••••••••"
                                      className="pl-10"
                                      disabled={isLoading}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={inviteSignUpForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirmar Senha</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      type="password"
                                      placeholder="••••••••"
                                      className="pl-10"
                                      disabled={isLoading}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Criar Conta e Aceitar Convite
                          </Button>
                        </form>
                      </Form>
                    ) : (
                      // Formulário completo para owners (com businessName)
                      <Form {...signUpForm}>
                        <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                          <FormField
                            control={signUpForm.control}
                            name="fullName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Seu Nome</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      placeholder="Nome do responsável"
                                      className="pl-10"
                                      disabled={isLoading}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={signUpForm.control}
                            name="businessName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome do Negócio</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      placeholder="Minha Loja Online"
                                      className="pl-10"
                                      disabled={isLoading}
                                    />
                                  </div>
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Será usado para criar sua loja: {field.value ? `${generateSlug(field.value)}.shops.comandocentral.com.br` : 'sua-loja.shops.comandocentral.com.br'}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={signUpForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      type="email"
                                      placeholder="seu@email.com"
                                      className="pl-10"
                                      disabled={isLoading}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={signUpForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Senha</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      type="password"
                                      placeholder="••••••••"
                                      className="pl-10"
                                      disabled={isLoading}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={signUpForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirmar Senha</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      type="password"
                                      placeholder="••••••••"
                                      className="pl-10"
                                      disabled={isLoading}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Criar Conta
                          </Button>
                        </form>
                      </Form>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={activeTab === 'login' ? handleGoogleLogin : handleGoogleSignup}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {activeTab === 'login' ? 'Entrar com Google' : 'Criar conta com Google'}
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
