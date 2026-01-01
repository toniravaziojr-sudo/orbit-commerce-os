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

// Prune CSS to only include rules that match selectors used in the HTML
function pruneCss(css: string, html: string): string {
  if (!css || !html) return '';
  
  // Extract all class names and IDs from HTML
  const classMatches = html.match(/class="([^"]*)"/gi) || [];
  const idMatches = html.match(/id="([^"]*)"/gi) || [];
  
  const usedClasses = new Set<string>();
  const usedIds = new Set<string>();
  
  // Parse class names
  classMatches.forEach(match => {
    const classes = match.replace(/class="([^"]*)"/i, '$1').split(/\s+/);
    classes.forEach(c => c && usedClasses.add(c.toLowerCase()));
  });
  
  // Parse IDs
  idMatches.forEach(match => {
    const id = match.replace(/id="([^"]*)"/i, '$1');
    if (id) usedIds.add(id.toLowerCase());
  });
  
  // Get all HTML tag names used
  const tagMatches = html.match(/<([a-z][a-z0-9]*)/gi) || [];
  const usedTags = new Set<string>();
  tagMatches.forEach(match => {
    const tag = match.replace('<', '').toLowerCase();
    if (tag) usedTags.add(tag);
  });
  
  // Remove dangerous global rules
  let cleanCss = css
    // Remove @font-face (affects entire page)
    .replace(/@font-face\s*\{[^}]*\}/gi, '')
    // Remove @import (can load external CSS)
    .replace(/@import[^;]*;/gi, '')
    // Remove :root variables
    .replace(/:root\s*\{[^}]*\}/gi, '')
    // Remove html/body/* global rules
    .replace(/(?:^|\})\s*(?:html|body|\*)\s*\{[^}]*\}/gi, '}');
  
  // Parse and filter CSS rules
  const filteredRules: string[] = [];
  
  // Handle @media queries separately
  const mediaBlocks = cleanCss.match(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/gi) || [];
  const cssWithoutMedia = cleanCss.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/gi, '');
  
  // Filter regular rules
  const rules = cssWithoutMedia.match(/[^{}]+\{[^{}]*\}/g) || [];
  
  rules.forEach(rule => {
    const braceIndex = rule.indexOf('{');
    if (braceIndex === -1) return;
    
    const selector = rule.substring(0, braceIndex).trim();
    const declarations = rule.substring(braceIndex);
    
    // Skip @keyframes
    if (selector.startsWith('@')) {
      filteredRules.push(rule);
      return;
    }
    
    // Skip global selectors
    if (selector === '*' || selector === 'html' || selector === 'body' || selector === ':root') {
      return;
    }
    
    // Skip rules that hide content
    if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(declarations)) {
      return;
    }
    
    // Check if selector matches any used class, ID, or tag
    const selectorLower = selector.toLowerCase();
    let matches = false;
    
    // Check classes
    usedClasses.forEach(cls => {
      if (selectorLower.includes('.' + cls)) matches = true;
    });
    
    // Check IDs
    usedIds.forEach(id => {
      if (selectorLower.includes('#' + id)) matches = true;
    });
    
    // Check tags
    usedTags.forEach(tag => {
      // Match tag name at word boundary
      const tagPattern = new RegExp(`\\b${tag}\\b`, 'i');
      if (tagPattern.test(selector)) matches = true;
    });
    
    if (matches) {
      filteredRules.push(rule);
    }
  });
  
  // Process @media blocks - filter rules inside them
  const filteredMedia: string[] = [];
  mediaBlocks.forEach(mediaBlock => {
    const mediaQuery = mediaBlock.substring(0, mediaBlock.indexOf('{'));
    const innerContent = mediaBlock.substring(
      mediaBlock.indexOf('{') + 1,
      mediaBlock.lastIndexOf('}')
    );
    
    const innerRules = innerContent.match(/[^{}]+\{[^{}]*\}/g) || [];
    const filteredInner: string[] = [];
    
    innerRules.forEach(rule => {
      const braceIndex = rule.indexOf('{');
      if (braceIndex === -1) return;
      
      const selector = rule.substring(0, braceIndex).trim();
      const declarations = rule.substring(braceIndex);
      
      // Skip global selectors
      if (selector === '*' || selector === 'html' || selector === 'body') return;
      
      // Skip hide rules
      if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(declarations)) return;
      
      const selectorLower = selector.toLowerCase();
      let matches = false;
      
      usedClasses.forEach(cls => {
        if (selectorLower.includes('.' + cls)) matches = true;
      });
      usedIds.forEach(id => {
        if (selectorLower.includes('#' + id)) matches = true;
      });
      usedTags.forEach(tag => {
        const tagPattern = new RegExp(`\\b${tag}\\b`, 'i');
        if (tagPattern.test(selector)) matches = true;
      });
      
      if (matches) {
        filteredInner.push(rule);
      }
    });
    
    if (filteredInner.length > 0) {
      filteredMedia.push(`${mediaQuery}{${filteredInner.join('\n')}}`);
    }
  });
  
  return [...filteredRules, ...filteredMedia].join('\n');
}

// Build complete HTML document for iframe
function buildIframeDocument(html: string, css: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    
    /* Imported CSS (pruned) */
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
  isEditing = false,
  className,
}: IsolatedCustomBlockProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(400);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Sanitize HTML and prune CSS
  const sanitizedHtml = useMemo(() => sanitizeHtml(htmlContent), [htmlContent]);
  const prunedCss = useMemo(() => pruneCss(cssContent, sanitizedHtml), [cssContent, sanitizedHtml]);
  
  // Build iframe document
  const iframeDoc = useMemo(
    () => buildIframeDocument(sanitizedHtml, prunedCss),
    [sanitizedHtml, prunedCss]
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
