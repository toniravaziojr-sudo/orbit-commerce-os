// =============================================
// IMAGE TRANSFORM - Supabase Storage image optimization
// Converts storage URLs to use Supabase Image Transformation API
// Serves WebP format with proper sizing to reduce payload
// =============================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Check if a URL is a Supabase Storage public URL
 */
function isSupabaseStorageUrl(url: string): boolean {
  if (!url || !SUPABASE_URL) return false;
  return url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/`);
}

/**
 * Transform a Supabase Storage URL to use the Image Transformation API
 * Returns optimized WebP image at specified dimensions
 * 
 * @param url - Original image URL
 * @param options - Transform options (width, height, quality, format)
 * @returns Transformed URL or original if not a Supabase Storage URL
 */
export function transformImageUrl(
  url: string | undefined | null,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'origin';
    resize?: 'cover' | 'contain' | 'fill';
  }
): string {
  if (!url) return '/placeholder.svg';
  if (url.trim() === '') return '';
  if (!isSupabaseStorageUrl(url)) return url;

  const { width, height, quality = 80, format = 'webp', resize = 'cover' } = options || {};

  // Extract the path after /object/public/
  const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/`;
  const storagePath = url.replace(publicPrefix, '');

  // Build render URL with transforms
  const params = new URLSearchParams();
  if (width) params.set('width', String(width));
  if (height) params.set('height', String(height));
  params.set('quality', String(quality));
  params.set('format', format);
  params.set('resize', resize);

  return `${SUPABASE_URL}/storage/v1/render/image/public/${storagePath}?${params.toString()}`;
}

/**
 * Get optimized product card image (400x400 WebP)
 */
export function getProductCardImageUrl(url: string | undefined | null): string {
  return transformImageUrl(url, { width: 400, height: 400, quality: 75 });
}

/**
 * Get optimized hero banner image
 * Returns different sizes for desktop and mobile
 */
export function getHeroBannerImageUrl(
  url: string | undefined | null,
  viewport: 'desktop' | 'mobile' = 'desktop'
): string {
  if (viewport === 'mobile') {
    return transformImageUrl(url, { width: 768, quality: 75 });
  }
  return transformImageUrl(url, { width: 1920, quality: 80 });
}

/**
 * Get optimized image for general blocks (ImageBlock, etc.)
 */
export function getBlockImageUrl(
  url: string | undefined | null,
  maxWidth: number = 800
): string {
  return transformImageUrl(url, { width: maxWidth, quality: 80 });
}

/**
 * Get optimized logo/icon (small images)
 */
export function getLogoImageUrl(
  url: string | undefined | null,
  size: number = 200
): string {
  return transformImageUrl(url, { width: size, height: size, quality: 85, resize: 'contain' });
}
