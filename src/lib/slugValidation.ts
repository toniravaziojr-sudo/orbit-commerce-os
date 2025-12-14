// =============================================
// SLUG VALIDATION - Centralized slug validation utilities
// =============================================

/**
 * Regex for valid slug format:
 * - lowercase letters (a-z)
 * - numbers (0-9)
 * - hyphens (-)
 * - no spaces
 * - no special characters
 * - no consecutive hyphens
 * - doesn't start or end with hyphen
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Reserved slugs that cannot be used
 */
const RESERVED_SLUGS = [
  'admin',
  'api',
  'auth',
  'cart',
  'checkout',
  'store',
  'login',
  'logout',
  'register',
  'signup',
  'settings',
  'profile',
  'dashboard',
  'null',
  'undefined',
  'new',
  'edit',
  'delete',
  'create',
];

export interface SlugValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate a slug for correctness
 */
export function validateSlug(slug: string | undefined | null): SlugValidationResult {
  if (!slug || slug.trim() === '') {
    return { isValid: false, error: 'Slug é obrigatório' };
  }

  const trimmed = slug.trim();

  if (trimmed.length < 2) {
    return { isValid: false, error: 'Slug deve ter no mínimo 2 caracteres' };
  }

  if (trimmed.length > 200) {
    return { isValid: false, error: 'Slug deve ter no máximo 200 caracteres' };
  }

  if (!SLUG_REGEX.test(trimmed)) {
    if (/[A-Z]/.test(trimmed)) {
      return { isValid: false, error: 'Slug deve conter apenas letras minúsculas' };
    }
    if (/\s/.test(trimmed)) {
      return { isValid: false, error: 'Slug não pode conter espaços' };
    }
    if (/[^a-z0-9-]/.test(trimmed)) {
      return { isValid: false, error: 'Slug deve conter apenas letras, números e hífens' };
    }
    if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
      return { isValid: false, error: 'Slug não pode começar ou terminar com hífen' };
    }
    if (/--/.test(trimmed)) {
      return { isValid: false, error: 'Slug não pode ter hífens consecutivos' };
    }
    return { isValid: false, error: 'Slug inválido' };
  }

  if (RESERVED_SLUGS.includes(trimmed)) {
    return { isValid: false, error: 'Este slug é reservado e não pode ser usado' };
  }

  return { isValid: true };
}

/**
 * Generate a valid slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .trim();
}

/**
 * Check if a slug is defined and valid (for preview/URL generation purposes)
 */
export function hasValidSlug(slug: string | undefined | null): slug is string {
  if (!slug) return false;
  return validateSlug(slug).isValid;
}

/**
 * Get a tooltip message for disabled preview buttons when slug is invalid
 */
export function getSlugTooltip(slug: string | undefined | null): string | null {
  const validation = validateSlug(slug);
  if (validation.isValid) return null;
  return `Defina um slug válido para visualizar esta página. ${validation.error || ''}`;
}
