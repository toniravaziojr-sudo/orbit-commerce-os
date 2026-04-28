import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check if the current user is a platform operator (superadmin).
 *
 * SOURCE OF TRUTH: Uses the canonical `is_platform_admin()` RPC (SECURITY DEFINER)
 * — the same function used by all backend RLS policies and edge functions.
 * This eliminates divergence between UI authorization and backend authorization.
 *
 * Per memory: auth/permission-architecture-v2-unified-hook-standard
 */

interface PlatformAdmin {
  id: string;
  email: string;
  name: string | null;
  role: string;
  permissions: string[];
  is_active: boolean;
}

export function usePlatformOperator() {
  const { user, isLoading: authLoading } = useAuth();

  const normalizedEmail = user?.email?.trim().toLowerCase();
  const userId = user?.id;

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['platform-admin-check', userId, normalizedEmail],
    queryFn: async () => {
      if (!userId || !normalizedEmail) {
        return { isOperator: false, admin: null as PlatformAdmin | null };
      }

      // 1) Canonical authorization check via RPC (single source of truth)
      const { data: isOperator, error: rpcError } = await supabase.rpc('is_platform_admin');

      if (rpcError) {
        console.error('[usePlatformOperator] is_platform_admin RPC failed:', rpcError);
        return { isOperator: false, admin: null as PlatformAdmin | null };
      }

      if (!isOperator) {
        return { isOperator: false, admin: null as PlatformAdmin | null };
      }

      // 2) If authorized, fetch admin profile metadata for UI (role, permissions, name)
      const { data: admin, error: profileError } = await supabase
        .from('platform_admins')
        .select('id, email, name, role, permissions, is_active')
        .eq('email', normalizedEmail)
        .eq('is_active', true)
        .maybeSingle();

      if (profileError) {
        console.warn('[usePlatformOperator] Profile fetch failed (still authorized):', profileError);
      }

      return {
        isOperator: true,
        admin: (admin as PlatformAdmin | null) ?? null,
      };
    },
    enabled: !!userId && !!normalizedEmail && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  return {
    isPlatformOperator: !!data?.isOperator,
    platformAdmin: data?.admin ?? null,
    isLoading: authLoading || queryLoading,
    userEmail: user?.email,
  };
}
