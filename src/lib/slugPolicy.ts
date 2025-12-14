// =============================================
// SLUG POLICY - Global slug rules for the entire system
// =============================================

/**
 * GLOBAL SLUG POLICY:
 * 
 * 1. Slugs are unique ONLY within their namespace (not globally across entities)
 * 2. The same slug can exist in different entity types because each has a unique route prefix
 * 3. Uniqueness rules:
 *    - products: unique per (tenant_id, slug)
 *    - categories: unique per (tenant_id, slug)
 *    - store_pages: unique per (tenant_id, type, slug) - type separates institutional vs landing
 *    - tenants: globally unique
 * 
 * 4. Routes are namespaced to prevent collisions:
 *    - /product/:slug - products
 *    - /category/:slug or /c/:slug - categories
 *    - /page/:slug or /p/:slug - institutional pages
 *    - /lp/:slug - landing pages
 */

// Slug format regex: lowercase letters, numbers, hyphens, no start/end with hyphen
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/;

// Reserved slugs that cannot be used (system routes)
export const RESERVED_SLUGS = [
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
  'minhas-compras',
  'my-orders',
] as const;

export type SlugNamespace = 'product' | 'category' | 'institutional' | 'landing' | 'tenant';

export interface SlugValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate slug format (not uniqueness - that's checked against DB)
 */
export function validateSlugFormat(slug: string | undefined | null): SlugValidationResult {
  if (!slug || slug.trim() === '') {
    return { isValid: false, error: 'Slug é obrigatório' };
  }

  const trimmed = slug.trim();

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

  if (RESERVED_SLUGS.includes(trimmed as any)) {
    return { isValid: false, error: 'Este slug é reservado e não pode ser usado' };
  }

  return { isValid: true };
}

/**
 * Generate a valid slug from text
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
 * Normalize a slug (lowercase, trim)
 */
export function normalizeSlug(slug: string): string {
  return slug.toLowerCase().trim();
}

/**
 * Check if a slug is defined and has valid format
 */
export function hasValidSlug(slug: string | undefined | null): slug is string {
  if (!slug) return false;
  return validateSlugFormat(slug).isValid;
}

/**
 * Get tooltip message for disabled preview when slug is invalid
 */
export function getSlugErrorTooltip(slug: string | undefined | null): string | null {
  const validation = validateSlugFormat(slug);
  if (validation.isValid) return null;
  return `Defina um slug válido para visualizar. ${validation.error || ''}`;
}

/**
 * Check if slug is reserved
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase() as any);
}

// Re-export for backward compatibility with existing code
export { validateSlugFormat as validateSlug };
