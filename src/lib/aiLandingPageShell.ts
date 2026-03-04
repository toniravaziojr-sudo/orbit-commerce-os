// =============================================
// AI LANDING PAGE SHELL — V4.2
// Shared pipeline for document assembly
// Used by both StorefrontAILandingPage.tsx and LandingPagePreviewDialog.tsx
// Single source of truth for safety CSS, auto-resize, and document wrapping
// =============================================

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
html, body { overflow-x: hidden !important; max-width: 100% !important; }
.cta-button { cursor: pointer; }`;
}

/**
 * Build the auto-resize script that measures iframe content height
 * and sends postMessage to parent for dynamic sizing.
 */
export function buildAutoResizeScript(): string {
  return `
<script>
(function(){
  var locked = false;
  var lastH = 0;
  var stableCount = 0;
  function sendHeight(){
    if(locked) return;
    try {
      var h = Math.max(
        document.documentElement.scrollHeight || 0,
        document.body.scrollHeight || 0
      );
      if(h > 0 && Math.abs(h - lastH) > 2){
        stableCount = 0;
        lastH = h;
        window.parent.postMessage({type:'ai-lp-resize', height: h}, '*');
      } else if(h > 0) {
        stableCount++;
        if(stableCount >= 3) { locked = true; }
      }
    } catch(e){}
  }
  sendHeight();
  setTimeout(sendHeight, 200);
  setTimeout(sendHeight, 600);
  setTimeout(sendHeight, 1500);
  setTimeout(sendHeight, 3000);
  var imgs = document.querySelectorAll('img');
  imgs.forEach(function(img){
    if(!img.complete){ img.addEventListener('load', function(){ sendHeight(); }, {once:true}); }
  });
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
 * If the input is body-only (sections + style), it wraps in a proper document shell.
 */
export function buildDocumentShell(
  sectionHtml: string,
  options: BuildDocumentShellOptions = {},
): string {
  const safetyCss = buildSafetyCss();
  const autoResizeScript = buildAutoResizeScript();
  const safetyStyleTag = `<style id="lp-safety">${safetyCss}</style>`;

  const isFullDocument =
    sectionHtml.trim().toLowerCase().startsWith('<!doctype') ||
    sectionHtml.trim().toLowerCase().startsWith('<html');

  let fullHtml: string;

  if (isFullDocument) {
    // Already a full document (legacy V4.0 content or contract violation recovery)
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
    // Body-only content (V4.2 contract)
    fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
