// =============================================
// RICH TEXT BLOCK - Formatted text with placeholder support
// =============================================

import React from 'react';
import { BlockRenderContext } from '@/lib/builder/types';

interface RichTextBlockProps {
  content?: string;
  align?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  context?: BlockRenderContext;
}

// Font size map
const fontSizeMap: Record<string, string> = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
};

// Replace template placeholders with context data
function replacePlaceholders(text: string, context?: BlockRenderContext): string {
  if (!text) return '';
  
  let result = text;
  
  // Replace category placeholders
  if (context?.category) {
    result = result.replace(/\{\{category\.name\}\}/g, context.category.name || '');
    result = result.replace(/\{\{category\.description\}\}/g, context.category.description || '');
    result = result.replace(/\{\{category\.id\}\}/g, context.category.id || '');
  }
  
  // Replace product placeholders
  if (context?.product) {
    result = result.replace(/\{\{product\.name\}\}/g, context.product.name || '');
    result = result.replace(/\{\{product\.description\}\}/g, context.product.description || '');
    result = result.replace(/\{\{product\.price\}\}/g, context.product.price?.toString() || '');
  }
  
  // Replace store placeholders
  if (context?.settings) {
    result = result.replace(/\{\{store\.name\}\}/g, context.settings.store_name || '');
  }
  
  return result;
}

// CRITICAL: Sanitize HTML to prevent CSS leakage from imported content
function sanitizeImportedHtml(html: string): string {
  if (!html) return '';
  
  let sanitized = html
    // Remove <style> tags completely
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove <link> tags (external CSS)
    .replace(/<link[^>]*>/gi, '')
    // Remove <script> tags
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Remove <noscript> tags
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Remove <meta> tags
    .replace(/<meta[^>]*>/gi, '')
    // Remove <base> tags
    .replace(/<base[^>]*>/gi, '')
    // Remove inline style attributes (they can override app styles)
    .replace(/\s*style=["'][^"']*["']/gi, '')
    // Remove onclick and other event handlers
    .replace(/\s*on\w+=["'][^"']*["']/gi, '')
    // Remove data attributes that could cause issues
    .replace(/\s*data-(?!editor)[^=]*=["'][^"']*["']/gi, '');
  
  return sanitized;
}

// Convert markdown-like content to HTML
function processContent(text: string, context?: BlockRenderContext): string {
  if (!text) return '<p>Conteúdo de texto formatado...</p>';
  
  // First replace placeholders
  let processed = replacePlaceholders(text, context);
  
  // CRITICAL: Sanitize HTML content from imports before rendering
  processed = sanitizeImportedHtml(processed);
  
  // If already HTML, return as is
  if (processed.includes('<')) return processed;
  
  // Simple markdown conversion
  let html = processed
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-primary underline">$1</a>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\n/gim, '<br />');

  return html;
}

// Sanitize external links to prevent navigation in editor
function sanitizeLinks(html: string): string {
  if (!html) return html;
  // Replace external hrefs with # to prevent navigation in editor mode
  return html.replace(
    /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi,
    (match, before, href, after) => {
      // Mark as editor-disabled link
      return `<a ${before}href="#" data-original-href="${href}" data-editor-link="true"${after}>`;
    }
  );
}

export function RichTextBlock({ content, align, fontFamily, fontSize, fontWeight, context }: RichTextBlockProps) {
  return (
    <div 
      className="prose prose-lg max-w-none [&_a[data-editor-link]]:pointer-events-none [&_a[data-editor-link]]:cursor-text [&_a[data-editor-link]]:no-underline"
      style={{ 
        textAlign: (align as any) || 'left',
        fontFamily: fontFamily || 'inherit',
        fontSize: fontSizeMap[fontSize || 'base'] || fontSizeMap.base,
        fontWeight: fontWeight || 'normal',
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeLinks(processContent(content || '', context)) }}
    />
  );
}
