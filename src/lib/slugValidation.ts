// =============================================
// SLUG VALIDATION - Re-exports from slugPolicy for backward compatibility
// =============================================

// All slug validation is now centralized in slugPolicy.ts
// This file exists for backward compatibility with existing imports

export {
  validateSlugFormat as validateSlug,
  generateSlug,
  hasValidSlug,
  getSlugErrorTooltip as getSlugTooltip,
  normalizeSlug,
  isReservedSlug,
  RESERVED_SLUGS,
  type SlugValidationResult,
  type SlugNamespace,
} from './slugPolicy';
