// =============================================
// ISOLATED CUSTOM BLOCK RENDERER - Uses iframe for 100% CSS isolation
// This prevents ANY CSS leakage to/from the builder or storefront
// =============================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Code, AlertTriangle } from 'lucide-react';

interface IsolatedCustomBlockProps {
  htmlContent: string;
  cssContent?: string;
  blockName?: string;
  baseUrl?: string; // Source URL for resolving relative paths (images, fonts, etc.)
  isEditing?: boolean;
  className?: string;
}

// Sanitize HTML to remove dangerous elements (runs before iframe injection)
function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  let sanitized = html;
  
  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
  
  // Remove dangerous iframes (keep YouTube/Vimeo)
  sanitized = sanitized.replace(
    /<iframe(?![^>]*(?:youtube\.com|vimeo\.com|youtube-nocookie\.com))[^>]*>.*?<\/iframe>/gi,
    ''
  );
  
  return sanitized;
}

// Process CSS for pixel-perfect rendering
// CRITICAL: For pixel-perfect, we keep EVERYTHING including display:none
// because the page uses CSS to show/hide mobile vs desktop elements
function processPixelPerfectCss(css: string, html: string): string {
  if (!css) return '';
  
  // For pixel-perfect, only remove rules that could affect the PARENT page
  // Since we're in an iframe, almost nothing can leak out
  let safeCss = css
    // Remove @import (could load external CSS we can't control)
    .replace(/@import[^;]*;/gi, '')
    // Remove :root from outside our scope (could conflict with parent)
    .replace(/^\s*:root\s*\{[^}]*\}/gm, '')
    ;
  
  // KEEP EVERYTHING ELSE:
  // - @font-face (fonts load inside iframe)
  // - @keyframes (animations work)
  // - @media (ESSENTIAL for responsiveness)
  // - display:none rules (ESSENTIAL - CSS uses them to toggle mobile/desktop elements)
  // - visibility:hidden (same reason)
  
  return safeCss;
}

// Build complete HTML document for iframe
// CRITICAL: Include <base href> to resolve relative URLs (images, fonts, etc.)
// CRITICAL: Robust auto-height with STABILIZATION to prevent infinite loops
function buildIframeDocument(html: string, css: string, baseUrl?: string, blockName?: string): string {
  // Extract origin from baseUrl for <base href>
  let baseHref = '';
  if (baseUrl) {
    try {
      const url = new URL(baseUrl);
      baseHref = `${url.origin}/`;
    } catch {
      // If URL parsing fails, try to use as-is
      if (baseUrl.startsWith('http')) {
        baseHref = baseUrl.split('/').slice(0, 3).join('/') + '/';
      }
    }
  }

  // Section identifier for debug logging
  const sectionId = blockName || 'unknown';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseHref ? `<base href="${baseHref}" target="_blank">` : ''}
  <style>
    /* ========================================
       CSS RESET ANTI-INTERFERÊNCIA - ANTES do CSS importado
       Garante que o conteúdo pode expandir e ser medido
       ======================================== */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      overflow-x: hidden !important;
    }
    
    *, *::before, *::after {
      box-sizing: border-box !important;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      display: block !important;
      position: relative !important;
    }
    
    img { max-width: 100%; height: auto; display: block; }
    a { color: inherit; }
    
    /* YouTube/Vimeo iframe responsive */
    iframe[src*="youtube.com"], iframe[src*="youtu.be"], iframe[src*="vimeo.com"] {
      max-width: 100%;
    }
  </style>
  <style>
    /* ========================================
       IMPORTED CSS - Depois do reset
       ======================================== */
    ${css}
  </style>
  <style>
    /* ========================================
       OVERRIDE PÓS-IMPORT - Garante que html/body não bloqueiam medição
       ======================================== */
    html, body {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
    }
  </style>
