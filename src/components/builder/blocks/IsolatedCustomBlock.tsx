// =============================================
// ISOLATED CUSTOM BLOCK RENDERER - Uses iframe for 100% CSS isolation
// This prevents ANY CSS leakage to/from the builder or storefront
// 
// CRITICAL FIX v3: Stable auto-height without loops
// - Uses refs for height (no setState causing re-render)
// - Debounced measurement with stabilization detection
// - Measures from parent via contentDocument (same-origin)
// =============================================

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Code, AlertTriangle } from 'lucide-react';

interface IsolatedCustomBlockProps {
  htmlContent: string;
  cssContent?: string;
  blockName?: string;
  baseUrl?: string;
  isEditing?: boolean;
  className?: string;
}

// Sanitize HTML to remove dangerous elements
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
      return `<div class="video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
        <iframe src="https://www.youtube.com/embed/${videoId}?rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
      </div>`;
    }
  );
  
  // Pattern 3: Thumbnails with YouTube URLs in links
  result = result.replace(
    /<a[^>]*href=["'](?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
    (match, videoId) => {
      if (match.includes('<img')) {
        return `<div class="video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
          <iframe src="https://www.youtube.com/embed/${videoId}?rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
        </div>`;
      }
      return match;
    }
  );
  
  return result;
}

// Build complete HTML document for iframe
function buildIframeDocument(html: string, css: string, baseUrl?: string, disableLinks: boolean = false): string {
  let baseHref = '';
  if (baseUrl) {
    try {
      const url = new URL(baseUrl);
      baseHref = `${url.origin}/`;
    } catch {
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
    /* CSS Reset - Anti-interference for height measurement */
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
    ${disableLinks ? 'a { pointer-events: none; cursor: default; }' : 'a { color: inherit; }'}
    
    iframe[src*="youtube.com"], iframe[src*="youtu.be"], iframe[src*="vimeo.com"] {
      max-width: 100%;
    }
    .video-embed { margin: 1rem 0; }
  </style>
  <style>
    /* Imported CSS */
    ${css}
  </style>
  <style>
    /* Override to ensure measurement works */
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

// Measure content height from contentDocument
function measureContentHeight(doc: Document): number {
  if (!doc || !doc.body) return 200;
  
  // Force layout
  doc.body.offsetHeight;
  
  // Get heights from multiple sources
  const heights = [
    doc.body.scrollHeight || 0,
    doc.body.offsetHeight || 0,
    doc.documentElement?.scrollHeight || 0,
    doc.documentElement?.offsetHeight || 0,
  ];
  
  // Also try bounding rect
  try {
    const bodyRect = doc.body.getBoundingClientRect();
    if (bodyRect.height > 0) heights.push(Math.ceil(bodyRect.height));
  } catch {}
  
  const maxHeight = Math.max(...heights);
  
  // Add small padding and clamp
  return Math.max(50, Math.min(maxHeight + 10, 25000));
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
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(200);
  const stableCountRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  
  // Process HTML
  const processedHtml = useMemo(() => {
    const sanitized = sanitizeHtml(htmlContent);
    return materializeVideos(sanitized);
  }, [htmlContent]);
  
  // Build iframe document
  const iframeDoc = useMemo(
    () => buildIframeDocument(processedHtml, cssContent, baseUrl, isEditing),
    [processedHtml, cssContent, baseUrl, isEditing]
  );
  
  // Measure and update height imperatively (no setState = no re-render)
  const measureAndUpdateHeight = useCallback(() => {
    if (!iframeRef.current?.contentDocument || !containerRef.current) return;
    
    const doc = iframeRef.current.contentDocument;
    const newHeight = measureContentHeight(doc);
    
    const delta = Math.abs(newHeight - lastHeightRef.current);
    
    // Only update if significant change
    if (delta > 5) {
      lastHeightRef.current = newHeight;
      // Direct DOM update - no React state
      if (iframeRef.current) {
        iframeRef.current.style.height = `${newHeight}px`;
      }
      stableCountRef.current = 0;
    } else {
      stableCountRef.current++;
    }
    
    // Continue measuring until stable (5 consecutive stable readings)
    if (stableCountRef.current < 5) {
      const timeout = setTimeout(measureAndUpdateHeight, 150);
      timeoutsRef.current.push(timeout);
    }
  }, []);
  
  // Handle iframe load
  const handleLoad = useCallback(() => {
    // Reset
    lastHeightRef.current = 200;
    stableCountRef.current = 0;
    
    // Clear pending timeouts
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    
    // Initial set
    if (iframeRef.current) {
      iframeRef.current.style.height = '200px';
    }
    
    // Start measurement sequence
    requestAnimationFrame(() => {
      measureAndUpdateHeight();
    });
    
    // Additional measurements for late-loading content
    const delays = [100, 300, 600, 1000, 2000];
    delays.forEach(delay => {
      const timeout = setTimeout(measureAndUpdateHeight, delay);
      timeoutsRef.current.push(timeout);
    });
  }, [measureAndUpdateHeight]);
  
  // Write content to iframe and setup
  useEffect(() => {
    if (!iframeRef.current) return;
    
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(iframeDoc);
      doc.close();
      handleLoad();
    }
    
    return () => {
      // Cleanup
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [iframeDoc, handleLoad]);
  
  // Re-measure on window resize
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        stableCountRef.current = 0;
        measureAndUpdateHeight();
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [measureAndUpdateHeight]);
  
  // Empty state
  if (!processedHtml) {
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
      ref={containerRef}
      className={cn(
        'isolated-custom-block relative w-full',
        isEditing && 'ring-1 ring-indigo-500/30 rounded-lg',
        className
      )}
      style={{ overflow: 'visible' }}
    >
      {isEditing && (
        <div className="absolute -top-6 right-0 bg-indigo-500 text-white text-xs px-2 py-1 rounded-t z-10 flex items-center gap-2 opacity-80">
          <Code className="w-3 h-3" />
          <span>{blockName}</span>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        className="w-full border-0"
        style={{
          height: 200, // Initial height, updated imperatively
          minHeight: 50,
          display: 'block',
          overflow: 'hidden',
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
