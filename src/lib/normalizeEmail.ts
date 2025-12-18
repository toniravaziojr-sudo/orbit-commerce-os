// =============================================
// NORMALIZE EMAIL - Single source of truth for email normalization
// Used across checkout, customer lookup, and "Meus Pedidos"
// =============================================

/**
 * Normalizes an email address for consistent storage and lookup.
 * - Trims whitespace
 * - Converts to lowercase
 * 
 * This is the canonical way to normalize emails in the system.
 * Customer identity is defined by normalized email.
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}
