// =============================================
// SANITIZE PUBLIC URL - Remove preview parameters from public URLs
// =============================================

/**
 * Remove preview-related parameters from a URL or search params
 * This ensures public links never contain preview=1 or similar flags
 */
export function stripPreviewParams(searchParams: URLSearchParams): URLSearchParams {
  const cleaned = new URLSearchParams(searchParams);
  cleaned.delete('preview');
  cleaned.delete('previewId');
  cleaned.delete('draft');
  return cleaned;
}

/**
 * Get a clean query string without preview parameters
 * Returns empty string if no params remain, otherwise returns "?params"
 */
export function getCleanQueryString(searchParams: URLSearchParams): string {
  const cleaned = stripPreviewParams(searchParams);
  const str = cleaned.toString();
  return str ? `?${str}` : '';
}

/**
 * Check if current URL has preview mode enabled
 */
export function isPreviewUrl(searchParams: URLSearchParams): boolean {
  return searchParams.get('preview') === '1' || searchParams.has('previewId');
}

/**
 * Build a public URL by removing any preview parameters from the current URL
 * @param basePath - The path without query string
 * @param currentSearchParams - Current URL search params (some may be preview-related)
 */
export function buildPublicUrl(basePath: string, currentSearchParams?: URLSearchParams): string {
  if (!currentSearchParams) return basePath;
  const cleanQuery = getCleanQueryString(currentSearchParams);
  return `${basePath}${cleanQuery}`;
}
