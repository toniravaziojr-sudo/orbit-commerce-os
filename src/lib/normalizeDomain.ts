/**
 * Normalizes a domain string:
 * - Removes protocol (http:// https://)
 * - Removes trailing slashes
 * - Removes www. prefix (optional)
 * - Converts to lowercase
 * - Trims whitespace
 */
export function normalizeDomain(domain: string, removeWww = false): string {
  let normalized = domain
    .trim()
    .toLowerCase()
    // Remove protocol
    .replace(/^https?:\/\//, '')
    // Remove trailing slashes and paths
    .replace(/\/.*$/, '')
    // Remove port if present
    .replace(/:\d+$/, '');

  // Optionally remove www prefix
  if (removeWww) {
    normalized = normalized.replace(/^www\./, '');
  }

  return normalized;
}

/**
 * Validates domain format
 * Returns null if valid, error message if invalid
 */
export function validateDomainFormat(domain: string): string | null {
  if (!domain || domain.length === 0) {
    return 'Domínio é obrigatório';
  }

  const normalized = normalizeDomain(domain);

  // Basic hostname validation regex
  const hostnameRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
  
  if (!hostnameRegex.test(normalized)) {
    return 'Formato de domínio inválido. Ex: meusite.com.br ou loja.meusite.com';
  }

  if (normalized.length > 253) {
    return 'Domínio muito longo (máx. 253 caracteres)';
  }

  return null;
}

/**
 * Detects if domain is apex (root) or subdomain
 */
export function getDomainType(domain: string): 'apex' | 'subdomain' {
  const normalized = normalizeDomain(domain, true); // Remove www for analysis
  const parts = normalized.split('.');
  
  // Common TLDs with two parts (com.br, co.uk, etc.)
  const twoPartTLDs = ['com.br', 'org.br', 'net.br', 'co.uk', 'com.au', 'co.nz'];
  const lastTwoParts = parts.slice(-2).join('.');
  
  if (twoPartTLDs.includes(lastTwoParts)) {
    // For two-part TLDs, apex has 3 parts (example.com.br)
    return parts.length <= 3 ? 'apex' : 'subdomain';
  }
  
  // For single-part TLDs, apex has 2 parts (example.com)
  return parts.length <= 2 ? 'apex' : 'subdomain';
}

/**
 * Generates a short verification token
 */
export function generateVerificationToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
