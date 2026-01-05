import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check if the current user is a platform operator (superadmin).
 * 
 * Platform operators have access to cross-tenant monitoring tools like Health Monitor,
 * system email configuration, and platform-level settings.
 * 
 * SECURITY: This queries the platform_admins table in the database.
 * Only users registered in that table with is_active=true are considered platform operators.
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
  
  const { data: platformAdmin, isLoading: queryLoading } = useQuery({
    queryKey: ['platform-admin-check', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      
      const { data, error } = await supabase
        .from('platform_admins')
        .select('id, email, name, role, permissions, is_active')
        .eq('email', user.email.trim().toLowerCase())
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) {
        console.error('[usePlatformOperator] Error checking platform admin:', error);
        return null;
      }
      
      return data as PlatformAdmin | null;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
  });
  
  return {
    isPlatformOperator: !!platformAdmin,
    platformAdmin,
    isLoading: authLoading || queryLoading,
    userEmail: user?.email,
  };
}
