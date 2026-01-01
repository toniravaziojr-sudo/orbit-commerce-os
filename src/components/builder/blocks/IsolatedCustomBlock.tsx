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
// CRITICAL: Inject CSS to hide the wrong desktop/mobile variant
// Instead of trying to parse/remove HTML with regex (fragile),
// we inject inline CSS that hides elements based on viewport
// This is more reliable and handles nested elements properly
// =============================================
function getVariantHidingCss(isMobile: boolean): string {
  if (isMobile) {
    // On mobile: hide desktop-only sections (those WITHOUT tablet class)
    // Show elements WITH tablet class
    return `
      /* Hide desktop sections on mobile - sections with sectionN class but NOT tablet */
      section.section1:not(.tablet),
      section.section2:not(.tablet),
      section.section3:not(.tablet),
      section.section4:not(.tablet),
      section.section5:not(.tablet),
      section.section6:not(.tablet),
      section.section7:not(.tablet),
      section.section8:not(.tablet),
      section.section9:not(.tablet),
      section.section10:not(.tablet) {
        display: none !important;
      }
      /* But show if there's no tablet version - detect by checking if tablet exists */
      /* This is handled by the JavaScript check below */
      
      /* Also hide desktop-variant wrappers from import */
      .section-desktop-variant { display: none !important; }
      
      /* Hide non-tablet products div */
      .products:not(.tablet) { display: none !important; }
    `;
  } else {
    // On desktop: hide tablet sections
    return `
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
      
      /* Also hide mobile-variant wrappers from import */
      .section-mobile-variant { display: none !important; }
      
      /* Hide tablet products div */
      .products.tablet { display: none !important; }
    `;
  }
}

// Check if section has a tablet variant to decide if we should hide the desktop version
function checkAndHideDesktopOnlySections(html: string, isMobile: boolean): string {
  if (!isMobile) return html;
  
  // If on mobile, we need to check each sectionN if it has a tablet variant
  // If it does, the CSS above will hide the non-tablet version
  // If it doesn't, we need to show the non-tablet version (it's the only one)
  
  // Parse which sections have tablet variants
  const tabletSections = new Set<string>();
  const tabletPattern = /<section[^>]*class="[^"]*\bsection(\d+)\b[^"]*\btablet\b[^"]*"/gi;
  let match;
  while ((match = tabletPattern.exec(html)) !== null) {
    tabletSections.add(match[1]);
  }
  
  // Generate CSS that shows non-tablet sections that DON'T have a tablet variant
  let showDesktopCss = '';
  for (let i = 1; i <= 10; i++) {
    if (!tabletSections.has(String(i))) {
      // This section has no tablet variant, show the desktop version on mobile too
      showDesktopCss += `section.section${i}:not(.tablet) { display: block !important; }\n`;
    }
  }
  
  // Inject this CSS at the end of any existing style tag or add a new one
  if (showDesktopCss) {
    if (html.includes('</style>')) {
      // Insert before last </style>
      const lastStyleIndex = html.lastIndexOf('</style>');
      html = html.slice(0, lastStyleIndex) + `\n/* Show sections without tablet variant */\n${showDesktopCss}` + html.slice(lastStyleIndex);
    } else {
      // Add style tag
      html = `<style>/* Show sections without tablet variant */\n${showDesktopCss}</style>` + html;
    }
  }
  
  return html;
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
  
  // Process HTML - sanitize, materialize videos, AND prepare variant handling
  const processedHtml = useMemo(() => {
    let html = sanitizeHtml(htmlContent);
    html = materializeVideos(html);
    // Check for sections without tablet variant (on mobile, show desktop if no tablet exists)
    html = checkAndHideDesktopOnlySections(html, isMobile);
    return html;
  }, [htmlContent, isMobile]);
  
  // Get variant hiding CSS based on mobile/desktop
  const variantCss = useMemo(() => getVariantHidingCss(isMobile), [isMobile]);
  
  // Combine CSS with variant hiding rules
  const finalCss = useMemo(() => `${cssContent}\n${variantCss}`, [cssContent, variantCss]);
  
  // Build iframe document
  const iframeDoc = useMemo(
    () => buildIframeDocument(processedHtml, finalCss, baseUrl, isEditing),
    [processedHtml, finalCss, baseUrl, isEditing]
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
