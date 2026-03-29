// =============================================
// SANITIZE AI LANDING PAGE HTML
// Strips problematic CSS patterns from AI-generated HTML
// that cause rendering issues inside iframes:
// 1. vh-based heights → cause infinite resize loops
// 2. animation-fill-mode: both/forwards → cause opacity:0 stuck state
// 3. animation-delay > 1.5s → keeps elements invisible too long
// v4.2: Simplified — footer regex and overflow injection removed (handled by body-only contract)
// =============================================

/**
 * Sanitize AI-generated HTML to prevent common rendering issues.
 * This is a secondary defense layer. The primary protection is the
 * body-only contract (v4.2) where the backend controls the document shell.
 */
export function sanitizeAILandingPageHtml(html: string): string {
  let result = html;

  // 1. Replace min-height: XXvh with min-height: auto (inside style blocks and inline styles)
  result = result.replace(/min-height\s*:\s*\d+(\.\d+)?vh/gi, 'min-height: auto');

  // 2. Replace height: XXvh with height: auto ONLY for large values (>=50vh)
  result = result.replace(/height\s*:\s*(100|[5-9]\d)(\.\d+)?vh/gi, 'height: auto');

  // 3. Fix animation-fill-mode: both/forwards → none (prevents opacity:0 stuck)
  result = result.replace(/animation-fill-mode\s*:\s*(both|forwards)\s*;?/gi, 'animation-fill-mode: none;');

  // 4. Fix shorthand animations with "both" or "forwards" fill mode
  //    e.g., "animation: fadeInUp 0.8s ease-out 0.2s both" → remove "both"
  result = result.replace(
    /(animation\s*:[^;]*)\b(both|forwards)\b/gi,
    '$1'
  );

  // 5. Remove excessive animation-delay (>1.5s) that keeps elements invisible
  //    v4.2: Cap raised from 0.5s to 1.5s — allows stagger effects while preventing stuck elements
  result = result.replace(/animation-delay\s*:\s*([2-9]\d*|1\.[6-9]\d*|[2-9]\.\d+)s\s*;?/gi, '');

  // 6. Strip <img> tags pointing to prohibited external hosts (runtime defense)
  //    Replaces with empty string to prevent broken images from appearing
  result = result.replace(/<img\s[^>]*src\s*=\s*["'][^"']*(?:imgur\.com|postimg\.cc|imgbb\.com|cloudinary\.com|via\.placeholder\.com|placeholder\.com)[^"']*["'][^>]*\/?>/gi, '');

  return result;
}