/**
 * CPF formatting and validation utilities
 * Format: 000.000.000-00
 */

/**
 * Removes all non-digit characters from a string
 */
export function extractCpfDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formats a CPF string with mask: 000.000.000-00
 */
export function formatCpf(value: string | null | undefined): string {
  if (!value) return '';
  const digits = extractCpfDigits(value);
  if (digits.length === 0) return '';

  let formatted = '';
  for (let i = 0; i < digits.length && i < 11; i++) {
    if (i === 3 || i === 6) formatted += '.';
    if (i === 9) formatted += '-';
    formatted += digits[i];
  }
  return formatted;
}

/**
 * Validates CPF using the official check-digit algorithm.
 * Rejects repeated-digit sequences (e.g. 111.111.111-11).
 */
export function isValidCpf(value: string | null | undefined): boolean {
  if (!value) return false;

  const digits = extractCpfDigits(value);
  if (digits.length !== 11) return false;

  // Reject all-same-digit sequences
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;

  return true;
}

/**
 * Handles CPF input change, applying mask while typing.
 */
export function handleCpfInput(inputValue: string): string {
  const digits = extractCpfDigits(inputValue).slice(0, 11);
  return formatCpf(digits);
}