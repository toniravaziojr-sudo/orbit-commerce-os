import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
  signInWithGoogle: () => Promise<{ error: Error | null }>;
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
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
    return data as UserRole[];
  };

  const fetchTenants = async (roles: UserRole[]) => {
    if (roles.length === 0) return [];
    
    const tenantIds = [...new Set(roles.map(r => r.tenant_id))];
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .in('id', tenantIds);

    if (error) {
      console.error('Error fetching tenants:', error);
      return [];
    }
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
    const [profileData, rolesData] = await Promise.all([
      fetchProfile(userId),
      fetchUserRoles(userId),
    ]);

    // Se não existe profile, o usuário foi deletado - fazer logout
    if (!profileData) {
      console.log('Profile not found, signing out stale session');
      await supabase.auth.signOut();
      return false;
    }

    setProfile(profileData);
    setUserRoles(rolesData);

    const tenantsData = await fetchTenants(rolesData);
    setTenants(tenantsData);

    if (profileData?.current_tenant_id) {
      const tenant = tenantsData.find(t => t.id === profileData.current_tenant_id);
      if (tenant) {
        setCurrentTenantState(tenant);
      } else if (tenantsData.length > 0) {
        // Current tenant não existe mais, selecionar o primeiro
        await setCurrentTenant(tenantsData[0].id);
      }
    } else if (tenantsData.length > 0) {
      // Sem tenant atual, selecionar o primeiro
      await setCurrentTenant(tenantsData[0].id);
    }
    return true;
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserData(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Defer data loading to prevent deadlock
        if (newSession?.user) {
          setTimeout(() => {
            loadUserData(newSession.user.id).then((valid) => {
              if (!valid) {
                // Sessão inválida, já fez logout
                setUser(null);
                setSession(null);
              }
              setIsLoading(false);
            });
          }, 0);
        } else {
          setProfile(null);
          setCurrentTenantState(null);
          setUserRoles([]);
          setTenants([]);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        loadUserData(existingSession.user.id).then((valid) => {
          if (!valid) {
            setUser(null);
            setSession(null);
          }
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
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
