import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook to check if the current user is a platform operator (superadmin).
 * 
 * Platform operators have access to cross-tenant monitoring tools like Health Monitor.
 * 
 * SECURITY: This is a strict allowlist - only the specified email can access operator features.
 * The check is case-insensitive and trims whitespace.
 */

// Strict allowlist of platform operator emails - DO NOT ADD TEST EMAILS
const PLATFORM_OPERATOR_EMAILS = [
  'respeiteohomem@gmail.com',
];

export function usePlatformOperator() {
  const { user, isLoading } = useAuth();
  
  const isPlatformOperator = useMemo(() => {
    if (!user?.email) return false;
    
    // Normalize email: trim whitespace and lowercase
    const normalizedEmail = user.email.trim().toLowerCase();
    
    // Check if user email is in the strict allowlist
    return PLATFORM_OPERATOR_EMAILS.some(
      operatorEmail => operatorEmail.trim().toLowerCase() === normalizedEmail
    );
  }, [user?.email]);
  
  return {
    isPlatformOperator,
    isLoading,
    userEmail: user?.email,
  };
}
