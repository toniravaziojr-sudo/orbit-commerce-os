// =============================================
// ISOLATED CUSTOM BLOCK RENDERER - Uses iframe for 100% CSS isolation
// This prevents ANY CSS leakage to/from the builder or storefront
// 
// CRITICAL FIX v4: Stable auto-height + proper desktop/mobile variant handling
// - Uses refs for height (no setState causing re-render)
// - Detects and removes the wrong variant based on container width
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

// =============================================
// CRITICAL: Inject CSS to hide the wrong desktop/mobile variant
// Uses CSS media queries so we don't need to rewrite HTML on resize
// This prevents loops and is more reliable
// =============================================
function getResponsiveVariantCss(): string {
  return `
    /* === RESPONSIVE VARIANT HIDING === */
    /* On mobile (< 768px): hide desktop-only sections when tablet variant exists */
    @media (max-width: 767px) {
      /* Hide desktop-variant wrappers from import */
      .section-desktop-variant { display: none !important; }
      
      /* Hide non-tablet products div when tablet exists */
      .products:not(.tablet) { display: none !important; }
      
      /* Reset any spacing issues */
      body > section,
      body > div { margin: 0 !important; }
    }
    
    /* On desktop (>= 768px): hide tablet sections */
    @media (min-width: 768px) {
      /* Hide tablet sections on desktop */
      section.tablet,
      .section1.tablet,
      .section2.tablet,
      .section3.tablet,
      .section4.tablet,
      .section5.tablet,
      .section6.tablet,
      .section7.tablet,
      .section8.tablet,
      .section9.tablet,
      .section10.tablet,
      [class*="section"][class*="tablet"] {
        display: none !important;
      }
      
      /* Hide mobile-variant wrappers from import */
      .section-mobile-variant { display: none !important; }
      
      /* Hide tablet products div */
      .products.tablet { display: none !important; }
    }
  `;
}

// Add inline style to hide desktop sections that have a tablet variant (on mobile)
function addMobileHidingStyles(html: string): string {
  // Parse which sections have tablet variants
  const tabletSections = new Set<string>();
  const tabletPattern = /<section[^>]*class="[^"]*\bsection(\d+)\b[^"]*\btablet\b[^"]*"/gi;
  let match;
  while ((match = tabletPattern.exec(html)) !== null) {
    tabletSections.add(match[1]);
  }
  
  if (tabletSections.size === 0) return html;
  
  // Generate CSS that hides non-tablet sections on mobile ONLY for sections that have tablet variant
  let hidingCss = '@media (max-width: 767px) {\n';
  tabletSections.forEach(num => {
    hidingCss += `  section.section${num}:not(.tablet) { display: none !important; }\n`;
  });
  hidingCss += '}\n';
  
  // Also ensure sections WITHOUT tablet variant are shown on mobile
  let showingCss = '@media (max-width: 767px) {\n';
  for (let i = 1; i <= 10; i++) {
    if (!tabletSections.has(String(i))) {
      showingCss += `  section.section${i}:not(.tablet) { display: block !important; }\n`;
    }
  }
  showingCss += '}\n';
  
  // Inject CSS into HTML
  const combinedCss = `<style data-variant-hiding="true">\n${hidingCss}\n${showingCss}</style>`;
  
  if (html.includes('</body>')) {
    return html.replace('</body>', `${combinedCss}</body>`);
  } else {
    return html + combinedCss;
  }
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
  const measurementCountRef = useRef<number>(0);
  const isStableRef = useRef<boolean>(false);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  
  // Process HTML - sanitize, materialize videos, AND add responsive variant hiding
  const processedHtml = useMemo(() => {
    let html = sanitizeHtml(htmlContent);
    html = materializeVideos(html);
    html = addMobileHidingStyles(html);
    return html;
  }, [htmlContent]);
  
  // Get responsive variant CSS (uses media queries)
  const variantCss = useMemo(() => getResponsiveVariantCss(), []);
  
  // Combine CSS with variant hiding rules
  const finalCss = useMemo(() => `${cssContent}\n${variantCss}`, [cssContent, variantCss]);
  
  // Build iframe document
  const iframeDoc = useMemo(
    () => buildIframeDocument(processedHtml, finalCss, baseUrl, isEditing),
    [processedHtml, finalCss, baseUrl, isEditing]
  );
  
  // Measure and update height - ALWAYS update, with hard limit for iterations
  const measureAndUpdateHeight = useCallback(() => {
    // CRITICAL: Hard limit to prevent infinite loops
    if (measurementCountRef.current >= 15) {
      return;
    }
    
    if (!iframeRef.current?.contentDocument) return;
    
    measurementCountRef.current++;
    
    const doc = iframeRef.current.contentDocument;
    const newHeight = measureContentHeight(doc);
    
    // ALWAYS update height if meaningful (> 50px) - don't skip on first load
    if (newHeight > 50) {
      const delta = Math.abs(newHeight - lastHeightRef.current);
      
      if (delta > 5 || lastHeightRef.current === 200) {
        lastHeightRef.current = newHeight;
        if (iframeRef.current) {
          iframeRef.current.style.height = `${newHeight}px`;
        }
      } else if (delta < 3) {
        // Height is stable
        isStableRef.current = true;
      }
    }
  }, []);
  
  // Handle iframe load
  const handleLoad = useCallback(() => {
    // Reset counters
    lastHeightRef.current = 200;
    measurementCountRef.current = 0;
    isStableRef.current = false;
    
    // Clear pending timeouts
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    
    // DON'T set initial height to 200 - let measureAndUpdateHeight do it
    
    // Start measurement sequence immediately and repeatedly
    requestAnimationFrame(() => {
      measureAndUpdateHeight();
    });
    
    // Multiple delayed measurements to catch late-loading content
    const delays = [50, 150, 300, 600, 1000, 2000, 3000];
    delays.forEach(delay => {
      const timeout = setTimeout(() => {
        if (!isStableRef.current && measurementCountRef.current < 15) {
          measureAndUpdateHeight();
        }
      }, delay);
      timeoutsRef.current.push(timeout);
    });
  }, [measureAndUpdateHeight]);
  
  // Track last written content to prevent unnecessary rewrites
  const lastWrittenDocRef = useRef<string>('');
  
  // Write content to iframe and setup - only if content actually changed
  useEffect(() => {
    if (!iframeRef.current) return;
    
    // Skip if content hasn't changed (prevents loop on resize)
    if (lastWrittenDocRef.current === iframeDoc) {
      return;
    }
    
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      lastWrittenDocRef.current = iframeDoc;
      doc.open();
      doc.write(iframeDoc);
      doc.close();
      handleLoad();
    }
    
    return () => {
      // Cleanup
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [iframeDoc, handleLoad]);
  
  // Re-measure on window resize (with debounce and limit)
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Reset measurement counter for resize, but limit it
        measurementCountRef.current = 0;
        isStableRef.current = false;
        measureAndUpdateHeight();
      }, 150);
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
        sandbox="allow-same-origin allow-scripts allow-popups"
        loading="lazy"
        scrolling="no"
      />
    </div>
  );
}

export default IsolatedCustomBlock;
