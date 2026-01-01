// =============================================
// ISOLATED CUSTOM BLOCK RENDERER - Uses iframe for 100% CSS isolation
// This prevents ANY CSS leakage to/from the builder or storefront
// CRITICAL: Height measured from PARENT via contentDocument (same-origin)
// =============================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

// Materialize YouTube/Vimeo placeholders into real iframes
function materializeVideos(html: string): string {
  if (!html) return '';
  
  let result = html;
  
  // Pattern 1: data-youtube, data-video-id, data-yt-id attributes
  result = result.replace(
    /<([a-z]+)[^>]*(?:data-youtube|data-video-id|data-yt-id|data-video-url)=["']([^"']+)["'][^>]*>[\s\S]*?<\/\1>/gi,
    (match, tag, videoId) => {
      // Extract video ID from various formats
      let id = videoId;
      if (videoId.includes('youtube.com/watch')) {
        const urlMatch = videoId.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (urlMatch) id = urlMatch[1];
      } else if (videoId.includes('youtu.be/')) {
        const urlMatch = videoId.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (urlMatch) id = urlMatch[1];
      } else if (videoId.includes('youtube.com/embed/')) {
        const urlMatch = videoId.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (urlMatch) id = urlMatch[1];
      }
      
      if (id && id.length === 11) {
        console.log('[MaterializeVideos] Converted placeholder to YouTube iframe:', id);
        return `<div class="video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
          <iframe src="https://www.youtube.com/embed/${id}?rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
        </div>`;
      }
      return match;
    }
  );
  
  // Pattern 2: lite-youtube, youtube-video custom elements
  result = result.replace(
    /<(lite-youtube|youtube-video)[^>]*(?:videoid|video-id)=["']([a-zA-Z0-9_-]{11})["'][^>]*>[\s\S]*?<\/\1>/gi,
    (match, tag, videoId) => {
      console.log('[MaterializeVideos] Converted custom element to YouTube iframe:', videoId);
      return `<div class="video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
        <iframe src="https://www.youtube.com/embed/${videoId}?rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
      </div>`;
    }
  );
  
  // Pattern 3: Thumbnails with YouTube URLs in data attributes or links
  result = result.replace(
    /<a[^>]*href=["'](?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
    (match, videoId) => {
      // Only replace if it looks like a video thumbnail (contains img)
      if (match.includes('<img')) {
        console.log('[MaterializeVideos] Converted thumbnail link to YouTube iframe:', videoId);
        return `<div class="video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
          <iframe src="https://www.youtube.com/embed/${videoId}?rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
        </div>`;
      }
      return match;
    }
  );
  
  return result;
}

// Process CSS for pixel-perfect rendering
// CRITICAL: For pixel-perfect, we keep EVERYTHING including display:none
// because the page uses CSS to show/hide mobile vs desktop elements
function processPixelPerfectCss(css: string): string {
  if (!css) return '';
  
  // For pixel-perfect, only remove rules that could affect the PARENT page
  // Since we're in an iframe, almost nothing can leak out
  const safeCss = css
    // Remove @import (already resolved at import time)
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
// NO INTERNAL SCRIPT - height is measured from parent via contentDocument
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

  return `<!DOCTYPE html>
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
    a { color: inherit; pointer-events: none; }
    
    /* YouTube/Vimeo iframe responsive */
    iframe[src*="youtube.com"], iframe[src*="youtu.be"], iframe[src*="vimeo.com"] {
      max-width: 100%;
    }
    
    .video-embed {
      margin: 1rem 0;
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
</body>
</html>`;
}

// Measure content height from parent (same-origin iframe)
function measureContentHeight(doc: Document): number {
  if (!doc || !doc.body) return 200;
  
  // Force layout recalculation
  doc.body.offsetHeight;
  
  // Method 1: Document scroll/offset heights
  const docHeight = Math.max(
    doc.body.scrollHeight || 0,
    doc.body.offsetHeight || 0,
    doc.documentElement?.scrollHeight || 0,
    doc.documentElement?.offsetHeight || 0,
    doc.documentElement?.clientHeight || 0
  );
  
  // Method 2: Find the bottommost visible element via getBoundingClientRect
  let maxBottom = 0;
  try {
    const elements = doc.body.getElementsByTagName('*');
    const elemCount = Math.min(elements.length, 500); // Limit scan for performance
    
    for (let i = 0; i < elemCount; i++) {
      const el = elements[i] as HTMLElement;
      try {
        const style = doc.defaultView?.getComputedStyle(el);
        // Skip invisible elements
        if (style?.display === 'none' || style?.visibility === 'hidden' || style?.opacity === '0') {
          continue;
        }
        
        const rect = el.getBoundingClientRect();
        if (rect.height > 0 && rect.width > 0) {
          maxBottom = Math.max(maxBottom, rect.bottom);
        }
      } catch {
        // Ignore errors from getComputedStyle
      }
    }
  } catch {
    // Fallback if getElementsByTagName fails
  }
  
  // Use the maximum of both methods + padding
  const height = Math.max(docHeight, Math.ceil(maxBottom)) + 20;
  
  // Clamp to reasonable range
  return Math.max(50, Math.min(height, 30000));
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
  const [iframeHeight, setIframeHeight] = useState<number>(200);
  const lastHeightRef = useRef<number>(0);
  const measureCountRef = useRef<number>(0);
  const isStabilizedRef = useRef<boolean>(false);
  const observersRef = useRef<{ resize?: ResizeObserver; mutation?: MutationObserver }>({});
  
  // Sanitize HTML, materialize videos, and process CSS
  const sanitizedHtml = useMemo(() => {
    const sanitized = sanitizeHtml(htmlContent);
    return materializeVideos(sanitized);
  }, [htmlContent]);
  
  const processedCss = useMemo(() => processPixelPerfectCss(cssContent), [cssContent]);
  
  // Build iframe document with base URL for resolving relative paths
  const iframeDoc = useMemo(
    () => buildIframeDocument(sanitizedHtml, processedCss, baseUrl),
    [sanitizedHtml, processedCss, baseUrl]
  );
  
  // Measure height from parent (same-origin contentDocument)
  const measureHeight = useCallback(() => {
    if (!iframeRef.current?.contentDocument) return;
    if (isStabilizedRef.current && measureCountRef.current > 10) return; // Stop after stabilization
    
    measureCountRef.current++;
    const doc = iframeRef.current.contentDocument;
    const newHeight = measureContentHeight(doc);
    
    const delta = Math.abs(newHeight - lastHeightRef.current);
    
    // Only update if delta > 4px (avoid micro-adjustments)
    if (delta <= 4) {
      // Count stable readings
      if (measureCountRef.current > 5) {
        isStabilizedRef.current = true;
        if (process.env.NODE_ENV === 'development') {
          console.log(`[IsolatedCustomBlock:${blockName}] Stabilized at ${lastHeightRef.current}px after ${measureCountRef.current} measurements`);
        }
      }
      return;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[IsolatedCustomBlock:${blockName}] Height: ${newHeight}px (delta: ${delta})`);
    }
    
    lastHeightRef.current = newHeight;
    setIframeHeight(newHeight);
  }, [blockName]);
  
  // Debounced measurement
  const debouncedMeasure = useCallback(() => {
    const timerId = setTimeout(measureHeight, 100);
    return () => clearTimeout(timerId);
  }, [measureHeight]);
  
  // Setup observers on iframe content
  const setupObservers = useCallback(() => {
    if (!iframeRef.current?.contentDocument) return;
    
    const doc = iframeRef.current.contentDocument;
    
    // Cleanup existing observers
    observersRef.current.resize?.disconnect();
    observersRef.current.mutation?.disconnect();
    
    // ResizeObserver for body size changes
    if (typeof ResizeObserver !== 'undefined' && doc.body) {
      observersRef.current.resize = new ResizeObserver(() => {
        if (!isStabilizedRef.current) {
          debouncedMeasure();
        }
      });
      observersRef.current.resize.observe(doc.body);
    }
    
    // MutationObserver for DOM changes
    if (doc.body) {
      observersRef.current.mutation = new MutationObserver(() => {
        if (!isStabilizedRef.current) {
          debouncedMeasure();
        }
      });
      observersRef.current.mutation.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'src']
      });
    }
    
    // Image load handlers
    doc.querySelectorAll('img').forEach((img: HTMLImageElement) => {
      if (!img.complete) {
        img.addEventListener('load', measureHeight);
        img.addEventListener('error', measureHeight);
      }
    });
    
    // Iframe load handlers (YouTube embeds)
    doc.querySelectorAll('iframe').forEach((frame: HTMLIFrameElement) => {
      frame.addEventListener('load', measureHeight);
    });
    
    // Font loading
    if (doc.fonts?.ready) {
      doc.fonts.ready.then(() => {
        setTimeout(measureHeight, 50);
        setTimeout(measureHeight, 200);
      });
    }
  }, [debouncedMeasure, measureHeight]);
  
  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    // Reset state
    lastHeightRef.current = 0;
    measureCountRef.current = 0;
    isStabilizedRef.current = false;
    
    // Initial measurements at various intervals to catch late-loading content
    setTimeout(measureHeight, 0);
    setTimeout(measureHeight, 50);
    setTimeout(measureHeight, 150);
    setTimeout(measureHeight, 300);
    setTimeout(measureHeight, 600);
    setTimeout(measureHeight, 1000);
    setTimeout(measureHeight, 2000);
    
    // Setup observers
    setTimeout(setupObservers, 100);
  }, [measureHeight, setupObservers]);
  
  // Write content to iframe
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(iframeDoc);
        doc.close();
        
        // Trigger load handling
        handleIframeLoad();
      }
    }
    
    // Cleanup on unmount
    return () => {
      observersRef.current.resize?.disconnect();
      observersRef.current.mutation?.disconnect();
    };
  }, [iframeDoc, handleIframeLoad]);
  
  // Re-measure on window resize (breakpoint change)
  useEffect(() => {
    const handleResize = () => {
      isStabilizedRef.current = false;
      measureCountRef.current = 0;
      measureHeight();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureHeight]);
  
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
        sandbox="allow-same-origin"
        loading="lazy"
        scrolling="no"
      />
    </div>
  );
}

export default IsolatedCustomBlock;
