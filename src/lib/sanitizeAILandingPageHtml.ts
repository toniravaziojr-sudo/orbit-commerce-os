// =============================================
// SANITIZE AI LANDING PAGE HTML
// Strips problematic CSS patterns from AI-generated HTML
// that cause rendering issues inside iframes:
// 1. vh-based heights → cause infinite resize loops
// 2. animation-fill-mode: both/forwards → cause opacity:0 stuck state
// 3. Malformed keyframes → cause invisible elements
// 4. Duplicate footer content → conflicts with platform footer
// v4.1: Softer approach — preserve legitimate animations, fix overflow
// =============================================

/**
 * Sanitize AI-generated HTML to prevent common rendering issues.
 * This is a regex-based approach that modifies the CSS BEFORE rendering,
 * which is more reliable than CSS overrides with !important.
 */
export function sanitizeAILandingPageHtml(html: string): string {
  let result = html;

  // 1. Replace min-height: XXvh with min-height: auto (inside style blocks and inline styles)
  result = result.replace(/min-height\s*:\s*\d+(\.\d+)?vh/gi, 'min-height: auto');

  // 2. Replace height: XXvh with height: auto ONLY for large values (>=50vh)
  result = result.replace(/height\s*:\s*(100|[5-9]\d)(\.\d+)?vh/gi, 'height: auto');

  // 3. Fix animation-fill-mode: both/forwards → none (prevents opacity:0 stuck)
  //    v4.1: Changed from removing entirely to setting 'none' — preserves animation existence
  result = result.replace(/animation-fill-mode\s*:\s*(both|forwards)\s*;?/gi, 'animation-fill-mode: none;');

  // 4. Fix shorthand animations with "both" or "forwards" fill mode
  //    e.g., "animation: fadeInUp 0.8s ease-out 0.2s both" → remove "both"
  result = result.replace(
    /(animation\s*:[^;]*)\b(both|forwards)\b/gi,
    '$1'
  );

  // 5. Remove excessive animation-delay (>0.5s) that keeps elements invisible
  //    v4.1: Only remove large delays, keep small ones for stagger effects
  result = result.replace(/animation-delay\s*:\s*([1-9]\d*|0\.[6-9]\d*|[1-9]\.\d+)s\s*;?/gi, '');

  // 6. Fix overflow issues: ensure no element creates unwanted horizontal scroll
  //    Add overflow-x: hidden to body if not present
  if (!result.includes('overflow-x') && result.includes('<body')) {
    result = result.replace(
      /<body([^>]*)>/i,
      '<body$1 style="overflow-x:hidden">'
    );
  }

  // 7. Remove AI-generated footer sections that conflict with platform footer
  //    Match common footer patterns: <footer>, <div class="footer">, etc.
  result = result.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  result = result.replace(/<div[^>]*class="[^"]*footer[^"]*"[\s\S]*?<\/div>\s*(?=<\/body|$)/gi, '');

  return result;
}
