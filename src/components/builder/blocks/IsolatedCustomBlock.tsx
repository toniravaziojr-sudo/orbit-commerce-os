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
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    img { max-width: 100%; height: auto; display: block; }
    a { color: inherit; }
    
    /* Imported CSS */
    ${css}
  </style>
</head>
<body>
  ${html}
  <script>
    // Resize handler for parent
    function updateHeight() {
      const height = document.body.scrollHeight;
      window.parent.postMessage({ type: 'resize', height: height }, '*');
    }
    
    // Initial size
    updateHeight();
    
    // Observe size changes
    const observer = new ResizeObserver(updateHeight);
    observer.observe(document.body);
    
    // Prevent navigation in editing mode
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (link && link.href) {
        e.preventDefault();
        window.parent.postMessage({ type: 'link-click', href: link.href }, '*');
      }
    });
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
  const [iframeHeight, setIframeHeight] = useState(400);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Sanitize HTML and process CSS (less aggressive for pixel-perfect)
  const sanitizedHtml = useMemo(() => sanitizeHtml(htmlContent), [htmlContent]);
  const processedCss = useMemo(() => processPixelPerfectCss(cssContent, sanitizedHtml), [cssContent, sanitizedHtml]);
  
  // Build iframe document with base URL for resolving relative paths
  const iframeDoc = useMemo(
    () => buildIframeDocument(sanitizedHtml, processedCss, baseUrl),
    [sanitizedHtml, processedCss, baseUrl]
  );
  
  // Handle messages from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'resize' && typeof event.data.height === 'number') {
        setIframeHeight(Math.max(100, event.data.height + 20));
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
  
  const maxHeight = isExpanded ? undefined : 800;
  
  return (
    <div 
      className={cn(
        'isolated-custom-block relative w-full',
        isEditing && 'ring-1 ring-indigo-500/30 rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Editor indicator */}
      {isEditing && (
        <div className="absolute -top-6 right-0 bg-indigo-500 text-white text-xs px-2 py-1 rounded-t z-10 flex items-center gap-2 opacity-80">
          <Code className="w-3 h-3" />
          <span>{blockName}</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-2 hover:opacity-75 transition-opacity"
            title={isExpanded ? 'Reduzir' : 'Expandir'}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      )}
      
      {/* Isolated iframe */}
      <iframe
        ref={iframeRef}
        className="w-full border-0"
        style={{
          height: maxHeight ? Math.min(iframeHeight, maxHeight) : iframeHeight,
          display: 'block',
          overflow: 'hidden',
        }}
        title={blockName}
        sandbox="allow-same-origin allow-scripts"
        loading="lazy"
      />
      
      {/* Show more indicator */}
      {!isExpanded && maxHeight && iframeHeight > maxHeight && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      )}
    </div>
  );
}

export default IsolatedCustomBlock;
