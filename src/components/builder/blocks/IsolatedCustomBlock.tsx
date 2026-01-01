// =============================================
// ISOLATED CUSTOM BLOCK RENDERER - Uses iframe for 100% CSS isolation
// This prevents ANY CSS leakage to/from the builder or storefront
// =============================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Code, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';

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
// CRITICAL: Robust auto-height to eliminate internal scroll
function buildIframeDocument(html: string, css: string, baseUrl?: string): string {
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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseHref ? `<base href="${baseHref}" target="_blank">` : ''}
  <style>
    /* Reset - minimal to not conflict with imported styles */
    *, *::before, *::after { box-sizing: border-box; }
    html, body { 
      margin: 0;
      padding: 0;
      /* CRITICAL: No overflow restrictions - let content define height */
      overflow: visible !important;
      overflow-x: hidden;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      /* CRITICAL: Body takes full height of content */
      min-height: fit-content;
    }
    img { max-width: 100%; height: auto; display: block; }
    a { color: inherit; }
    
    /* YouTube/Vimeo iframe responsive */
    iframe[src*="youtube.com"], iframe[src*="youtu.be"], iframe[src*="vimeo.com"] {
      max-width: 100%;
    }
    
    /* Imported CSS */
    ${css}
  </style>
</head>
<body>
  ${html}
  <script>
    // =============================================
    // ROBUST AUTO-HEIGHT - Eliminates internal scroll
    // =============================================
    (function() {
      var lastHeight = 0;
      var updateCount = 0;
      
      function getContentHeight() {
        // Get maximum height from multiple sources
        var heights = [
          document.body.scrollHeight || 0,
          document.body.offsetHeight || 0,
          document.documentElement.scrollHeight || 0,
          document.documentElement.offsetHeight || 0,
          document.body.clientHeight || 0,
          document.documentElement.clientHeight || 0
        ];
        
        // Also measure all direct children of body
        var children = document.body.children;
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          var rect = child.getBoundingClientRect();
          heights.push(rect.bottom + window.scrollY);
        }
        
        return Math.ceil(Math.max.apply(null, heights));
      }
      
      function updateHeight() {
        var height = getContentHeight();
        // Add small padding to avoid edge cases
        height = height + 10;
        
        // Only send if height changed (or first few times)
        if (height !== lastHeight || updateCount < 5) {
          lastHeight = height;
          updateCount++;
          window.parent.postMessage({ type: 'resize', height: height }, '*');
        }
      }
      
      // Initial measurements with progressive delays
      setTimeout(updateHeight, 50);
      setTimeout(updateHeight, 150);
      setTimeout(updateHeight, 300);
      setTimeout(updateHeight, 600);
      setTimeout(updateHeight, 1200);
      setTimeout(updateHeight, 2500);
      
      // ResizeObserver for dynamic content
      if (typeof ResizeObserver !== 'undefined') {
        var observer = new ResizeObserver(function() {
          setTimeout(updateHeight, 30);
        });
        observer.observe(document.body);
        observer.observe(document.documentElement);
        
        // Also observe all sections
        document.querySelectorAll('section, div, article').forEach(function(el) {
          if (el.offsetHeight > 50) {
            observer.observe(el);
          }
        });
      }
      
      // MutationObserver as fallback
      if (typeof MutationObserver !== 'undefined') {
        var mutationObserver = new MutationObserver(function() {
          setTimeout(updateHeight, 50);
        });
        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      }
      
      // Image load handlers - CRITICAL for images that load after initial render
      document.querySelectorAll('img').forEach(function(img) {
        if (img.complete) {
          setTimeout(updateHeight, 10);
        } else {
          img.onload = function() { setTimeout(updateHeight, 50); };
          img.onerror = function() { setTimeout(updateHeight, 50); };
        }
      });
      
      // Iframe load handlers (for embedded videos)
      document.querySelectorAll('iframe').forEach(function(iframe) {
        iframe.onload = function() { setTimeout(updateHeight, 200); };
      });
      
      // Window resize
      window.addEventListener('resize', function() {
        setTimeout(updateHeight, 100);
      });
      
      // Font loading
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          setTimeout(updateHeight, 100);
        });
      }
      
      // Prevent link navigation in editing mode
      document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (link && link.href) {
          e.preventDefault();
          e.stopPropagation();
          window.parent.postMessage({ type: 'link-click', href: link.href }, '*');
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
  const [iframeHeight, setIframeHeight] = useState<number | 'auto'>('auto');
  const [minHeight, setMinHeight] = useState(200);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExpandPending, setIsExpandPending] = useState(false); // Prevent rapid clicks
  
  // Sanitize HTML and process CSS (less aggressive for pixel-perfect)
  const sanitizedHtml = useMemo(() => sanitizeHtml(htmlContent), [htmlContent]);
  const processedCss = useMemo(() => processPixelPerfectCss(cssContent, sanitizedHtml), [cssContent, sanitizedHtml]);
  
  // Build iframe document with base URL for resolving relative paths
  const iframeDoc = useMemo(
    () => buildIframeDocument(sanitizedHtml, processedCss, baseUrl),
    [sanitizedHtml, processedCss, baseUrl]
  );
  
  // Generate unique ID for this block
  useEffect(() => {
    containerRef.current = `iframe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);
  
  // Handle messages from iframe - CRITICAL for auto-height
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'resize' && typeof event.data.height === 'number') {
        const newHeight = Math.max(100, event.data.height);
        setIframeHeight(newHeight);
        setMinHeight(Math.max(minHeight, newHeight));
      }
      if (event.data?.type === 'link-click' && isEditing) {
        // In editing mode, just log - don't navigate
        console.log('[IsolatedCustomBlock] Link clicked (blocked in edit mode):', event.data.href);
      }
    }
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isEditing, minHeight]);
  
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
  
  // For auto-height: no max height restriction in public view, generous in editor
  const maxHeight = isExpanded ? undefined : (isEditing ? 3000 : undefined);
  const computedHeight = typeof iframeHeight === 'number' 
    ? (maxHeight ? Math.min(iframeHeight, maxHeight) : iframeHeight)
    : minHeight;
  
  return (
    <div 
      className={cn(
        'isolated-custom-block relative w-full',
        isEditing && 'ring-1 ring-indigo-500/30 rounded-lg',
        className
      )}
      style={{
        // CRITICAL: Container must not restrict height
        overflow: 'visible',
      }}
    >
      {/* Editor indicator */}
      {isEditing && (
        <div className="absolute -top-6 right-0 bg-indigo-500 text-white text-xs px-2 py-1 rounded-t z-10 flex items-center gap-2 opacity-80">
          <Code className="w-3 h-3" />
          <span>{blockName}</span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isExpandPending) return;
              setIsExpandPending(true);
              setIsExpanded(!isExpanded);
              setTimeout(() => setIsExpandPending(false), 300);
            }}
            className="ml-2 hover:opacity-75 transition-opacity"
            title={isExpanded ? 'Reduzir' : 'Expandir'}
            disabled={isExpandPending}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      )}
      
      {/* Isolated iframe - NO internal scroll, auto-height */}
      <iframe
        ref={iframeRef}
        className="w-full border-0"
        style={{
          height: computedHeight,
          minHeight: Math.max(100, minHeight),
          display: 'block',
          // CRITICAL: No scrolling in iframe
          overflow: 'hidden',
          // Pointer events in editor mode
          pointerEvents: isEditing ? 'none' : 'auto',
        }}
        title={blockName}
        sandbox="allow-same-origin allow-scripts allow-popups"
        loading="lazy"
        scrolling="no"
      />
      
      {/* Show more indicator (only in editor when content is truncated) */}
      {isEditing && !isExpanded && maxHeight && typeof iframeHeight === 'number' && iframeHeight > maxHeight && (
        <button 
          type="button"
          className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent flex items-end justify-center pb-2 cursor-pointer border-0 outline-none"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isExpandPending) return;
            setIsExpandPending(true);
            setIsExpanded(true);
            setTimeout(() => setIsExpandPending(false), 300);
          }}
          disabled={isExpandPending}
        >
          <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded pointer-events-none">
            Clique para expandir ({Math.round(iframeHeight)}px)
          </span>
        </button>
      )}
    </div>
  );
}

export default IsolatedCustomBlock;
