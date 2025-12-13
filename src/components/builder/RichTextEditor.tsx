// =============================================
// RICH TEXT EDITOR - Simple markdown editor with preview
// =============================================

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bold, Italic, Link, List, Eye, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // Simple markdown to HTML conversion
  const markdownToHtml = (markdown: string): string => {
    if (!markdown) return '';
    
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-primary underline">$1</a>')
      // Unordered lists
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      // Line breaks
      .replace(/\n/gim, '<br />');

    // Wrap consecutive li tags in ul
    html = html.replace(/(<li>.*<\/li>(<br \/>)?)+/gim, (match) => {
      return '<ul class="list-disc pl-4 my-2">' + match.replace(/<br \/>/g, '') + '</ul>';
    });

    return html;
  };

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = document.querySelector('textarea[data-richtext]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
    
    onChange(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-muted/30 border-b">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => insertMarkdown('**', '**')}
          title="Negrito"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => insertMarkdown('*', '*')}
          title="Itálico"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => insertMarkdown('[', '](url)')}
          title="Link"
        >
          <Link className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => insertMarkdown('- ')}
          title="Lista"
        >
          <List className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
          <TabsList className="h-7">
            <TabsTrigger value="edit" className="h-6 text-xs gap-1 px-2">
              <Edit2 className="h-3 w-3" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="preview" className="h-6 text-xs gap-1 px-2">
              <Eye className="h-3 w-3" />
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="min-h-[120px]">
        {activeTab === 'edit' ? (
          <Textarea
            data-richtext
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Digite seu conteúdo...\n\n**negrito** *itálico* [link](url)\n- item de lista'}
            className="border-0 rounded-none resize-none min-h-[120px] focus-visible:ring-0"
          />
        ) : (
          <div 
            className="p-3 prose prose-sm max-w-none min-h-[120px]"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(value) || '<p class="text-muted-foreground">Nenhum conteúdo</p>' }}
          />
        )}
      </div>
    </div>
  );
}
