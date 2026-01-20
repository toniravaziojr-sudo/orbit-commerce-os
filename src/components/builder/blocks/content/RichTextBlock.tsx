// =============================================
// RICH TEXT BLOCK - Formatted text with inline editing
// =============================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BlockRenderContext } from '@/lib/builder/types';
import { useBuilderContext } from '@/components/builder/BuilderContext';
import { useCanvasEditor } from '@/components/builder/CanvasEditorContext';
import { Bold, Italic, Link, List, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextBlockProps {
  content?: string;
  align?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  context?: BlockRenderContext;
  blockId?: string;
  // Editing props (can come from parent or context)
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

// Font size options in pixels
const FONT_SIZE_OPTIONS = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '40', '48'];

// Floating Toolbar Component - appears near text selection
interface FloatingToolbarProps {
  position: { top: number; left: number };
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
  onList: () => void;
  onAlign: (align: 'left' | 'center' | 'right') => void;
  onFontSize: (size: string) => void;
  editorRef: React.RefObject<HTMLDivElement>;
}

// Store selection before opening dropdown
let savedRange: Range | null = null;

function FloatingToolbar({ 
  position,
  onBold, 
  onItalic, 
  onLink, 
  onList,
  onAlign,
  onFontSize,
  editorRef
}: FloatingToolbarProps) {
  
  // Save selection when interacting with select
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedRange = selection.getRangeAt(0).cloneRange();
    }
  };
  
  // Restore selection and apply font size
  const handleFontSizeChange = (size: string) => {
    if (!size || !editorRef.current) return;
    
    // Restore saved selection
    if (savedRange) {
      editorRef.current.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
    }
    
    // Apply font size
    onFontSize(size);
    savedRange = null;
  };
  
  return (
    <div 
      className="fixed z-[9999] flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ 
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)'
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
    >
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onMouseDown={(e) => { e.preventDefault(); onBold(); }}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onMouseDown={(e) => { e.preventDefault(); onItalic(); }}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onMouseDown={(e) => { e.preventDefault(); onLink(); }}
        title="Link (Ctrl+K)"
      >
        <Link className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onMouseDown={(e) => { e.preventDefault(); onList(); }}
        title="Lista"
      >
        <List className="h-4 w-4" />
      </button>
      <div className="w-px h-5 bg-border mx-1" />
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onMouseDown={(e) => { e.preventDefault(); onAlign('left'); }}
        title="Esquerda"
      >
        <AlignLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onMouseDown={(e) => { e.preventDefault(); onAlign('center'); }}
        title="Centro"
      >
        <AlignCenter className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-muted rounded transition-colors"
        onMouseDown={(e) => { e.preventDefault(); onAlign('right'); }}
        title="Direita"
      >
        <AlignRight className="h-4 w-4" />
      </button>
      <div className="w-px h-5 bg-border mx-1" />
      {/* Font Size Dropdown - saves selection before opening */}
      <select
        className="h-7 px-1.5 text-xs bg-background border rounded hover:bg-muted transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
        onChange={(e) => { handleFontSizeChange(e.target.value); e.target.value = ''; }}
        onMouseDown={(e) => { e.stopPropagation(); saveSelection(); }}
        onFocus={saveSelection}
        defaultValue=""
        title="Tamanho da fonte"
      >
        <option value="" disabled>px</option>
        {FONT_SIZE_OPTIONS.map(size => (
          <option key={size} value={size}>{size}px</option>
        ))}
      </select>
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
  blockId,
  isEditing: isEditingProp,
  isSelected: isSelectedProp,
  onContentChange: onContentChangeProp
}: RichTextBlockProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  // Track last known content to avoid overwriting during formatting
  const lastContentRef = useRef<string>(content || '');
  const isFormattingRef = useRef(false);
  
  // Get context for inline editing
  const builderCtx = useBuilderContext();
  
  // Get canvas editor context to register this editor
  const canvasEditor = useCanvasEditor();
  
  // Determine editing state from props or context
  const isEditing = isEditingProp ?? builderCtx?.isEditing ?? false;
  const isSelected = isSelectedProp ?? (builderCtx?.selectedBlockId === blockId);
  
  // Register this editor in the canvas context when focused
  useEffect(() => {
    if (isEditing && isFocused && editorRef.current && canvasEditor) {
      canvasEditor.registerEditor(editorRef.current);
    }
  }, [isEditing, isFocused, canvasEditor]);
  
  // Also register when selected (even if not focused)
  useEffect(() => {
    if (isEditing && isSelected && editorRef.current && canvasEditor) {
      canvasEditor.registerEditor(editorRef.current);
    }
  }, [isEditing, isSelected, canvasEditor]);
  
  // Create onContentChange from context if not provided
  const onContentChange = useCallback((newContent: string) => {
    lastContentRef.current = newContent;
    if (onContentChangeProp) {
      onContentChangeProp(newContent);
    } else if (builderCtx?.updateProps && blockId) {
      builderCtx.updateProps(blockId, { content: newContent });
    }
  }, [onContentChangeProp, builderCtx, blockId]);
  
  // Sync content when changed externally (not during focus or formatting)
  useEffect(() => {
    // Check global formatting lock from context
    const isGloballyLocked = canvasEditor?.isFormattingLocked?.() ?? false;
    
    // Don't sync if focused, formatting, or if content matches what we just set
    if (editorRef.current && !isFocused && !isFormattingRef.current && !isGloballyLocked && content !== lastContentRef.current) {
      const processedContent = isEditing 
        ? sanitizeForEditor(content || '<p>Clique para editar...</p>')
        : sanitizeLinks(processContent(content || '', context));
      editorRef.current.innerHTML = processedContent;
      lastContentRef.current = content || '';
    }
  }, [content, isFocused, isEditing, context, canvasEditor]);
  
  // Handle content changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
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
  const formatFontSize = (size: string) => {
    if (!size || !editorRef.current) return;
    
    // Mark as formatting to prevent content sync from overwriting
    isFormattingRef.current = true;
    
    // First restore saved selection (savedRange is set by FloatingToolbar)
    if (savedRange) {
      editorRef.current.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
    }
    
    // Use CSS font-size instead of deprecated fontSize command
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      isFormattingRef.current = false;
      return;
    }
    
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    
    try {
      range.surroundContents(span);
      handleInput();
    } catch (e) {
      // If surroundContents fails (crosses boundaries), use execCommand fallback
      document.execCommand('fontSize', false, '7');
      // Then fix the font size
      if (editorRef.current) {
        const fonts = editorRef.current.querySelectorAll('font[size="7"]');
        fonts.forEach(font => {
          const newSpan = document.createElement('span');
          newSpan.style.fontSize = `${size}px`;
          newSpan.innerHTML = font.innerHTML;
          font.parentNode?.replaceChild(newSpan, font);
        });
        handleInput();
      }
    }
    
    // Reset formatting flag after a short delay
    setTimeout(() => {
      isFormattingRef.current = false;
      updateToolbarPosition();
    }, 100);
  };
  
  // Check for text selection and position toolbar
  const updateToolbarPosition = useCallback(() => {
    const selection = window.getSelection();
    
    if (!selection || selection.isCollapsed || !editorRef.current) {
      setShowToolbar(false);
      return;
    }
    
    // Check if selection is within our editor
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      setShowToolbar(false);
      return;
    }
    
    // Get selection rect
    const rect = range.getBoundingClientRect();
    
    // Position toolbar above the selection, centered
    setToolbarPosition({
      top: rect.top - 48, // 48px above selection
      left: rect.left + rect.width / 2
    });
    setShowToolbar(true);
  }, []);
  
  // Listen for selection changes
  useEffect(() => {
    if (!isEditing) return;
    
    const handleSelectionChange = () => {
      // Small delay to ensure selection is complete
      requestAnimationFrame(updateToolbarPosition);
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isEditing, updateToolbarPosition]);
  
  // Hide toolbar on blur (with small delay to allow button clicks)
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !editorRef.current?.contains(document.activeElement)) {
        setShowToolbar(false);
      }
      setIsFocused(false);
      handleInput();
    }, 150);
  }, [handleInput]);
  
  // If in editing mode with content change handler, render editable
  if (isEditing && onContentChange) {
    return (
      <div className="relative">
        {showToolbar && (
          <FloatingToolbar
            position={toolbarPosition}
            onBold={formatBold}
            onItalic={formatItalic}
            onLink={formatLink}
            onList={formatList}
            onAlign={formatAlign}
            onFontSize={formatFontSize}
            editorRef={editorRef}
          />
        )}
        <div 
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onMouseUp={updateToolbarPosition}
          onKeyUp={updateToolbarPosition}
          className={cn(
            "prose prose-lg max-w-none focus:outline-none min-h-[1em] cursor-text",
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