</head>
<body>
  ${html}
  <script>
    // =============================================
    // ROBUST AUTO-HEIGHT WITH STABILIZATION
    // Prevents infinite loops by stopping after stabilization
    // =============================================
    (function() {
      var SECTION_ID = "${sectionId}";
      var lastHeight = 0;
      var stableCount = 0;
      var updateCount = 0;
      var MAX_UPDATES = 50; // Safety limit
      var STABLE_THRESHOLD = 5; // Stop after 5 stable readings
      var HEIGHT_DELTA = 3; // Minimum change to consider significant
      var isStabilized = false;
      var debounceTimer = null;
      var observersActive = true;
      
      // ResizeObserver and MutationObserver references
      var resizeObserver = null;
      var mutationObserver = null;
      
      function log(msg, data) {
        if (typeof console !== 'undefined' && console.log) {
          console.log('[IframeAutoHeight:' + SECTION_ID + '] ' + msg, data || '');
        }
      }
      
      function getContentHeight() {
        // Force layout recalculation
        document.body.offsetHeight;
        
        // Method 1: Document scroll/offset heights
        var docHeight = Math.max(
          document.body.scrollHeight || 0,
          document.body.offsetHeight || 0,
          document.documentElement.scrollHeight || 0,
          document.documentElement.offsetHeight || 0,
          document.documentElement.clientHeight || 0
        );
        
        // Method 2: Find the bottommost visible element
        var maxBottom = 0;
        var elements = document.body.getElementsByTagName('*');
        var elemCount = Math.min(elements.length, 500); // Limit scan for performance
        
        for (var i = 0; i < elemCount; i++) {
          var el = elements[i];
          try {
            var style = window.getComputedStyle(el);
            // Skip invisible elements
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              continue;
            }
            
            var rect = el.getBoundingClientRect();
            if (rect.height > 0 && rect.width > 0) {
              maxBottom = Math.max(maxBottom, rect.bottom);
            }
          } catch (e) {
            // Ignore errors from getComputedStyle
          }
        }
        
        // Use the maximum of both methods + small padding
        var height = Math.max(docHeight, Math.ceil(maxBottom)) + 10;
        
        return height;
      }
      
      function stopObservers() {
        observersActive = false;
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (mutationObserver) {
          mutationObserver.disconnect();
        }
        log('Observers stopped - height stabilized at', lastHeight);
      }
      
      function reactivateObservers() {
        if (observersActive) return;
        
        observersActive = true;
        stableCount = 0;
        isStabilized = false;
        
        if (resizeObserver) {
          resizeObserver.observe(document.body);
          resizeObserver.observe(document.documentElement);
        }
        if (mutationObserver) {
          mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
        }
        
        log('Observers reactivated');
        updateHeight();
      }
      
      function updateHeight() {
        if (updateCount >= MAX_UPDATES && isStabilized) {
          return; // Safety: don't update forever
        }
        
        updateCount++;
        var height = getContentHeight();
        
        // Clamp to reasonable range
        height = Math.max(50, Math.min(height, 20000));
        
        var delta = Math.abs(height - lastHeight);
        
        if (delta <= HEIGHT_DELTA) {
          // Height is stable
          stableCount++;
          
          if (stableCount >= STABLE_THRESHOLD && !isStabilized) {
            isStabilized = true;
            log('Stabilized after ' + updateCount + ' updates, height:', lastHeight);
            stopObservers();
          }
          return; // Don't send redundant messages
        }
        
        // Height changed significantly
        stableCount = 0;
        lastHeight = height;
        
        log('Height update #' + updateCount + ':', height);
        window.parent.postMessage({ 
          type: 'resize', 
          height: height,
          sectionId: SECTION_ID,
          updateCount: updateCount
        }, '*');
      }
      
      function debouncedUpdate() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateHeight, 80);
      }
      
      // Initial measurements - spread out to catch late-loading content
      setTimeout(updateHeight, 0);
      setTimeout(updateHeight, 100);
      setTimeout(updateHeight, 300);
      setTimeout(updateHeight, 600);
      setTimeout(updateHeight, 1200);
      
      // Setup observers
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(debouncedUpdate);
        resizeObserver.observe(document.body);
        resizeObserver.observe(document.documentElement);
      }
      
      // Image/iframe load handlers
      function setupLoadHandlers() {
        document.querySelectorAll('img').forEach(function(img) {
          if (!img.complete) {
            img.addEventListener('load', debouncedUpdate);
            img.addEventListener('error', debouncedUpdate);
          }
        });
        
        document.querySelectorAll('iframe').forEach(function(iframe) {
          iframe.addEventListener('load', debouncedUpdate);
        });
      }
      setupLoadHandlers();
      
      // Font loading
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          setTimeout(updateHeight, 50);
          setTimeout(updateHeight, 200);
        });
      }
      
      // Mutation observer - watch for DOM changes
      mutationObserver = new MutationObserver(function(mutations) {
        // Check if new images/iframes were added
        mutations.forEach(function(mutation) {
          if (mutation.addedNodes) {
            mutation.addedNodes.forEach(function(node) {
              if (node.tagName === 'IMG' && !node.complete) {
                node.addEventListener('load', debouncedUpdate);
              }
              if (node.tagName === 'IFRAME') {
                node.addEventListener('load', debouncedUpdate);
              }
            });
          }
        });
        debouncedUpdate();
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'src']
      });
      
      // Reactivate on window resize (breakpoint change)
      window.addEventListener('resize', function() {
        reactivateObservers();
      });
      
      // Block link navigation in editor
      document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (link && link.href) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    })();
  </script>
