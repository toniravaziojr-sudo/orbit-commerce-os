// =============================================
// IMAGE TRANSFORM - Image optimization utilities
// Since Supabase Image Transformation is NOT enabled,
// this module returns original URLs but provides helper
// functions for consistent sizing hints and lazy loading.
// =============================================

/**
 * Returns the image URL as-is (no server-side transform available).
 * Kept as a centralized utility so if Image Transformation is enabled
 * in the future, only this file needs to change.
 */
export function transformImageUrl(
  url: string | undefined | null,
  _options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'origin';
    resize?: 'cover' | 'contain' | 'fill';
  }
): string {
  if (!url) return '/placeholder.svg';
  if (url.trim() === '') return '';
  return url;
}

/**
 * Get product card image URL (pass-through)
 */
export function getProductCardImageUrl(url: string | undefined | null): string {
  return transformImageUrl(url);
}

/**
 * Get hero banner image URL (pass-through)
 */
export function getHeroBannerImageUrl(
  url: string | undefined | null,
  _viewport: 'desktop' | 'mobile' = 'desktop'
): string {
  return transformImageUrl(url);
}

/**
 * Get block image URL (pass-through)
 */
export function getBlockImageUrl(
  url: string | undefined | null,
  _maxWidth: number = 800
): string {
  return transformImageUrl(url);
}

/**
 * Get logo/icon URL (pass-through)
 */
export function getLogoImageUrl(
  url: string | undefined | null,
  _size: number = 200
): string {
  return transformImageUrl(url);
}
