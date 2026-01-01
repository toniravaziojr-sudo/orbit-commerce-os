// =============================================
// ISOLATED CUSTOM BLOCK RENDERER - Uses iframe for 100% CSS isolation
// This prevents ANY CSS leakage to/from the builder or storefront
// 
// CRITICAL FIX v4: Stable auto-height + proper desktop/mobile variant handling
// - Uses refs for height (no setState causing re-render)
// - Detects and removes the wrong variant based on container width
// - Measures from parent via contentDocument (same-origin)
// =============================================

import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
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

// =============================================
// CRITICAL: Remove duplicate desktop/mobile variants from HTML
// Many landing pages have both .section1 (desktop) and .section1.tablet (mobile)
// We need to REMOVE the wrong variant based on current viewport width
// This cannot be done with media queries in iframes reliably
// =============================================
function removeWrongVariant(html: string, isMobile: boolean): string {
  if (!html) return html;
  
  // Patterns for mobile/tablet variants that should be hidden on desktop
  // On desktop (>=768px): hide .tablet, show regular
  // On mobile (<768px): hide regular (without .tablet), show .tablet
  
  // Pattern 1: Our wrapper classes from import
  if (html.includes('section-mobile-variant') || html.includes('section-desktop-variant')) {
    if (isMobile) {
      // Remove desktop variant wrapper
      html = html.replace(/<div class="section-desktop-variant"[^>]*>[\s\S]*?<\/div>\s*(?=<style|<\/div|$)/gi, '');
    } else {
      // Remove mobile variant wrapper
      html = html.replace(/<div class="section-mobile-variant"[^>]*>[\s\S]*?<\/div>\s*(?=<div class="section-desktop-variant"|<style|$)/gi, '');
    }
  }
  
  // Pattern 2: Original Shopify/Dooca patterns - .sectionN vs .sectionN.tablet
  // Handle sections with both class="section1" and class="section1 tablet"
  if (isMobile) {
    // On mobile: remove sections that are DESKTOP ONLY (have sectionN but NOT tablet)
    // Keep sections with class="sectionN tablet" or just "tablet" class
    // This is tricky - we need to remove <section class="section1 ..."> when it doesn't have tablet
    html = removeDesktopOnlySections(html);
  } else {
    // On desktop: remove sections with "tablet" in their class
    html = html.replace(/<section[^>]*class="[^"]*\btablet\b[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '');
    // Also remove elements with class="... tablet"
    html = html.replace(/<div[^>]*class="[^"]*\bproducts\s+tablet\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    html = html.replace(/<ul[^>]*class="[^"]*\btablet\b[^"]*"[^>]*>[\s\S]*?<\/ul>/gi, '');
  }
  
  // Remove inline media query styles (they won't work reliably in iframes)
  // These are added by our import process
  html = html.replace(/<style>\s*@media\s*\([^)]+\)\s*\{[^}]*\.section-(?:mobile|desktop)-variant[^}]*\}\s*<\/style>/gi, '');
  
  return html;
}

// Remove sections that are desktop-only (have sectionN class but NOT tablet)
function removeDesktopOnlySections(html: string): string {
  // Find all section tags with class containing "section" followed by number
  // Remove if they DON'T have "tablet" in the class
  
  // Pattern: <section class="section1 ..."> where ... does NOT contain "tablet"
  const sectionPattern = /<section([^>]*)class="([^"]*\bsection\d+\b[^"]*)"([^>]*)>([\s\S]*?)<\/section>/gi;
  
  return html.replace(sectionPattern, (match, before, classAttr, after, content) => {
    // If this section has "tablet" class, KEEP it (it's for mobile)
    if (/\btablet\b/i.test(classAttr)) {
      return match;
    }
    
    // Check if there's a corresponding tablet version nearby
    // If the HTML has both section1 and section1 tablet, remove the non-tablet one on mobile
    const sectionMatch = classAttr.match(/\bsection(\d+)\b/i);
    if (sectionMatch) {
      const sectionNum = sectionMatch[1];
      // Check if there's a tablet version of this section
      const tabletPattern = new RegExp(`class="[^"]*\\bsection${sectionNum}\\b[^"]*\\btablet\\b[^"]*"`, 'i');
      if (tabletPattern.test(html)) {
        // There IS a tablet version, so remove this desktop version on mobile
        return '';
      }
    }
    
    // No tablet version exists, keep this section
    return match;
  });
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
  
  // Track container width to determine mobile/desktop
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect if we're on mobile based on container/window width
  useEffect(() => {
    const checkMobile = () => {
      // Use container width if available, otherwise window width
      const width = containerRef.current?.offsetWidth || window.innerWidth;
      const mobile = width < 768;
      setIsMobile(mobile);
    };
    
    checkMobile();
    
    // Recheck on resize
    const handleResize = () => {
      checkMobile();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Process HTML - sanitize, materialize videos, AND remove wrong variant
  const processedHtml = useMemo(() => {
    let html = sanitizeHtml(htmlContent);
    html = materializeVideos(html);
    // CRITICAL: Remove the wrong desktop/mobile variant based on current viewport
    html = removeWrongVariant(html, isMobile);
    return html;
  }, [htmlContent, isMobile]);
  
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
