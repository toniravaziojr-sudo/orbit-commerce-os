// =============================================
// CREATE ACCOUNT SECTION - Account creation on Thank You page
// Offers account creation after order is placed
// =============================================

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, UserPlus, LogIn, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CreateAccountSectionProps {
  customerEmail: string;
  customerName?: string;
  tenantSlug?: string;
}

type AccountMode = 'create' | 'login' | 'success';

export function CreateAccountSection({ customerEmail, customerName, tenantSlug }: CreateAccountSectionProps) {
  const [mode, setMode] = useState<AccountMode>('create');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateAccount = async () => {
    setError(null);
    
    if (!password) {
      setError('Digite uma senha');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: customerEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/conta`,
          data: {
            full_name: customerName || '',
          }
        }
      });

      if (signUpError) {
        // Check if user already exists
        if (signUpError.message.includes('already registered') || signUpError.message.includes('User already registered')) {
          setError('Este e-mail já possui uma conta. Faça login em vez de criar uma nova conta.');
          setMode('login');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      setMode('success');
      toast.success('Conta criada! Verifique seu e-mail para confirmar.');
    } catch (err) {
      setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setError(null);
    
    if (!password) {
      setError('Digite sua senha');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: customerEmail,
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Senha incorreta. Tente novamente ou recupere sua senha.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      setMode('success');
      toast.success('Login realizado com sucesso!');
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(customerEmail, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });

      if (error) {
        setError(error.message);
        return;
      }

      toast.success('E-mail de recuperação enviado!');
    } catch (err) {
      setError('Erro ao enviar e-mail de recuperação.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (mode === 'success') {
    return (
      <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-medium text-green-700 dark:text-green-300">Conta ativa!</p>
            <p className="text-sm text-green-600 dark:text-green-400">
              Acesse "Minha Conta" para acompanhar seus pedidos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Login mode
  if (mode === 'login') {
    return (
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-start gap-3">
          <LogIn className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-medium">Entrar na sua conta</h3>
            <p className="text-sm text-muted-foreground">
              Este e-mail já possui conta cadastrada.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div>
            <Label htmlFor="email-display">E-mail</Label>
            <Input id="email-display" value={customerEmail} disabled className="bg-muted" />
          </div>
          
          <div>
            <Label htmlFor="login-password">Senha</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleLogin} disabled={isLoading} className="flex-1">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </div>

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isLoading}
            className="text-sm text-primary hover:underline w-full text-center"
          >
            Esqueci minha senha
          </button>
        </div>
      </div>
    );
  }

  // Create account mode (default)
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-start gap-3">
        <UserPlus className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-medium">Crie sua conta</h3>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus pedidos e ganhe benefícios exclusivos.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div>
          <Label htmlFor="email-display">E-mail</Label>
          <Input id="email-display" value={customerEmail} disabled className="bg-muted" />
        </div>
        
        <div>
          <Label htmlFor="create-password">Senha *</Label>
          <div className="relative">
            <Input
              id="create-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <Label htmlFor="confirm-password">Confirmar senha *</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a senha"
          />
        </div>

        <Button onClick={handleCreateAccount} disabled={isLoading} className="w-full">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Criar conta
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Já tem uma conta?{' '}
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className="text-primary hover:underline"
          >
            Faça login
          </button>
        </p>
      </div>
    </div>
  );
}
