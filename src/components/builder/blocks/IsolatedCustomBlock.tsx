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
    // ROBUST AUTO-HEIGHT - Measure true content height
    // =============================================
    (function() {
      var lastHeight = 0;
      var debounceTimer = null;
      
      function getContentHeight() {
        // Force layout recalculation
        document.body.offsetHeight;
        
        // Method 1: Document scroll heights
        var docHeight = Math.max(
          document.body.scrollHeight || 0,
          document.body.offsetHeight || 0,
          document.documentElement.scrollHeight || 0,
          document.documentElement.offsetHeight || 0
        );
        
        // Method 2: Find the bottommost element
        var maxBottom = 0;
        var allElements = document.body.querySelectorAll('*');
        for (var i = 0; i < allElements.length; i++) {
          var el = allElements[i];
          // Skip invisible elements
          var style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          
          var rect = el.getBoundingClientRect();
          if (rect.height > 0) {
            maxBottom = Math.max(maxBottom, rect.bottom);
          }
        }
        
        // Use the maximum of both methods
        var height = Math.max(docHeight, Math.ceil(maxBottom));
        
        // Add padding to ensure nothing is cut
        return height + 20;
      }
      
      function updateHeight() {
        var height = getContentHeight();
        
        // Only update if height changed (prevent loops)
        if (Math.abs(height - lastHeight) > 2) {
          lastHeight = height;
          window.parent.postMessage({ type: 'resize', height: height }, '*');
        }
      }
      
      function debouncedUpdate() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateHeight, 100);
      }
      
      // Multiple measurement passes
      setTimeout(updateHeight, 50);
      setTimeout(updateHeight, 200);
      setTimeout(updateHeight, 500);
      setTimeout(updateHeight, 1000);
      setTimeout(updateHeight, 2000);
      
      // Watch for size changes
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(debouncedUpdate).observe(document.body);
        new ResizeObserver(debouncedUpdate).observe(document.documentElement);
      }
      
      // Image load
      document.querySelectorAll('img').forEach(function(img) {
        if (!img.complete) {
          img.addEventListener('load', debouncedUpdate);
          img.addEventListener('error', debouncedUpdate);
        }
      });
      
      // Iframe load (videos)
      document.querySelectorAll('iframe').forEach(function(iframe) {
        iframe.addEventListener('load', debouncedUpdate);
      });
      
      // Font loading
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          setTimeout(updateHeight, 100);
        });
      }
      
      // Mutation observer for dynamic content
      new MutationObserver(debouncedUpdate).observe(document.body, {
        childList: true, subtree: true, attributes: true
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
      }
      if (event.data?.type === 'link-click' && isEditing) {
        // In editing mode, just log - don't navigate
        console.log('[IsolatedCustomBlock] Link clicked (blocked in edit mode):', event.data.href);
      }
    }
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isEditing]);
  
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
  
  // For auto-height: NO max height restriction - show full content
  const computedHeight = typeof iframeHeight === 'number' ? iframeHeight : 200;
  
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
        </div>
      )}
      
      {/* Isolated iframe - NO internal scroll, auto-height */}
      <iframe
        ref={iframeRef}
        className="w-full border-0"
        style={{
          height: computedHeight,
          minHeight: 100,
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
    </div>
  );
}

export default IsolatedCustomBlock;
