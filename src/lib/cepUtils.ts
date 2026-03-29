// =============================================
// CEP UTILITIES - Single source of truth for CEP handling
// RULE: State stores ONLY digits. Mask is ONLY for display.
// =============================================

/**
 * Sanitizes any CEP input to raw digits only (max 8).
 * Handles: typed input, pasted values, autofill, localStorage hydration.
 * This is the ONLY function that should touch CEP before saving to state.
 */
export function sanitizeCep(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '').slice(0, 8);
}

/**
 * Formats raw CEP digits for display as XXXXX-XXX.
 * ONLY use for rendering (input value, text display).
 * NEVER save the output of this function to state/context/localStorage.
 */
export function formatCepDisplay(digits: string): string {
  // Defense: always strip non-digits first to prevent double-formatting
  const clean = digits.replace(/\D/g, '').slice(0, 8);
  if (clean.length > 5) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return clean;
}

/**
 * Validates if a CEP string has exactly 8 digits.
 */
export function isValidCep(raw: string): boolean {
  return sanitizeCep(raw).length === 8;
}