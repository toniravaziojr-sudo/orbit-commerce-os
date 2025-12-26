// =============================================
// EMAIL RICH TEXT EDITOR - WYSIWYG editor for email templates
// With toolbar, variables support, and fixed action buttons
// =============================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bold, 
  Italic, 
  Underline,
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  List,
  ListOrdered,
  Link,
  Type,
  Eye, 
  Code,
  Heading1,
  Heading2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmailRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  templateKey?: string;
  minHeight?: string;
}

// Default button styles for emails
const DEFAULT_BUTTON_STYLE = 'background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;';

// Fixed URLs based on template type
const FIXED_URLS: Record<string, Record<string, string>> = {
  auth_confirm: {
    confirmation_url: '{{confirmation_url}}',
  },
  welcome: {
    dashboard_url: 'https://app.comandocentral.com.br',
  },
  password_reset: {
    reset_url: '{{reset_url}}',
  },
  tutorials: {
    dashboard_url: 'https://app.comandocentral.com.br',
  },
};

// Email-safe HTML wrapper
const wrapEmailHtml = (content: string) => {
  // Already has wrapper
  if (content.includes('max-width: 600px')) {
    return content;
  }
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">${content}</div>`;
};

// Extract content from wrapper if present
const unwrapEmailHtml = (html: string) => {
  const match = html.match(/<div style="font-family: Arial, sans-serif; max-width: 600px[^>]*>([\s\S]*)<\/div>\s*$/);
  return match ? match[1] : html;
};

export function EmailRichTextEditor({ 
  value, 
  onChange, 
  placeholder,
  templateKey = '',
  minHeight = '300px'
}: EmailRichTextEditorProps) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const editorRef = useRef<HTMLDivElement>(null);
  const [htmlValue, setHtmlValue] = useState(value || '');

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && value) {
      const content = unwrapEmailHtml(value);
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content;
      }
    }
  }, [value, mode]);

  // Sync HTML value when switching modes
  const handleModeChange = (newMode: 'visual' | 'html') => {
    if (newMode === 'html' && editorRef.current) {
      setHtmlValue(wrapEmailHtml(editorRef.current.innerHTML));
    } else if (newMode === 'visual') {
      if (editorRef.current) {
        editorRef.current.innerHTML = unwrapEmailHtml(htmlValue);
      }
    }
    setMode(newMode);
  };

  // Handle contenteditable changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      onChange(wrapEmailHtml(content));
    }
  }, [onChange]);

  // Handle HTML textarea changes
  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setHtmlValue(newValue);
    onChange(newValue);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Shift+Enter for line break (br)
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
      handleInput();
      return;
    }

    // Ctrl+B for bold
    if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      execCommand('bold');
      return;
    }

    // Ctrl+I for italic
    if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      execCommand('italic');
      return;
    }

    // Ctrl+U for underline
    if (e.key === 'u' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      execCommand('underline');
      return;
    }
  };

  // Execute formatting command
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  // Insert button with fixed URL
  const insertActionButton = () => {
    const urls = FIXED_URLS[templateKey] || {};
    const urlKey = Object.keys(urls)[0];
    const url = urls[urlKey] || '#';
    
    let buttonText = 'Clique aqui';
    if (templateKey === 'auth_confirm') buttonText = 'Confirmar minha conta';
    if (templateKey === 'welcome') buttonText = 'Acessar minha conta';
    if (templateKey === 'password_reset') buttonText = 'Redefinir minha senha';
    if (templateKey === 'tutorials') buttonText = 'Acessar tutoriais';

    const buttonHtml = `<p style="text-align: center; margin: 30px 0;"><a href="${url}" style="${DEFAULT_BUTTON_STYLE}">${buttonText}</a></p>`;
    
    document.execCommand('insertHTML', false, buttonHtml);
    editorRef.current?.focus();
    handleInput();
  };

  // Format font size
  const handleFontSize = (size: string) => {
    const sizeMap: Record<string, string> = {
      'small': '12px',
      'normal': '14px',
      'medium': '16px',
      'large': '18px',
      'xlarge': '24px',
    };
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (range.toString()) {
        const span = document.createElement('span');
        span.style.fontSize = sizeMap[size] || '14px';
        range.surroundContents(span);
        handleInput();
      }
    }
    editorRef.current?.focus();
  };

  // Format heading
  const handleHeading = (level: 'h1' | 'h2' | 'p') => {
    if (level === 'p') {
      execCommand('formatBlock', '<p>');
    } else {
      execCommand('formatBlock', `<${level}>`);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-muted/30 border-b flex-wrap">
        {/* Text formatting */}
        <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => execCommand('bold')}
            title="Negrito (Ctrl+B)"
            disabled={mode === 'html'}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => execCommand('italic')}
            title="Itálico (Ctrl+I)"
            disabled={mode === 'html'}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => execCommand('underline')}
            title="Sublinhado (Ctrl+U)"
            disabled={mode === 'html'}
          >
            <Underline className="h-4 w-4" />
          </Button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleHeading('h1')}
            title="Título 1"
            disabled={mode === 'html'}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleHeading('h2')}
            title="Título 2"
            disabled={mode === 'html'}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Font size */}
        <div className="border-r pr-2 mr-1">
          <Select onValueChange={handleFontSize} disabled={mode === 'html'}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue placeholder="Tamanho" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Pequeno</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="large">Grande</SelectItem>
              <SelectItem value="xlarge">Extra Grande</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => execCommand('justifyLeft')}
            title="Alinhar à Esquerda"
            disabled={mode === 'html'}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => execCommand('justifyCenter')}
            title="Centralizar"
            disabled={mode === 'html'}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => execCommand('justifyRight')}
            title="Alinhar à Direita"
            disabled={mode === 'html'}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => execCommand('insertUnorderedList')}
            title="Lista com marcadores"
            disabled={mode === 'html'}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => execCommand('insertOrderedList')}
            title="Lista numerada"
            disabled={mode === 'html'}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        {/* Insert button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={insertActionButton}
          title="Inserir botão de ação"
          disabled={mode === 'html'}
        >
          <Link className="h-3.5 w-3.5" />
          Inserir Botão
        </Button>

        <div className="flex-1" />

        {/* Mode Toggle */}
        <div className="flex border rounded-md overflow-hidden">
          <Button
            type="button"
            variant={mode === 'visual' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 text-xs gap-1 px-3 rounded-none"
            onClick={() => handleModeChange('visual')}
          >
            <Eye className="h-3.5 w-3.5" />
            Visual
          </Button>
          <Button
            type="button"
            variant={mode === 'html' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 text-xs gap-1 px-3 rounded-none"
            onClick={() => handleModeChange('html')}
          >
            <Code className="h-3.5 w-3.5" />
            HTML
          </Button>
        </div>
      </div>

      {/* Content */}
      <div style={{ minHeight }}>
        {mode === 'visual' ? (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onBlur={handleInput}
            onKeyDown={handleKeyDown}
            className={cn(
              'p-4 focus:outline-none overflow-auto',
              '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-foreground',
              '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:text-foreground',
              '[&_p]:mb-2 [&_p]:text-foreground',
              '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2',
              '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2',
              '[&_a]:text-primary [&_a]:underline',
              '[&_*]:outline-none'
            )}
            style={{ minHeight }}
            data-placeholder={placeholder || 'Digite seu conteúdo...'}
          />
        ) : (
          <Textarea
            value={htmlValue}
            onChange={handleHtmlChange}
            placeholder="<p>Digite HTML aqui...</p>"
            className="border-0 rounded-none resize-none focus-visible:ring-0 font-mono text-sm"
            style={{ minHeight }}
          />
        )}
      </div>

      {/* Helper text */}
      <div className="px-3 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
        <span className="font-medium">Dica:</span> Use <kbd className="px-1 py-0.5 rounded bg-muted text-foreground">Shift+Enter</kbd> para quebra de linha • <kbd className="px-1 py-0.5 rounded bg-muted text-foreground">Ctrl+B</kbd> negrito • <kbd className="px-1 py-0.5 rounded bg-muted text-foreground">Ctrl+I</kbd> itálico
      </div>
    </div>
  );
}
