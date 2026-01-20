// =============================================
// RICH TEXT BLOCK - Formatted text with inline editing
// ARCHITECTURE: Uncontrolled contentEditable + commit on blur/debounce
// =============================================

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { BlockRenderContext } from '@/lib/builder/types';
import { useBuilderContext } from '@/components/builder/BuilderContext';
import { useCanvasRichText } from '@/components/builder/CanvasRichTextContext';
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
  isEditing?: boolean;
  isSelected?: boolean;
  onContentChange?: (content: string) => void;
}

// Font size map for base styling
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
  
  if (context?.category) {
    result = result.replace(/\{\{category\.name\}\}/g, context.category.name || '');
    result = result.replace(/\{\{category\.description\}\}/g, context.category.description || '');
    result = result.replace(/\{\{category\.id\}\}/g, context.category.id || '');
  }
  
  if (context?.product) {
    result = result.replace(/\{\{product\.name\}\}/g, context.product.name || '');
    result = result.replace(/\{\{product\.description\}\}/g, context.product.description || '');
    result = result.replace(/\{\{product\.price\}\}/g, context.product.price?.toString() || '');
  }
  
  if (context?.settings) {
    result = result.replace(/\{\{store\.name\}\}/g, context.settings.store_name || '');
  }
  
  return result;
}

// CRITICAL: Sanitize HTML to prevent CSS leakage
function sanitizeImportedHtml(html: string): string {
  if (!html) return '';
  
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<base[^>]*>/gi, '')
    .replace(/\s*style=["'][^"']*["']/gi, '')
    .replace(/\s*on\w+=["'][^"']*["']/gi, '')
    .replace(/\s*data-(?!editor)[^=]*=["'][^"']*["']/gi, '');
}

// Convert markdown to HTML
function processContent(text: string, context?: BlockRenderContext): string {
  if (!text) return '<p>Conteúdo de texto formatado...</p>';
  
  let processed = replacePlaceholders(text, context);
  processed = sanitizeImportedHtml(processed);
  
  if (processed.includes('<')) return processed;
  
  return processed
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-primary underline">$1</a>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\n/gim, '<br />');
}

// Sanitize for editor view
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

// Sanitize links for readonly view
function sanitizeLinks(html: string): string {
  if (!html) return html;
  return html.replace(
    /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi,
    (match, before, href, after) => {
      return `<a ${before}href="#" data-original-href="${href}" data-editor-link="true"${after}>`;
    }
  );
}

// Font size options
const FONT_SIZE_OPTIONS = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '40', '48'];

// Floating Toolbar Component
interface FloatingToolbarProps {
  position: { top: number; left: number };
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
  onList: () => void;
  onAlign: (align: 'left' | 'center' | 'right') => void;
  onFontSize: (size: string) => void;
}

