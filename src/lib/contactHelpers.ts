/**
 * Helper functions for contact links and store settings
 * Centralizes WhatsApp, Phone, Email URL generation
 */

/**
 * Generates a WhatsApp link from a phone number
 * Strips non-digits and creates wa.me URL
 */
export function getWhatsAppHref(number: string | null | undefined): string | null {
  if (!number) return null;
  const digits = number.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}

/**
 * Generates a tel: link from a phone number
 * Keeps + and digits only
 */
export function getPhoneHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/[^\d+]/g, '');
  if (normalized.length < 8) return null;
  return `tel:${normalized}`;
}

/**
 * Generates a mailto: link from an email
 */
export function getEmailHref(email: string | null | undefined): string | null {
  if (!email) return null;
  // Basic validation
  if (!email.includes('@')) return null;
  return `mailto:${email}`;
}

/**
 * Validates and normalizes a phone number for display
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Checks if a WhatsApp number is valid (has at least 10 digits)
 */
export function isValidWhatsApp(number: string | null | undefined): boolean {
  if (!number) return false;
  const digits = number.replace(/\D/g, '');
  return digits.length >= 10;
}

/**
 * Checks if a phone number is valid (has at least 8 digits)
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized.length >= 8;
}

/**
 * Checks if an email is valid (basic check)
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.includes('@') && email.includes('.');
}
