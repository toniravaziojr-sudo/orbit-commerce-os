import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';

// ============================================================================
// OAuth in-progress signal — sobrevive a remontagens do React após redirect
// ----------------------------------------------------------------------------
// Padrões reaproveitados (docs):
//   §4.5 (base técnica) — "Lado emissor + lado receptor": toda operação que
//        sai do app via redirect precisa de guarda explícita no destino.
//   §10.6 (base técnica) — Estado de operação em curso precisa viver fora
//        do ciclo de render.
//
// Contrato: localStorage.oauth_in_progress = timestamp (string).
// Auto-expira em 60s (timeout de segurança contra abandono).
// ============================================================================
const OAUTH_IN_PROGRESS_KEY = 'oauth_in_progress';
const OAUTH_IN_PROGRESS_TIMEOUT_MS = 60_000;

export function markOAuthInProgress(): void {
  try {
    localStorage.setItem(OAUTH_IN_PROGRESS_KEY, Date.now().toString());
  } catch {
    // storage indisponível — fail-safe (UI cai no caminho normal)
  }
}

export function clearOAuthInProgress(): void {
  try {
    localStorage.removeItem(OAUTH_IN_PROGRESS_KEY);
  } catch {
    // noop
  }
}

export function isOAuthInProgress(): boolean {
  try {
    const raw = localStorage.getItem(OAUTH_IN_PROGRESS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) {
      clearOAuthInProgress();
      return false;
    }
    if (Date.now() - ts > OAUTH_IN_PROGRESS_TIMEOUT_MS) {
      clearOAuthInProgress();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  current_tenant_id: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  tenant_id: string;
  role: 'owner' | 'admin' | 'operator' | 'support' | 'finance' | 'viewer';
  user_type?: 'owner' | 'manager' | 'editor' | 'attendant' | 'assistant' | 'viewer';
  permissions?: Record<string, boolean | Record<string, boolean>>;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  currentTenant: Tenant | null;
  userRoles: UserRole[];
  tenants: Tenant[];
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (intent?: 'login' | 'signup') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  setCurrentTenant: (tenantId: string) => Promise<void>;
  hasRole: (role: UserRole['role']) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile | null;
  };

  const fetchUserRoles = async (userId: string) => {
    console.log('[useAuth] fetchUserRoles called for userId:', userId);
    const { data, error } = await supabase
      .from('user_roles')
      .select('id, user_id, tenant_id, role, user_type, permissions')
      .eq('user_id', userId);

    if (error) {
      console.error('[useAuth] Error fetching user roles:', error);
      return [];
    }
    console.log('[useAuth] fetchUserRoles result:', data?.length, 'roles found', data);
    // Ensure permissions is always an object
    return (data || []).map(role => ({
      ...role,
      permissions: role.permissions || {},
    })) as UserRole[];
  };

  const fetchTenants = async (roles: UserRole[]) => {
    console.log('[useAuth] fetchTenants called with', roles.length, 'roles');
    if (roles.length === 0) {
      console.log('[useAuth] No roles, returning empty tenants');
      return [];
    }
    
    const tenantIds = [...new Set(roles.map(r => r.tenant_id))];
    console.log('[useAuth] Fetching tenants for IDs:', tenantIds);
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .in('id', tenantIds);

    if (error) {
      console.error('[useAuth] Error fetching tenants:', error);
      return [];
    }
    console.log('[useAuth] fetchTenants result:', data?.length, 'tenants found');
    return data as Tenant[];
  };

  const fetchCurrentTenant = async (tenantId: string) => {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching current tenant:', error);
      return null;
    }
    return data as Tenant | null;
  };

  const loadUserData = async (userId: string): Promise<boolean> => {
    // ============================================================
    // ONDA 6 — Performance: bootstrap em 1 round-trip via RPC
    // Substitui 3 chamadas (profile + roles + tenants) por 1.
    // Em caso de falha (ex: RPC indisponível durante deploy),
    // cai no caminho clássico paralelo como fallback seguro.
    // ============================================================
    let profileData: Profile | null = null;
    let rolesData: UserRole[] = [];
    let tenantsData: Tenant[] = [];

    try {
      const { data: bootstrap, error: bootstrapError } = await supabase
        .rpc('get_user_bootstrap');

      if (bootstrapError) throw bootstrapError;

      const payload = bootstrap as any;
      profileData = (payload?.profile ?? null) as Profile | null;
      rolesData = ((payload?.roles ?? []) as any[]).map((r) => ({
        ...r,
        permissions: r.permissions || {},
      })) as UserRole[];
      tenantsData = (payload?.tenants ?? []) as Tenant[];
    } catch (rpcErr) {
      console.warn('[useAuth] get_user_bootstrap falhou, usando fallback paralelo:', rpcErr);
      const [pData, rData] = await Promise.all([
        fetchProfile(userId),
        fetchUserRoles(userId),
      ]);
      profileData = pData;
      rolesData = rData;
      tenantsData = await fetchTenants(rData);
    }

    // Se não existe profile, o usuário foi deletado - fazer logout
    if (!profileData) {
      console.log('Profile not found, signing out stale session');
      await supabase.auth.signOut();
      return false;
    }

    setProfile(profileData);
    setUserRoles(rolesData);
    setTenants(tenantsData);

    if (profileData?.current_tenant_id) {
      const tenant = tenantsData.find(t => t.id === profileData.current_tenant_id);
      if (tenant) {
        setCurrentTenantState(tenant);
      } else if (tenantsData.length > 0) {
        await setCurrentTenant(tenantsData[0].id);
      }
    } else if (tenantsData.length > 0) {
      await setCurrentTenant(tenantsData[0].id);
    }
    return true;
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserData(user.id);
    }
  };

  // Função para verificar e bloquear login de usuários novos via OAuth
  const handleOAuthLoginValidation = async (userId: string): Promise<boolean> => {
    const oauthIntent = localStorage.getItem('oauth_intent');
    
    // Se a intenção era LOGIN (não signup), verificar se usuário tem conta
    if (oauthIntent === 'login') {
      localStorage.removeItem('oauth_intent'); // Limpar apenas para login
      
      const { data: roles } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      
      if (!roles || roles.length === 0) {
        // Usuário novo tentando fazer LOGIN - bloquear
        console.log('[useAuth] Blocking new user trying to login without account');
        await supabase.auth.signOut();
        // Redirecionar para auth com mensagem de erro via URL
        window.location.href = '/auth?tab=signup&error=no_account';
        return false;
      }
    }
    // NÃO limpar oauth_intent para 'signup' aqui - deixar o Auth.tsx ler e redirecionar para /start
    // O intent será limpo após o redirecionamento
    return true;
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Anti-regressão: refresh token expirado/corrompido em visitante anônimo
        // gera ciclo permanente de 403 bad_jwt em /user. Quando o GoTrue sinaliza
        // TOKEN_REFRESHED sem sessão (refresh falhou), limpar storage local
        // para encerrar o ciclo. Não faz signOut global (escopo 'local' apenas).
        if (event === 'TOKEN_REFRESHED' && !newSession) {
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          setSession(null);
          setUser(null);
          setProfile(null);
          setCurrentTenantState(null);
          setUserRoles([]);
          setTenants([]);
          setIsLoading(false);
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Anti-regressão: registrar SIGNED_IN via OAuth em auth_login_attempts.
        // signInWithPassword já loga em signIn(); aqui cobrimos OAuth (Google),
        // cujo sucesso real só chega depois do redirect via onAuthStateChange.
        if (event === 'SIGNED_IN' && newSession?.user) {
          const provider = (newSession.user.app_metadata as any)?.provider;
          if (provider && provider !== 'email') {
            try {
              supabase.functions.invoke('log-login-attempt', {
                body: {
                  email: newSession.user.email ?? null,
                  success: true,
                  failure_reason: null,
                  user_id: newSession.user.id,
                },
              }).catch(() => {});
            } catch {
              // auditoria nunca bloqueia login
            }
          }
        }

        // Defer data loading to prevent deadlock
        if (newSession?.user) {
          setTimeout(async () => {
            // Verificar se é OAuth login de usuário novo (bloquear)
            const isValid = await handleOAuthLoginValidation(newSession.user.id);
            if (!isValid) {
              setUser(null);
              setSession(null);
              setIsLoading(false);
              clearOAuthInProgress();
              return;
            }
            
            const valid = await loadUserData(newSession.user.id);
            if (!valid) {
              // Sessão inválida, já fez logout
              setUser(null);
              setSession(null);
            }
            setIsLoading(false);
            // Bootstrap concluído após callback OAuth — libera UI receptora
            clearOAuthInProgress();
          }, 0);
        } else {
          setProfile(null);
          setCurrentTenantState(null);
          setUserRoles([]);
          setTenants([]);
          setIsLoading(false);
          // Sem sessão (ex: SIGNED_OUT) também limpa flag, evita travar UI
          clearOAuthInProgress();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession }, error }) => {
      // Anti-regressão: se houver erro de refresh (bad_jwt) no bootstrap,
      // limpar storage local para encerrar o ciclo de retries do GoTrue.
      if (error) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        setSession(null);
        setUser(null);
        setIsLoading(false);
        clearOAuthInProgress();
        return;
      }

      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        // Verificar se é OAuth login de usuário novo (bloquear)
        const isValid = await handleOAuthLoginValidation(existingSession.user.id);
        if (!isValid) {
          setUser(null);
          setSession(null);
          setIsLoading(false);
          clearOAuthInProgress();
          return;
        }
        
        const valid = await loadUserData(existingSession.user.id);
        if (!valid) {
          setUser(null);
          setSession(null);
        }
        setIsLoading(false);
        clearOAuthInProgress();
      } else {
        setIsLoading(false);
        clearOAuthInProgress();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    // Após confirmar email, redireciona para o auth com parâmetro confirmed
    // Isso permite que o usuário faça login automaticamente
    const redirectUrl = `${window.location.origin}/auth?confirmed=true`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    return { error: error as Error | null };
  };

  const logLoginAttempt = (payload: {
    email?: string | null;
    success: boolean;
    failure_reason?: string | null;
    user_id?: string | null;
  }) => {
    // Fire-and-forget: nunca bloqueia o fluxo de login
    try {
      supabase.functions.invoke('log-login-attempt', { body: payload }).catch(() => {});
    } catch {
      // ignora qualquer erro de auditoria
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    logLoginAttempt({
      email,
      success: !error,
      failure_reason: error?.message ?? null,
      user_id: data?.user?.id ?? null,
    });

    return { error: error as Error | null };
  };

  // Fonte única para login Google. Toda tela DEVE chamar este método —
  // nunca `lovable.auth.signInWithOAuth` direto (regra anti-regressão da
  // base técnica linha 1313: "Proibido adicionar log de login por provider
  // em código de tela — sempre no useAuth, fonte única").
  // O parâmetro `intent` encapsula o storage de oauth_intent que antes
  // ficava espalhado em Auth.tsx.
  const signInWithGoogle = async (intent: 'login' | 'signup' = 'login') => {
    // Marca operação em curso ANTES do redirect — sobrevive à remontagem
    // do React no retorno (padrão §10.6 da base técnica).
    markOAuthInProgress();
    try {
      localStorage.setItem('oauth_intent', intent);
    } catch {
      // storage indisponível — segue o fluxo
    }

    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: `${window.location.origin}/auth`,
      });

      // Erro imediato (antes do redirect) — limpar bandeira e auditar
      if (result.error) {
        clearOAuthInProgress();
        try { localStorage.removeItem('oauth_intent'); } catch { /* noop */ }
        logLoginAttempt({
          success: false,
          failure_reason: `oauth_google: ${result.error.message ?? 'unknown'}`,
        });
        return { error: result.error instanceof Error ? result.error : new Error(String(result.error)) };
      }

      // result.redirected === true → navegador vai para Google; nada a fazer.
      // Caminho síncrono (tokens já vieram) é tratado pelo onAuthStateChange.
      return { error: null };
    } catch (err) {
      clearOAuthInProgress();
      try { localStorage.removeItem('oauth_intent'); } catch { /* noop */ }
      const error = err instanceof Error ? err : new Error(String(err));
      logLoginAttempt({
        success: false,
        failure_reason: `oauth_google_exception: ${error.message}`,
      });
      return { error };
    }
  };

  const signOut = async () => {
    // Limpar flags de latch pattern no logout para próxima sessão começar fresh
    sessionStorage.removeItem('auth_initial_load_complete');
    sessionStorage.removeItem('auth_page_rendered');
    clearOAuthInProgress();
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    // Redireciona para a página de reset de senha do admin
    // Após redefinir senha, vai para o dashboard (/)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };

  const setCurrentTenant = async (tenantId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ current_tenant_id: tenantId })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating current tenant:', error);
      return;
    }

    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setCurrentTenantState(tenant);
      setProfile(prev => prev ? { ...prev, current_tenant_id: tenantId } : null);
    } else {
      const fetchedTenant = await fetchCurrentTenant(tenantId);
      if (fetchedTenant) {
        setCurrentTenantState(fetchedTenant);
        setTenants(prev => [...prev, fetchedTenant]);
        setProfile(prev => prev ? { ...prev, current_tenant_id: tenantId } : null);
      }
    }
  };

  const hasRole = (role: UserRole['role']) => {
    if (!currentTenant) return false;
    return userRoles.some(r => r.tenant_id === currentTenant.id && r.role === role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        currentTenant,
        userRoles,
        tenants,
        isLoading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        setCurrentTenant,
        hasRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}