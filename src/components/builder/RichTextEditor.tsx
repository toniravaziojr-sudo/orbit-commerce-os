// =============================================
// RICH TEXT EDITOR - Visual/HTML editor with functional toolbar
// =============================================

import { useState, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bold, Italic, Link, List, AlignLeft, AlignCenter, AlignRight, Eye, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  
  // Create a DOM parser
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Recursive function to sanitize nodes
  function sanitizeNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node;
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      // Remove disallowed tags (but keep their text content)
      if (!ALLOWED_TAGS.includes(tagName)) {
        const fragment = document.createDocumentFragment();
        Array.from(element.childNodes).forEach(child => {
          const sanitized = sanitizeNode(child);
          if (sanitized) fragment.appendChild(sanitized);
        });
        return fragment;
      }
      
      // Clone the element and remove disallowed attributes
      const clone = document.createElement(tagName);
      Array.from(element.attributes).forEach(attr => {
        if (ALLOWED_ATTRIBUTES.includes(attr.name.toLowerCase())) {
          // Additional check for href to prevent javascript:
          if (attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:')) {
            return;
          }
          clone.setAttribute(attr.name, attr.value);
        }
      });
      
      // Recursively sanitize children
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

  // Sync HTML value when switching modes
  const handleModeChange = (newMode: 'visual' | 'html') => {
    if (newMode === 'html' && editorRef.current) {
      setHtmlValue(editorRef.current.innerHTML);
    } else if (newMode === 'visual') {
      // When switching to visual, update the contenteditable with sanitized HTML
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
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

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

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-muted/30 border-b flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={formatBold}
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
          onClick={formatItalic}
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
          onClick={formatLink}
          title="Inserir Link"
          disabled={mode === 'html'}
        >
          <Link className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={formatUnorderedList}
          title="Lista"
          disabled={mode === 'html'}
        >
          <List className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => formatAlign('left')}
          title="Alinhar à Esquerda"
          disabled={mode === 'html'}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => formatAlign('center')}
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
          onClick={() => formatAlign('right')}
          title="Alinhar à Direita"
          disabled={mode === 'html'}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {/* Mode Toggle */}
        <div className="flex border rounded-md overflow-hidden">
          <Button
            type="button"
            variant={mode === 'visual' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1 px-2 rounded-none"
            onClick={() => handleModeChange('visual')}
          >
            <Eye className="h-3 w-3" />
            Visual
          </Button>
          <Button
            type="button"
            variant={mode === 'html' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1 px-2 rounded-none"
            onClick={() => handleModeChange('html')}
          >
            <Code className="h-3 w-3" />
            HTML
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[120px]">
        {mode === 'visual' ? (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onBlur={handleInput}
            className={cn(
              'p-3 min-h-[120px] focus:outline-none',
              'prose prose-sm max-w-none',
              '[&_*]:outline-none'
            )}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) || '' }}
            data-placeholder={placeholder || 'Digite seu conteúdo...'}
          />
        ) : (
          <Textarea
            value={htmlValue}
            onChange={handleHtmlChange}
            placeholder="<p>Digite HTML aqui...</p>"
            className="border-0 rounded-none resize-none min-h-[120px] focus-visible:ring-0 font-mono text-sm"
          />
        )}
      </div>
    </div>
  );
}
