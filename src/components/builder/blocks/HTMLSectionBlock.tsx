// =============================================
// HTML SECTION BLOCK - Renders custom HTML/CSS in isolated iframe
// =============================================
// This is the native block for embedding custom HTML content.
// Uses iframe isolation to prevent CSS leakage.
// 
// Features:
// - htmlDesktop / htmlMobile variants (renders based on viewport)
// - CSS isolation via iframe
// - Stable auto-height measurement (no loops)
// - Links disabled in editor mode
// =============================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Code, AlertTriangle } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';

interface HTMLSectionBlockProps {
  htmlContent?: string;
  htmlDesktop?: string;
  htmlMobile?: string;
  cssContent?: string;
  blockName?: string;
  baseUrl?: string;
  className?: string;
  context?: BlockRenderContext;
  isEditing?: boolean;
}

// Sanitize HTML to remove dangerous elements
function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  let sanitized = html;
  
  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
  
  return sanitized;
}

// Build iframe document
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
    /* Reset for measurement */
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
      display: block !important;
      position: relative !important;
    }
    img { max-width: 100%; height: auto; display: block; }
    ${disableLinks ? 'a { pointer-events: none; cursor: default; }' : 'a { color: inherit; }'}
    
    /* YouTube/Vimeo responsive */
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

export function HTMLSectionBlock({
  htmlContent,
  htmlDesktop,
  htmlMobile,
  cssContent = '',
  blockName = 'Seção HTML',
  baseUrl,
  className,
  context,
  isEditing = false,
}: HTMLSectionBlockProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(200);
  const lastHeightRef = useRef<number>(0);
  const stableCountRef = useRef<number>(0);
  const measureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Determine which HTML to use based on viewport
  const viewport = context?.viewport || 'desktop';
  
  const activeHtml = useMemo(() => {
    // Priority: viewport-specific -> general htmlContent
    if (viewport === 'mobile' && htmlMobile) {
      return htmlMobile;
    }
    if (viewport === 'desktop' && htmlDesktop) {
      return htmlDesktop;
    }
    // Fallback to htmlContent or htmlDesktop
    return htmlContent || htmlDesktop || htmlMobile || '';
  }, [viewport, htmlContent, htmlDesktop, htmlMobile]);
  
  const sanitizedHtml = useMemo(() => sanitizeHtml(activeHtml), [activeHtml]);
  
  const iframeDoc = useMemo(
    () => buildIframeDocument(sanitizedHtml, cssContent, baseUrl, isEditing),
    [sanitizedHtml, cssContent, baseUrl, isEditing]
  );
  
  // Measure height from parent's contentDocument (same-origin)
  const measureHeight = useCallback(() => {
    if (!iframeRef.current?.contentDocument) return;
    
    const doc = iframeRef.current.contentDocument;
    if (!doc.body) return;
    
    // Force layout
    doc.body.offsetHeight;
    
    // Calculate height from multiple sources
    const heights = [
      doc.body.scrollHeight || 0,
      doc.body.offsetHeight || 0,
      doc.documentElement?.scrollHeight || 0,
      doc.documentElement?.offsetHeight || 0,
    ];
    
    // Also check bounding rect of body
    try {
      const bodyRect = doc.body.getBoundingClientRect();
      if (bodyRect.height > 0) heights.push(Math.ceil(bodyRect.height));
    } catch {}
    
    const newHeight = Math.max(...heights) + 10; // Small padding
    const clampedHeight = Math.max(50, Math.min(newHeight, 20000));
    
    const delta = Math.abs(clampedHeight - lastHeightRef.current);
    
    // Only update if significant change
    if (delta > 5) {
      lastHeightRef.current = clampedHeight;
      setIframeHeight(clampedHeight);
      stableCountRef.current = 0;
    } else {
      stableCountRef.current++;
    }
    
    // Continue measuring until stable
    if (stableCountRef.current < 5) {
      measureTimeoutRef.current = setTimeout(measureHeight, 150);
    }
  }, []);
  
  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    lastHeightRef.current = 0;
    stableCountRef.current = 0;
    
    // Clear any pending measurements
    if (measureTimeoutRef.current) {
      clearTimeout(measureTimeoutRef.current);
    }
    
    // Start measuring
    setTimeout(measureHeight, 0);
    setTimeout(measureHeight, 100);
    setTimeout(measureHeight, 300);
    setTimeout(measureHeight, 600);
  }, [measureHeight]);
  
  // Write content to iframe
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(iframeDoc);
        doc.close();
        handleIframeLoad();
      }
    }
    
    return () => {
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }
    };
  }, [iframeDoc, handleIframeLoad]);
  
  // Re-measure on window resize
  useEffect(() => {
    const handleResize = () => {
      stableCountRef.current = 0;
      measureHeight();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureHeight]);
  
  // Empty state
  if (!sanitizedHtml) {
    if (isEditing) {
      return (
        <div className="p-4 bg-amber-500/10 border border-amber-500 rounded text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Seção HTML sem conteúdo. Edite as propriedades para adicionar HTML.</span>
        </div>
      );
    }
    return null;
  }
  
  return (
    <div 
      className={cn(
        'html-section-block relative w-full',
        isEditing && 'ring-1 ring-blue-500/30 rounded-lg',
        className
      )}
      style={{ overflow: 'visible' }}
    >
      {isEditing && (
        <div className="absolute -top-6 right-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-t z-10 flex items-center gap-2 opacity-80">
          <Code className="w-3 h-3" />
          <span>{blockName}</span>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        className="w-full border-0"
        style={{
          height: iframeHeight,
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

export default HTMLSectionBlock;