function FloatingToolbar({ 
  position,
  onBold, 
  onItalic, 
  onLink, 
  onList,
  onAlign,
  onFontSize
}: FloatingToolbarProps) {
  return (
    <div 
      className="fixed z-[9999] flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ 
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)'
      }}
      onMouseDown={(e) => e.preventDefault()}
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
      <select
        className="h-7 px-1.5 text-xs bg-background border rounded hover:bg-muted transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
        onChange={(e) => { onFontSize(e.target.value); e.target.value = ''; }}
        onMouseDown={(e) => e.stopPropagation()}
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
  
  // CRITICAL: Draft content ref - this is the "uncontrolled" state
  // We NEVER overwrite innerHTML while editing
  const draftContentRef = useRef<string>(content || '');
  const isEditingTextRef = useRef(false);
  const commitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommittedRef = useRef<string>(content || '');
  
  // Get contexts
  const builderCtx = useBuilderContext();
  const canvasRichText = useCanvasRichText();
  
  // Determine editing state
  const isEditing = isEditingProp ?? builderCtx?.isEditing ?? false;
  const isSelected = isSelectedProp ?? (builderCtx?.selectedBlockId === blockId);
  
  // Create onContentChange from context if not provided
  const commitContent = useCallback((newContent: string) => {
    if (newContent === lastCommittedRef.current) return;
    
    lastCommittedRef.current = newContent;
    
    if (onContentChangeProp) {
      onContentChangeProp(newContent);
    } else if (builderCtx?.updateProps && blockId) {
      builderCtx.updateProps(blockId, { content: newContent });
    }
  }, [onContentChangeProp, builderCtx, blockId]);
  
  // Debounced commit - commits after 500ms of no changes
  const scheduleCommit = useCallback(() => {
    if (commitTimeoutRef.current) {
      clearTimeout(commitTimeoutRef.current);
    }
    
    commitTimeoutRef.current = setTimeout(() => {
      if (editorRef.current) {
        const sanitized = sanitizeForEditor(editorRef.current.innerHTML);
        draftContentRef.current = sanitized;
        commitContent(sanitized);
      }
    }, 500);
  }, [commitContent]);
  
  // Apply formatting command - maintains selection
  const applyCommand = useCallback((command: string, value?: string): boolean => {
    if (!editorRef.current) return false;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    
    // Execute command
    document.execCommand(command, false, value);
    
    // Schedule commit
    scheduleCommit();
    
    return true;
  }, [scheduleCommit]);
  
  // Apply font size - uses span with inline style
  const applyFontSize = useCallback((size: string): boolean => {
    if (!editorRef.current || !size) return false;
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
    
    const range = selection.getRangeAt(0);
    
    // Check if selection is within our editor
    if (!editorRef.current.contains(range.commonAncestorContainer)) return false;
    
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    
    try {
      range.surroundContents(span);
    } catch (e) {
      // Fallback for complex selections
      document.execCommand('fontSize', false, '7');
      const fonts = editorRef.current.querySelectorAll('font[size="7"]');
      fonts.forEach(font => {
        const newSpan = document.createElement('span');
        newSpan.style.fontSize = `${size}px`;
        newSpan.innerHTML = font.innerHTML;
        font.parentNode?.replaceChild(newSpan, font);
      });
    }
    
    // Schedule commit
    scheduleCommit();
    
    return true;
  }, [scheduleCommit]);
  
  // Get current selection
  const getSelection = useCallback((): Range | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return null;
    
    return range.cloneRange();
  }, []);
  
  // Focus the editor
  const focusEditor = useCallback(() => {
    editorRef.current?.focus();
  }, []);
  
  // Get current content
  const getContent = useCallback((): string => {
    return editorRef.current?.innerHTML || '';
  }, []);
  
  // Register this editor with the context when editing
  useEffect(() => {
    if (!isEditing || !canvasRichText || !blockId || !editorRef.current) return;
    
    const instance = {
      element: editorRef.current,
      applyCommand,
      applyFontSize,
      getSelection,
      focus: focusEditor,
      getContent
    };
    
    canvasRichText.registerEditor(blockId, instance);
    
    return () => {
      canvasRichText.unregisterEditor(blockId);
    };
  }, [isEditing, canvasRichText, blockId, applyCommand, applyFontSize, getSelection, focusEditor, getContent]);
  
  // Set as active editor when focused
  useEffect(() => {
    if (isFocused && canvasRichText && blockId) {
      canvasRichText.setActiveEditor(blockId);
    }
  }, [isFocused, canvasRichText, blockId]);
  
  // CRITICAL: Only sync content when block changes or on initial mount
  // NEVER sync while editing (isFocused or isEditingTextRef.current)
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Skip if currently editing text
    if (isEditingTextRef.current || isFocused) return;
    
    // Skip if formatting is locked
    if (canvasRichText?.isFormattingLocked?.()) return;
    
    // Skip if content hasn't changed from what we last committed
    if (content === lastCommittedRef.current) return;
    
    // Only sync if content actually changed externally
    const processedContent = isEditing 
      ? sanitizeForEditor(content || '<p>Clique para editar...</p>')
      : sanitizeLinks(processContent(content || '', context));
    
    editorRef.current.innerHTML = processedContent;
    draftContentRef.current = content || '';
    lastCommittedRef.current = content || '';
  }, [content, blockId]); // Only on content or blockId change
  
  // Handle input events - update draft, schedule commit
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      draftContentRef.current = editorRef.current.innerHTML;
      scheduleCommit();
    }
  }, [scheduleCommit]);
  
  // Formatting commands for toolbar
  const formatBold = useCallback(() => applyCommand('bold'), [applyCommand]);
  const formatItalic = useCallback(() => applyCommand('italic'), [applyCommand]);
  const formatList = useCallback(() => applyCommand('insertUnorderedList'), [applyCommand]);
  const formatLink = useCallback(() => {
    const url = prompt('Digite a URL do link:', 'https://');
    if (url) applyCommand('createLink', url);
  }, [applyCommand]);
  const formatAlign = useCallback((alignment: 'left' | 'center' | 'right') => {
    const alignCommand = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' }[alignment];
    applyCommand(alignCommand);
  }, [applyCommand]);
  const formatFontSize = useCallback((size: string) => {
    applyFontSize(size);
  }, [applyFontSize]);
  
  // Update toolbar position based on selection
  const updateToolbarPosition = useCallback(() => {
    const selection = window.getSelection();
    
    if (!selection || selection.isCollapsed || !editorRef.current) {
      setShowToolbar(false);
      return;
    }
    
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      setShowToolbar(false);
      return;
    }
    
    const rect = range.getBoundingClientRect();
    
    setToolbarPosition({
      top: rect.top - 48,
      left: rect.left + rect.width / 2
    });
    setShowToolbar(true);
  }, []);
  
  // Listen for selection changes
  useEffect(() => {
    if (!isEditing) return;
    
    const handleSelectionChange = () => {
      requestAnimationFrame(updateToolbarPosition);
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isEditing, updateToolbarPosition]);
  
  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    isEditingTextRef.current = true;
  }, []);
  
  // Handle blur - commit content
  const handleBlur = useCallback(() => {
    // Delay to allow button clicks
    setTimeout(() => {
      const selection = window.getSelection();
      const stillInEditor = editorRef.current?.contains(document.activeElement);
      
      if (!stillInEditor) {
        setShowToolbar(false);
        setIsFocused(false);
        isEditingTextRef.current = false;
        
        // Commit on blur
        if (editorRef.current) {
          const sanitized = sanitizeForEditor(editorRef.current.innerHTML);
          draftContentRef.current = sanitized;
          commitContent(sanitized);
        }
      }
    }, 150);
  }, [commitContent]);
  
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent builder from handling Backspace/Delete when editing text
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.stopPropagation();
    }
    
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          formatBold();
          break;
        case 'i':
          e.preventDefault();
          formatItalic();
          break;
        case 'k':
          e.preventDefault();
          formatLink();
          break;
      }
    }
  }, [formatBold, formatItalic, formatLink]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (commitTimeoutRef.current) {
        clearTimeout(commitTimeoutRef.current);
      }
    };
  }, []);
  
  // Render editable version
  if (isEditing) {
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
          />
        )}
        <div 
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseUp={updateToolbarPosition}
          onKeyUp={updateToolbarPosition}
          onKeyDown={handleKeyDown}
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
          dangerouslySetInnerHTML={{ 
            __html: sanitizeForEditor(content || '<p>Clique para editar...</p>') 
          }}
        />
      </div>
    );
  }
  
  // Render readonly version (preview/storefront)
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
