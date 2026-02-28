// =============================================
// IMAGE TRANSFORM - Image optimization via wsrv.nl proxy
// Routes Supabase Storage images through wsrv.nl for
// automatic resizing, WebP conversion, and CDN caching.
// =============================================

const WSRV_BASE = 'https://wsrv.nl/?';

/**
 * Check if a URL is a Supabase Storage URL that can be optimized
 */
function isOptimizableUrl(url: string): boolean {
  if (!url) return false;
  // Optimize Supabase storage URLs and Shopify CDN URLs
  return url.includes('supabase.co/storage/') || url.includes('supabase.in/storage/') || url.includes('cdn.shopify.com/');
}

/**
 * Build a wsrv.nl proxy URL with optimization parameters
 */
function buildWsrvUrl(
  url: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    fit?: 'cover' | 'contain' | 'inside';
  }
): string {
  const params = new URLSearchParams();
  params.set('url', url);
  
  if (options?.width) params.set('w', String(options.width));
  if (options?.height) params.set('h', String(options.height));
  
  // WebP output for smaller file sizes
  params.set('output', 'webp');
  
  // Quality (default 80 for good balance)
  params.set('q', String(options?.quality || 80));
  
  // Fit mode
  if (options?.fit) {
    const fitMap = { cover: 'cover', contain: 'contain', inside: 'inside' };
    params.set('fit', fitMap[options.fit] || 'cover');
  }
  
  // Enable CDN caching (1 year)
  params.set('maxage', '31536000');
  
  return `${WSRV_BASE}${params.toString()}`;
}

/**
 * Transform an image URL through wsrv.nl proxy if applicable.
 * Non-Supabase URLs are returned as-is.
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
  const trimmed = url.trim();
  if (trimmed === '') return '';
  
  // Don't proxy non-optimizable URLs
  if (!isOptimizableUrl(trimmed)) return trimmed;
  
  return buildWsrvUrl(trimmed, {
    width: options?.width,
    height: options?.height,
    quality: options?.quality,
    fit: options?.resize === 'fill' ? 'cover' : (options?.resize as 'cover' | 'contain' | undefined),
  });
}

/**
 * Get product card image URL - optimized for card thumbnails
 */
export function getProductCardImageUrl(url: string | undefined | null): string {
  if (!url) return '/placeholder.svg';
  const trimmed = url.trim();
  if (trimmed === '' || !isOptimizableUrl(trimmed)) return trimmed || '/placeholder.svg';
  
  return buildWsrvUrl(trimmed, { width: 400, quality: 80, fit: 'cover' });
}

/**
 * Get hero banner image URL - optimized per viewport
 */
export function getHeroBannerImageUrl(
  url: string | undefined | null,
  viewport: 'desktop' | 'mobile' = 'desktop'
): string {
  if (!url) return '/placeholder.svg';
  const trimmed = url.trim();
  if (trimmed === '' || !isOptimizableUrl(trimmed)) return trimmed || '/placeholder.svg';
  
  const width = viewport === 'mobile' ? 768 : 1920;
  const quality = viewport === 'mobile' ? 75 : 80;
  
  return buildWsrvUrl(trimmed, { width, quality, fit: 'cover' });
}

/**
 * Get block image URL - optimized for content blocks
 */
export function getBlockImageUrl(
  url: string | undefined | null,
  maxWidth: number = 800
): string {
  if (!url) return '/placeholder.svg';
  const trimmed = url.trim();
  if (trimmed === '' || !isOptimizableUrl(trimmed)) return trimmed || '/placeholder.svg';
  
  return buildWsrvUrl(trimmed, { width: maxWidth, quality: 80 });
}

/**
 * Get logo/icon URL - optimized for small images
 */
export function getLogoImageUrl(
  url: string | undefined | null,
  size: number = 200
): string {
  if (!url) return '/placeholder.svg';
  const trimmed = url.trim();
  if (trimmed === '' || !isOptimizableUrl(trimmed)) return trimmed || '/placeholder.svg';
  
  return buildWsrvUrl(trimmed, { width: size, quality: 85 });
}
