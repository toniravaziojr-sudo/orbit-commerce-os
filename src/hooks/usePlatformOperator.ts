import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook to check if the current user is a platform operator (superadmin).
 * 
 * Platform operators have access to cross-tenant monitoring tools like Health Monitor.
 * 
 * This is a provisional gate using email allowlist. In the future, this should
 * be migrated to a proper role-based system with a platform_operators table.
 */

// Provisional allowlist of platform operator emails
// TODO: Migrate to proper role-based system (platform_operators table)
const PLATFORM_OPERATOR_EMAILS = [
  'rafael@comandocentral.com.br',
  'admin@comandocentral.com.br',
  // Add more operator emails as needed
];

export function usePlatformOperator() {
  const { user, isLoading } = useAuth();
  
  const isPlatformOperator = useMemo(() => {
    if (!user?.email) return false;
    
    // Check if user email is in the allowlist
    const email = user.email.toLowerCase();
    return PLATFORM_OPERATOR_EMAILS.some(
      operatorEmail => operatorEmail.toLowerCase() === email
    );
  }, [user?.email]);
  
  return {
    isPlatformOperator,
    isLoading,
    userEmail: user?.email,
  };
}
