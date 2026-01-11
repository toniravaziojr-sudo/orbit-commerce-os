import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para verificar se o usuário já foi convidado para algum tenant.
 * Usuários que aceitaram convites anteriormente NÃO podem criar loja própria.
 * Isso previne que membros removidos criem novas lojas.
 */
export function useWasInvitedUser(userEmail: string | undefined) {
  const normalizedEmail = userEmail?.trim().toLowerCase();
  
  const { data, isLoading } = useQuery({
    queryKey: ['was-invited-user', normalizedEmail],
    queryFn: async () => {
      if (!normalizedEmail) return { wasInvited: false };
      
      // Verificar se existe algum convite aceito para este email
      const { data: acceptedInvites, error } = await supabase
        .from('tenant_user_invitations')
        .select('id')
        .eq('email', normalizedEmail)
        .not('accepted_at', 'is', null)
        .limit(1);
      
      if (error) {
        console.error('[useWasInvitedUser] Error checking invitations:', error);
        return { wasInvited: false };
      }
      
      const wasInvited = (acceptedInvites?.length ?? 0) > 0;
      
      console.log('[useWasInvitedUser] User was previously invited:', wasInvited, normalizedEmail);
      
      return { wasInvited };
    },
    enabled: !!normalizedEmail,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  return {
    wasInvited: data?.wasInvited ?? false,
    isLoading,
  };
}
