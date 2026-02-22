// =============================================
// PRODUCT RICH TEXT EDITOR - Simplified rich text for product descriptions
// Supports: Bold, Italic, Lists, Font Size, Alignment, Headings
// =============================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered,
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Code,
  Heading1,
  Heading2,
  Heading3,
  Underline
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FONT_SIZE_OPTIONS = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '40', '48'];

interface ProductRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

// Allowed HTML tags for product descriptions
const ALLOWED_TAGS = ['p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'span', 'div'];
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

export function ProductRichTextEditor({ 
  value, 
  onChange, 
  placeholder = 'Digite a descrição do produto...',
  minHeight = '200px'
}: ProductRichTextEditorProps) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const editorRef = useRef<HTMLDivElement>(null);
  const [htmlValue, setHtmlValue] = useState(value || '');
  
  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && mode === 'visual') {
      const currentContent = editorRef.current.innerHTML;
      const newContent = sanitizeHtml(value || '');
      // Only update if content is different to preserve cursor position
      if (currentContent !== newContent && !editorRef.current.contains(document.activeElement)) {
        editorRef.current.innerHTML = newContent;
      }
    }
  }, [value, mode]);

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

  // Execute formatting command
  const execCommand = useCallback((command: string, commandValue?: string) => {
    document.execCommand(command, false, commandValue);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  // Format buttons
  const formatBold = () => execCommand('bold');
  const formatItalic = () => execCommand('italic');
  const formatUnderline = () => execCommand('underline');
  const formatUnorderedList = () => execCommand('insertUnorderedList');
  const formatOrderedList = () => execCommand('insertOrderedList');
  
  const formatAlign = (alignment: 'left' | 'center' | 'right') => {
    const alignCommand = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
    }[alignment];
    execCommand(alignCommand);
  };

  const formatHeading = (level: 'h1' | 'h2' | 'h3') => {
    execCommand('formatBlock', level);
  };

  // Font size control
  const formatFontSize = useCallback((size: string) => {
    if (!size) return;
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    try {
      range.surroundContents(span);
      handleInput();
    } catch (e) {
      // Selection crosses element boundaries
    }
    editorRef.current?.focus();
  }, [handleInput]);

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-muted/30 border-b flex-wrap">
        {/* Text formatting */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
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
          className="h-7 w-7"
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
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); formatUnderline(); }}
          title="Sublinhado (Ctrl+U)"
          disabled={mode === 'html'}
        >
          <Underline className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Headings */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); formatHeading('h1'); }}
          title="Título 1"
          disabled={mode === 'html'}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); formatHeading('h2'); }}
          title="Título 2"
          disabled={mode === 'html'}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); formatHeading('h3'); }}
          title="Título 3"
          disabled={mode === 'html'}
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Font Size */}
        <select
          className="h-7 px-2 text-xs bg-background border rounded hover:bg-muted transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          onChange={(e) => { formatFontSize(e.target.value); e.target.value = ''; }}
          disabled={mode === 'html'}
          defaultValue=""
        >
          <option value="" disabled>Tamanho</option>
          {FONT_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>{size}px</option>
          ))}
        </select>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); formatUnorderedList(); }}
          title="Lista com marcadores"
          disabled={mode === 'html'}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); formatOrderedList(); }}
          title="Lista numerada"
          disabled={mode === 'html'}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Alignment */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); formatAlign('left'); }}
          title="Alinhar à esquerda"
          disabled={mode === 'html'}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
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
          className="h-7 w-7"
          onMouseDown={(e) => { e.preventDefault(); formatAlign('right'); }}
          title="Alinhar à direita"
          disabled={mode === 'html'}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {/* Mode Toggle */}
        <Tabs value={mode} onValueChange={(v) => handleModeChange(v as 'visual' | 'html')} className="w-auto">
          <TabsList className="h-7 p-0.5">
            <TabsTrigger value="visual" className="h-6 px-2 text-xs">Visual</TabsTrigger>
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
          className={cn(
            "p-4 focus:outline-none prose prose-sm max-w-none",
            "prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
            "prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
            "prose-hr:my-4 prose-hr:border-border",
            "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:pointer-events-none"
          )}
          style={{ minHeight }}
          onInput={handleInput}
          onBlur={handleInput}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      ) : (
        <Textarea
          value={htmlValue}
          onChange={handleHtmlChange}
          placeholder="<p>Digite o HTML aqui...</p>"
          className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}
