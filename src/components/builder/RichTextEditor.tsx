// =============================================
// RICH TEXT EDITOR - Visual/HTML editor with functional toolbar
// Connects to canvas editor for direct formatting via CanvasRichTextContext
// =============================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bold, Italic, Link, List, AlignLeft, AlignCenter, AlignRight, Eye, Code, MousePointer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasRichText } from './CanvasRichTextContext';

// Font size options in pixels
const FONT_SIZE_OPTIONS = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '40', '48'];

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Whitelist of allowed HTML tags and attributes for security
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'span', 'div'];
const ALLOWED_ATTRIBUTES = ['href', 'target', 'class', 'style'];

function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  function sanitizeNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node;
    }
    
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
          if (attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:')) {
            return;
          }
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

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const editorRef = useRef<HTMLDivElement>(null);
  const [htmlValue, setHtmlValue] = useState(value || '');
  const [hasCanvasSelection, setHasCanvasSelection] = useState(false);
  
  // Get canvas rich text context
  const canvasRichText = useCanvasRichText();

  // Check for canvas selection periodically
  useEffect(() => {
    if (!canvasRichText) return;
    
    const checkSelection = () => {
      setHasCanvasSelection(canvasRichText.hasSelection());
    };
    
    document.addEventListener('selectionchange', checkSelection);
    checkSelection();
    
    return () => {
      document.removeEventListener('selectionchange', checkSelection);
    };
  }, [canvasRichText]);

  // Sync HTML value when switching modes
  const handleModeChange = (newMode: 'visual' | 'html') => {
    if (newMode === 'html' && editorRef.current) {
      setHtmlValue(editorRef.current.innerHTML);
    } else if (newMode === 'visual') {
      if (editorRef.current) {
        editorRef.current.innerHTML = sanitizeHtml(htmlValue);
      }
    }
    setMode(newMode);
  };

  // Handle contenteditable changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const sanitized = sanitizeHtml(editorRef.current.innerHTML);
      onChange(sanitized);
    }
  }, [onChange]);

  // Handle HTML textarea changes
  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setHtmlValue(newValue);
    onChange(sanitizeHtml(newValue));
  };

  // Execute formatting command - tries canvas first, then local editor
  const execCommand = useCallback((command: string, commandValue?: string) => {
    // First try to execute on canvas selection if available
    const activeEditor = canvasRichText?.getActiveEditor();
    if (activeEditor) {
      const success = activeEditor.applyCommand(command, commandValue);
      if (success) {
        return;
      }
    }
    
    // Fall back to local editor
    document.execCommand(command, false, commandValue);
    editorRef.current?.focus();
    handleInput();
  }, [canvasRichText, handleInput]);

  // Format buttons
  const formatBold = () => execCommand('bold');
  const formatItalic = () => execCommand('italic');
  const formatUnorderedList = () => execCommand('insertUnorderedList');
  const formatLink = () => {
    const url = prompt('Digite a URL do link:', 'https://');
    if (url) {
      execCommand('createLink', url);
    }
  };
  const formatAlign = (alignment: 'left' | 'center' | 'right') => {
    const alignCommand = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
    }[alignment];
    execCommand(alignCommand);
  };

  // Font size control - uses the canvas editor's applyFontSize
  const formatFontSize = useCallback((size: string) => {
    if (!size) return;
    
    // Save selection before any operations
    canvasRichText?.saveSelection();
    
    // Try to apply on canvas first
    const activeEditor = canvasRichText?.getActiveEditor();
    if (activeEditor) {
      // Restore selection then apply
      canvasRichText?.restoreSelection();
      const success = activeEditor.applyFontSize(size);
      if (success) {
        return;
      }
    }
    
    // Fallback to local editor
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    try {
      range.surroundContents(span);
      handleInput();
    } catch (e) {
      // Fallback
    }
  }, [canvasRichText, handleInput]);

  // Save canvas selection when mouse enters the toolbar area
  const handleToolbarMouseEnter = useCallback(() => {
    if (canvasRichText) {
      canvasRichText.saveSelection();
    }
  }, [canvasRichText]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Canvas selection indicator */}
      {hasCanvasSelection && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 border-b text-xs text-primary">
          <MousePointer className="h-3 w-3" />
          <span>Texto selecionado no canvas - clique para formatar</span>
        </div>
      )}
      
      {/* Toolbar */}
      <div 
        className="flex items-center gap-1 p-2 bg-muted/30 border-b flex-wrap"
        onMouseEnter={handleToolbarMouseEnter}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", hasCanvasSelection && "ring-1 ring-primary/50")}
          onMouseDown={(e) => { e.preventDefault(); formatBold(); }}
          title="Negrito (Ctrl+B)"
          disabled={mode === 'html'}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", hasCanvasSelection && "ring-1 ring-primary/50")}
          onMouseDown={(e) => { e.preventDefault(); formatItalic(); }}
          title="Itálico (Ctrl+I)"
          disabled={mode === 'html'}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", hasCanvasSelection && "ring-1 ring-primary/50")}
          onMouseDown={(e) => { e.preventDefault(); formatLink(); }}
          title="Inserir Link"
          disabled={mode === 'html'}
        >
          <Link className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", hasCanvasSelection && "ring-1 ring-primary/50")}
          onMouseDown={(e) => { e.preventDefault(); formatUnorderedList(); }}
          title="Lista"
          disabled={mode === 'html'}
        >
          <List className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Font Size Control */}
        <select
          className={cn(
            "h-7 px-2 text-xs bg-background border rounded hover:bg-muted transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary",
            hasCanvasSelection && "ring-1 ring-primary/50"
          )}
          onChange={(e) => { formatFontSize(e.target.value); e.target.value = ''; }}
          onMouseDown={(e) => { 
            e.stopPropagation(); 
            canvasRichText?.saveSelection();
          }}
          onFocus={() => canvasRichText?.saveSelection()}
          defaultValue=""
          disabled={mode === 'html'}
          title="Tamanho da fonte"
        >
          <option value="" disabled>Tamanho</option>
          {FONT_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>{size}px</option>
          ))}
        </select>

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", hasCanvasSelection && "ring-1 ring-primary/50")}
          onMouseDown={(e) => { e.preventDefault(); formatAlign('left'); }}
          title="Alinhar à Esquerda"
          disabled={mode === 'html'}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", hasCanvasSelection && "ring-1 ring-primary/50")}
          onMouseDown={(e) => { e.preventDefault(); formatAlign('center'); }}
          title="Centralizar"
          disabled={mode === 'html'}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", hasCanvasSelection && "ring-1 ring-primary/50")}
          onMouseDown={(e) => { e.preventDefault(); formatAlign('right'); }}
          title="Alinhar à Direita"
          disabled={mode === 'html'}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {/* Mode toggle */}
        <Tabs value={mode} onValueChange={(v) => handleModeChange(v as 'visual' | 'html')} className="h-7">
          <TabsList className="h-7 p-0.5">
            <TabsTrigger value="visual" className="h-6 px-2 text-xs gap-1">
              <Eye className="h-3 w-3" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="html" className="h-6 px-2 text-xs gap-1">
              <Code className="h-3 w-3" />
              HTML
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Editor Area */}
      {mode === 'visual' ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          className={cn(
            "min-h-[100px] p-3 text-sm focus:outline-none prose prose-sm max-w-none",
            "[&_a]:text-primary [&_a]:underline"
          )}
          style={{ wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(value || '') }}
          data-placeholder={placeholder || 'Digite seu texto aqui...'}
        />
      ) : (
        <Textarea
          value={htmlValue}
          onChange={handleHtmlChange}
          placeholder={placeholder || 'Cole o HTML aqui...'}
          className="min-h-[100px] border-0 rounded-none focus-visible:ring-0 font-mono text-xs"
        />
      )}
    </div>
  );
}
