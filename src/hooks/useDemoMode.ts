import { useAuth } from "./useAuth";

// Lista de emails de usuários de demonstração/revisores que não devem ver indicadores internos
const DEMO_USER_EMAILS = [
  'shopee-reviewer@comandocentral.com.br',
  'demo@comandocentral.com.br',
];

/**
 * Hook que detecta se o usuário atual está em "modo demonstração"
 * Usuários em modo demonstração:
 * - Têm acesso completo ao sistema
 * - Não veem indicadores de status de módulos (✅/🟧)
 * - Não veem badges de desenvolvimento ou alertas internos
 */
export function useDemoMode() {
  const { user } = useAuth();
  
  const isDemoMode = user?.email 
    ? DEMO_USER_EMAILS.includes(user.email.toLowerCase())
    : false;

  return {
    isDemoMode,
    isDemoUser: isDemoMode,
  };
}
