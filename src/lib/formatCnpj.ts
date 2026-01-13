/**
 * CNPJ formatting and validation utilities
 * Format: 00.000.000/0000-00
 */

/**
 * Removes all non-digit characters from a string
 */
export function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formats a CNPJ string with mask: 00.000.000/0000-00
 * Accepts both raw digits and already formatted strings
 */
export function formatCnpj(value: string | null | undefined): string {
  if (!value) return '';
  
  const digits = extractDigits(value);
  
  if (digits.length === 0) return '';
  
  // Apply mask progressively
  let formatted = '';
  
  for (let i = 0; i < digits.length && i < 14; i++) {
    if (i === 2 || i === 5) formatted += '.';
    if (i === 8) formatted += '/';
    if (i === 12) formatted += '-';
    formatted += digits[i];
  }
  
  return formatted;
}

/**
 * Validates if a CNPJ has exactly 14 digits
 */
export function isValidCnpjLength(value: string | null | undefined): boolean {
  if (!value) return false;
  return extractDigits(value).length === 14;
}

/**
 * Handles CNPJ input change, applying mask while typing
 * Returns the masked value for display
 */
export function handleCnpjInput(inputValue: string): string {
  const digits = extractDigits(inputValue);
  // Limit to 14 digits
  const limitedDigits = digits.slice(0, 14);
  return formatCnpj(limitedDigits);
}