</body>
</html>`;
}

export function IsolatedCustomBlock({
  htmlContent,
  cssContent = '',
  blockName = 'Conteúdo Importado',
  baseUrl,
  isEditing = false,
  className,
}: IsolatedCustomBlockProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(200);
  const lastHeightRef = useRef<number>(0);
  const updateCountRef = useRef<number>(0);
  
  // Sanitize HTML and process CSS (less aggressive for pixel-perfect)
  const sanitizedHtml = useMemo(() => sanitizeHtml(htmlContent), [htmlContent]);
  const processedCss = useMemo(() => processPixelPerfectCss(cssContent, sanitizedHtml), [cssContent, sanitizedHtml]);
  
  // Build iframe document with base URL for resolving relative paths
  const iframeDoc = useMemo(
    () => buildIframeDocument(sanitizedHtml, processedCss, baseUrl, blockName),
    [sanitizedHtml, processedCss, baseUrl, blockName]
  );
  
  // Generate unique ID for this block
  useEffect(() => {
    containerRef.current = `iframe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);
  
  // Handle messages from iframe - CRITICAL for auto-height with DEDUPE
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'resize' && typeof event.data.height === 'number') {
        const newHeight = event.data.height;
        
        // Clamp to reasonable range (safety)
        const clampedHeight = Math.max(50, Math.min(newHeight, 20000));
        
        // Dedupe: only update if delta > 3px
        const delta = Math.abs(clampedHeight - lastHeightRef.current);
        if (delta <= 3) {
          return;
        }
        
        updateCountRef.current++;
        lastHeightRef.current = clampedHeight;
        
        // Debug log in dev mode
        if (process.env.NODE_ENV === 'development') {
          console.log(`[IsolatedCustomBlock:${blockName}] Height update #${updateCountRef.current}: ${clampedHeight}px (delta: ${delta})`);
        }
        
        setIframeHeight(clampedHeight);
      }
      
      if (event.data?.type === 'link-click' && isEditing) {
        // In editing mode, just log - don't navigate
        console.log('[IsolatedCustomBlock] Link clicked (blocked in edit mode):', event.data.href);
      }
    }
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isEditing, blockName]);
  
  // Write content to iframe
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(iframeDoc);
        doc.close();
      }
    }
    
    // Reset counters when content changes
    lastHeightRef.current = 0;
    updateCountRef.current = 0;
  }, [iframeDoc]);
  
  // No content
  if (!sanitizedHtml) {
    if (isEditing) {
      return (
        <div className="p-4 bg-amber-500/10 border border-amber-500 rounded text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Bloco customizado sem conteúdo: {blockName}</span>
        </div>
      );
    }
    return null;
  }
  
  return (
    <div 
      className={cn(
        'isolated-custom-block relative w-full',
        isEditing && 'ring-1 ring-indigo-500/30 rounded-lg',
        className
      )}
      style={{
        // CRITICAL: Container must not restrict height - overflow visible
        overflow: 'visible',
      }}
    >
      {/* Editor indicator */}
      {isEditing && (
        <div className="absolute -top-6 right-0 bg-indigo-500 text-white text-xs px-2 py-1 rounded-t z-10 flex items-center gap-2 opacity-80">
          <Code className="w-3 h-3" />
          <span>{blockName}</span>
        </div>
      )}
      
      {/* Isolated iframe - NO internal scroll, auto-height */}
      <iframe
        ref={iframeRef}
        className="w-full border-0"
        style={{
          height: iframeHeight,
          minHeight: 50,
          display: 'block',
          // CRITICAL: No scrolling in iframe - content height is auto
          overflow: 'hidden',
          // Pointer events in editor mode
          pointerEvents: isEditing ? 'none' : 'auto',
        }}
        title={blockName}
        sandbox="allow-same-origin allow-scripts allow-popups"
        loading="lazy"
        scrolling="no"
      />
    </div>
  );
}

export default IsolatedCustomBlock;
