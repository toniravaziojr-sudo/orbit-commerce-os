// =============================================
// RICH TEXT BLOCK - Formatted text with inline editing
// =============================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BlockRenderContext } from '@/lib/builder/types';
import { Bold, Italic, Link, List, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextBlockProps {
  content?: string;
  align?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  context?: BlockRenderContext;
  // Editing props
  isEditing?: boolean;
  isSelected?: boolean;
  onContentChange?: (content: string) => void;
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

// Whitelist of allowed HTML tags and attributes for security
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'span', 'div'];
const ALLOWED_ATTRIBUTES = ['href', 'target', 'class', 'style'];

function sanitizeForEditor(html: string): string {
  if (!html) return '';
  
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  function sanitizeNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return node;
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      if (!ALLOWED_TAGS.includes(tagName)) {
        const fragment = document.createDocumentFragment();
        Array.from(element.childNodes).forEach(child => {
          const sanitized = sanitizeNode(child);
          if (sanitized) fragment.appendChild(sanitized);
        });
        return fragment;
      }
      
      const clone = document.createElement(tagName);
      Array.from(element.attributes).forEach(attr => {
        if (ALLOWED_ATTRIBUTES.includes(attr.name.toLowerCase())) {
          if (attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:')) return;
          clone.setAttribute(attr.name, attr.value);
        }
      });
      
      Array.from(element.childNodes).forEach(child => {
        const sanitized = sanitizeNode(child);
        if (sanitized) clone.appendChild(sanitized);
      });
      
      return clone;
    }
    
    return null;
  }
  
  const fragment = document.createDocumentFragment();
  Array.from(doc.body.childNodes).forEach(node => {
    const sanitized = sanitizeNode(node);
    if (sanitized) fragment.appendChild(sanitized);
  });
  
  const container = document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}

// Inline Toolbar Component
function InlineToolbar({ 
  onBold, 
  onItalic, 
  onLink, 
  onList,
  onAlign 
}: {
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
  onList: () => void;
  onAlign: (align: 'left' | 'center' | 'right') => void;
}) {
  return (
    <div className="absolute -top-10 left-0 z-50 flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1">
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onClick={onBold}
        title="Negrito"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onClick={onItalic}
        title="Itálico"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onClick={onLink}
        title="Link"
      >
        <Link className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onClick={onList}
        title="Lista"
      >
        <List className="h-4 w-4" />
      </button>
      <div className="w-px h-5 bg-border mx-1" />
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onClick={() => onAlign('left')}
        title="Esquerda"
      >
        <AlignLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onClick={() => onAlign('center')}
        title="Centro"
      >
        <AlignCenter className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onClick={() => onAlign('right')}
        title="Direita"
      >
        <AlignRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function RichTextBlock({ 
  content, 
  align, 
  fontFamily, 
  fontSize, 
  fontWeight, 
  context,
  isEditing,
  isSelected,
  onContentChange
}: RichTextBlockProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  
  // Sync content when changed externally
  useEffect(() => {
    if (editorRef.current && !isFocused) {
      const processedContent = isEditing 
        ? sanitizeForEditor(content || '<p>Clique para editar...</p>')
        : sanitizeLinks(processContent(content || '', context));
      editorRef.current.innerHTML = processedContent;
    }
  }, [content, isFocused, isEditing, context]);
  
  // Handle content changes
  const handleInput = useCallback(() => {
    if (editorRef.current && onContentChange) {
      const sanitized = sanitizeForEditor(editorRef.current.innerHTML);
      onContentChange(sanitized);
    }
  }, [onContentChange]);
  
  // Execute formatting command
  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);
  
  const formatBold = () => execCommand('bold');
  const formatItalic = () => execCommand('italic');
  const formatList = () => execCommand('insertUnorderedList');
  const formatLink = () => {
    const url = prompt('Digite a URL do link:', 'https://');
    if (url) execCommand('createLink', url);
  };
  const formatAlign = (alignment: 'left' | 'center' | 'right') => {
    const alignCommand = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' }[alignment];
    execCommand(alignCommand);
  };
  
  // Show toolbar when selected in edit mode
  useEffect(() => {
    setShowToolbar(isEditing && isSelected && isFocused);
  }, [isEditing, isSelected, isFocused]);
  
  // If in editing mode with content change handler, render editable
  if (isEditing && onContentChange) {
    return (
      <div className="relative">
        {showToolbar && (
          <InlineToolbar
            onBold={formatBold}
            onItalic={formatItalic}
            onLink={formatLink}
            onList={formatList}
            onAlign={formatAlign}
          />
        )}
        <div 
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            handleInput();
          }}
          className={cn(
            "prose prose-lg max-w-none focus:outline-none min-h-[1em]",
            "[&_a[data-editor-link]]:pointer-events-none [&_a[data-editor-link]]:cursor-text",
            isSelected && "ring-2 ring-primary/20 rounded-sm"
          )}
          style={{ 
            textAlign: (align as any) || 'left',
            fontFamily: fontFamily || 'inherit',
            fontSize: fontSizeMap[fontSize || 'base'] || fontSizeMap.base,
            fontWeight: fontWeight || 'normal',
          }}
          data-placeholder="Clique para editar..."
        />
      </div>
    );
  }
  
  // Default read-only render (preview/storefront)
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
