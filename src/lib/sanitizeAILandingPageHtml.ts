// =============================================
// SANITIZE AI LANDING PAGE HTML
// Strips problematic CSS patterns from AI-generated HTML
// that cause rendering issues inside iframes:
// 1. vh-based heights → cause infinite resize loops
// 2. animation-fill-mode: both/forwards → cause opacity:0 stuck state
// 3. Malformed keyframes → cause invisible elements
// =============================================

/**
 * Sanitize AI-generated HTML to prevent common rendering issues.
 * This is a regex-based approach that modifies the CSS BEFORE rendering,
 * which is more reliable than CSS overrides with !important.
 */
export function sanitizeAILandingPageHtml(html: string): string {
  let result = html;

  // 1. Replace min-height: XXvh with min-height: auto (inside style blocks and inline styles)
  //    Matches: min-height: 95vh, min-height:100vh, min-height: 80vh, etc.
  result = result.replace(/min-height\s*:\s*\d+(\.\d+)?vh/gi, 'min-height: auto');

  // 2. Replace height: XXvh with height: auto ONLY for large values (>50vh)
  //    Small vh values (e.g., height: 2vh for spacing) are left alone
  result = result.replace(/height\s*:([5-9]\d|100)(\.\d+)?vh/gi, 'height: auto');

  // 3. Remove animation-fill-mode: both/forwards (cause opacity:0 stuck state)
  result = result.replace(/animation-fill-mode\s*:\s*(both|forwards)\s*;?/gi, '');

  // 4. Fix shorthand animations with "both" or "forwards" fill mode
  //    e.g., "animation: fadeInUp 0.8s ease-out 0.2s both" → remove "both"
  result = result.replace(
    /(animation\s*:[^;]*)\b(both|forwards)\b/gi,
    '$1'
  );

  // 5. Remove animation-delay that keeps elements invisible
  //    Elements with delay + fill-mode stay at opacity:0 during the delay
  result = result.replace(/animation-delay\s*:\s*[\d.]+s\s*;?/gi, '');

  return result;
}
