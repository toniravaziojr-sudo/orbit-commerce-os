// ============================================
// TOKEN UTILS - JWT parsing and status checking
// Used by shipping carrier configuration components
// ============================================

export interface TokenStatus {
  status: 'ok' | 'expiring' | 'expired' | 'invalid' | 'none';
  expiresAt?: Date;
  hoursRemaining?: number;
}

/**
 * Parse a JWT token and extract the payload
 */
export function parseJwt(token: string): { exp?: number; iat?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get the status of a JWT token
 * Returns: ok, expiring (< 2h), expired, invalid, or none
 */
export function getTokenStatus(token: string | undefined): TokenStatus {
  if (!token || token.length < 50) {
    return { status: 'none' };
  }
  
  const payload = parseJwt(token);
  if (!payload || !payload.exp) {
    return { status: 'invalid' };
  }
  
  const expiresAt = new Date(payload.exp * 1000);
  const now = new Date();
  const hoursRemaining = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursRemaining <= 0) {
    return { status: 'expired', expiresAt, hoursRemaining: 0 };
  }
  
  if (hoursRemaining < 2) {
    return { status: 'expiring', expiresAt, hoursRemaining };
  }
  
  return { status: 'ok', expiresAt, hoursRemaining };
}
