// =============================================
// AI LANDING PAGE SHELL — V4.2.1
// Shared pipeline for document assembly
// Used by both StorefrontAILandingPage.tsx and LandingPagePreviewDialog.tsx
// Single source of truth for safety CSS, CSS utilities, auto-resize, and document wrapping
// =============================================

/**
 * Build the CSS utilities that provide keyframes, containers, and mobile responsiveness.
 * These MUST match the backend's wrapInDocumentShell() utilities exactly.
 */
export function buildCssUtilities(): string {
  return `
@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse-cta { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
.animate-section { animation: fadeInUp 0.8s ease-out forwards; }
.glass-card { background: rgba(255,255,255,0.08); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.section { padding: 80px 0; }
/* CTA constraints (v4.3) */
.cta-button, [class*="cta"], a[style*="padding"][style*="background"] {
  max-width: 400px; font-size: clamp(14px, 1.1vw, 18px); padding: 14px 32px;
  border-radius: 8px; display: inline-block; box-sizing: border-box;
}
@media (max-width: 768px) {
  html, body { overflow-x: hidden !important; max-width: 100vw !important; }
  h1 { font-size: 1.75rem !important; line-height: 1.2 !important; }
  h2 { font-size: 1.4rem !important; }
  h3 { font-size: 1.15rem !important; }
  p, li, span { font-size: 15px !important; }
  .section { padding: 48px 0 !important; }
  .container { padding: 0 16px !important; }
  /* Force single column on grids with 3+ columns, preserve 2-col */
  [style*="grid-template-columns: repeat(3"], [style*="grid-template-columns: repeat(4"],
  [style*="grid-template-columns: repeat(5"], [style*="grid-template-columns: repeat(6"] {
    grid-template-columns: 1fr !important;
  }
  [style*="grid-template-columns: 1fr 1fr 1fr"], [style*="grid-template-columns:1fr 1fr 1fr"] {
    grid-template-columns: 1fr !important;
  }
  /* Grid catch-all removed in v4.2 — selective rules above handle 3+ columns correctly */
  .comparison-table-wrapper { overflow-x: auto; }
  .cta-button, [class*="cta"], a[style*="padding"][style*="background"] {
    max-width: 100% !important; width: 100% !important; text-align: center !important;
    padding: 14px 24px !important; font-size: 16px !important; display: block !important;
  }
  img { max-width: 100% !important; height: auto !important; }
  /* Prevent horizontal overflow */
  * { max-width: 100vw; }
  [style*="position: absolute"], [style*="position:absolute"] { max-width: 100% !important; }
}`;
}

/**
 * Build the safety CSS that prevents common rendering issues in iframes.
 */
export function buildSafetyCss(): string {
  return `
[style*="animation-fill-mode: both"], [style*="animation-fill-mode: forwards"],
[style*="animation-fill-mode:both"], [style*="animation-fill-mode:forwards"] {
  animation-fill-mode: none !important;
}
section, .section, .hero, [class*="hero"] { min-height: auto !important; }
html, body { overflow-x: hidden !important; max-width: 100% !important; width: 100% !important; box-sizing: border-box !important; }
body > * { max-width: 100% !important; overflow-x: hidden !important; }
.cta-button { cursor: pointer; }
img { max-width: 100% !important; height: auto; }
[style*="width"][style*="vw"] { max-width: 100% !important; }`;
}

/**
 * Build the auto-resize script that measures iframe content height
 * and sends postMessage to parent for dynamic sizing.
 */
export function buildAutoResizeScript(): string {
  return `
<script>
(function(){
  var lastH = 0;
  function sendHeight(){
    try {
      var h = Math.max(
        document.documentElement.scrollHeight || 0,
        document.body.scrollHeight || 0
      );
      if(h > 0 && h !== lastH){
        lastH = h;
        window.parent.postMessage({type:'ai-lp-resize', height: h}, '*');
      }
    } catch(e){}
  }
  sendHeight();
  setTimeout(sendHeight, 100);
  setTimeout(sendHeight, 300);
  setTimeout(sendHeight, 600);
  setTimeout(sendHeight, 1200);
  setTimeout(sendHeight, 2500);
  setTimeout(sendHeight, 5000);
  setTimeout(sendHeight, 8000);
  var imgs = document.querySelectorAll('img');
  imgs.forEach(function(img){
    if(!img.complete){ img.addEventListener('load', function(){ sendHeight(); }, {once:true}); }
  });
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(function(){ setTimeout(sendHeight, 50); });
  }
  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function(){ sendHeight(); }) : null;
  if(ro) ro.observe(document.body);
})();
</script>`;
}

/**
 * Convert @import url(...) inside <style> tags to <link> tags
 * to prevent render-blocking in srcDoc iframes.
 */
function convertImportsToLinks(html: string): string {
  const importRegex = /@import\s+url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)\s*;?/g;
  const links: string[] = [];

  let result = html.replace(importRegex, (_match, url) => {
    links.push(`<link rel="stylesheet" href="${url}">`);
    return '';
  });

  if (links.length > 0 && result.includes('</head>')) {
    result = result.replace('</head>', `${links.join('\n')}\n</head>`);
  }

  return result;
}

export interface BuildDocumentShellOptions {
  pixelScripts?: string;
  faviconTag?: string;
  /** Extra CSS to inject (e.g., generated_css from DB) */
  extraCss?: string;
}

/**
 * Build a complete HTML document from AI-generated section content.
 * This is the single source of truth for document assembly.
 *
 * If the input is already a full document (has <!DOCTYPE or <html>),
 * it injects safety CSS, auto-resize, and optional extras into the existing structure.
 *
 * If the input is body-only (sections + style), it wraps in a proper document shell
 * WITH full CSS utilities (keyframes, container, grid rules, mobile).
 */
export function buildDocumentShell(
  sectionHtml: string,
  options: BuildDocumentShellOptions = {},
): string {
  const safetyCss = buildSafetyCss();
  const cssUtilities = buildCssUtilities();
  const autoResizeScript = buildAutoResizeScript();
  const safetyStyleTag = `<style id="lp-safety">${safetyCss}</style>`;
  const utilitiesStyleTag = `<style id="lp-utilities">${cssUtilities}</style>`;

  const isFullDocument =
    sectionHtml.trim().toLowerCase().startsWith('<!doctype') ||
    sectionHtml.trim().toLowerCase().startsWith('<html');

  let fullHtml: string;

  if (isFullDocument) {
    // Already a full document (legacy content or contract violation recovery)
    fullHtml = sectionHtml;

    // Inject safety CSS before </head>
    if (fullHtml.includes('</head>')) {
      const headInjections = [options.faviconTag, options.pixelScripts, safetyStyleTag]
        .filter(Boolean)
        .join('\n');
      fullHtml = fullHtml.replace('</head>', `${headInjections}\n</head>`);
    }

    // Inject auto-resize before </body>
    if (fullHtml.includes('</body>')) {
      fullHtml = fullHtml.replace('</body>', `${autoResizeScript}\n</body>`);
    } else if (fullHtml.includes('</html>')) {
      fullHtml = fullHtml.replace('</html>', `${autoResizeScript}\n</html>`);
    } else {
      fullHtml += autoResizeScript;
    }
  } else {
    // Body-only content (V4.2 contract) — inject FULL CSS utilities + safety
    fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${utilitiesStyleTag}
  ${options.extraCss ? `<style>${options.extraCss}</style>` : ''}
  ${safetyStyleTag}
  ${options.faviconTag || ''}
  ${options.pixelScripts || ''}
</head>
<body style="margin:0;overflow-x:hidden">
  ${sectionHtml}
  ${autoResizeScript}
</body>
</html>`;
  }

  // Convert @import to <link> for iframe compatibility
  fullHtml = convertImportsToLinks(fullHtml);

  return fullHtml;
}
