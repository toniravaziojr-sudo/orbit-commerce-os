import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  X, 
  Reply, 
  Forward, 
  Star, 
  Trash2, 
  MoreVertical,
  Paperclip,
  Download,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEmailMessage, useEmailAttachments, useEmailActions, EmailAttachment } from "@/hooks/useEmailMessages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Prepara o HTML do e-mail recebido para renderização segura no iframe:
 * 1. Garante <meta charset="utf-8"> para evitar mojibake quando o HTML
 *    original não declara o charset.
 * 2. Injeta <base target="_blank" rel="noopener noreferrer"> para que
 *    todos os links abram em nova aba (o sandbox bloqueia top-navigation).
 * 3. Detecta heuristicamente mojibake clássico (Ã©, Ã£, etc.) em e-mails
 *    historicos e tenta recuperar Latin-1 -> UTF-8 como best-effort.
 */
function prepareEmailHtml(rawHtml: string): string {
  let html = rawHtml || "";

  // Best-effort: corrige mojibake comum (UTF-8 lido como Latin-1)
  if (/[ÃÂ][\x80-\xBF]/.test(html)) {
    try {
      const recovered = decodeURIComponent(escape(html));
      // Só aplica se reduziu drasticamente os marcadores de mojibake
      if ((recovered.match(/[ÃÂ][\x80-\xBF]/g) || []).length <
          (html.match(/[ÃÂ][\x80-\xBF]/g) || []).length / 2) {
        html = recovered;
      }
    } catch {}
  }

  const headInjections =
    '<meta charset="utf-8">' +
    '<base target="_blank" rel="noopener noreferrer">';

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${headInjections}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${headInjections}</head>`);
  }
  return `<!doctype html><html><head>${headInjections}</head><body>${html}</body></html>`;
}

interface EmailViewerProps {
  messageId: string;
  onClose: () => void;
  onReply: () => void;
}

export function EmailViewer({ messageId, onClose, onReply }: EmailViewerProps) {
  const { data: message, isLoading } = useEmailMessage(messageId);
  const { data: attachments } = useEmailAttachments(messageId);
  const { markAsRead, toggleStar, deleteMessage } = useEmailActions();

  // Mark as read when opened
  useEffect(() => {
    if (message && !message.is_read) {
      markAsRead.mutate({ messageId: message.id, isRead: true });
    }
  }, [message?.id, message?.is_read]);

  if (isLoading || !message) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const formatRecipients = (emails: { email: string; name?: string }[]) => {
    return emails.map(e => e.name ? `${e.name} <${e.email}>` : e.email).join(', ');
  };

  const handleToggleStar = () => {
    toggleStar.mutate({ messageId: message.id, isStarred: !message.is_starred });
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este email?')) return;
    await deleteMessage.mutateAsync(message.id);
    onClose();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <h2 className="font-medium truncate">
            {message.subject || '(Sem assunto)'}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleToggleStar}
          >
            <Star className={cn(
              "h-4 w-4",
              message.is_starred && "fill-yellow-500 text-yellow-500"
            )} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Message info */}
      <div className="p-4 border-b">
        <div className="flex items-start gap-3">
          <Avatar>
            <AvatarFallback>
              {(message.from_name || message.from_email)[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">
                  {message.from_name || message.from_email}
                </span>
                {message.from_name && (
                  <span className="text-sm text-muted-foreground ml-2">
                    &lt;{message.from_email}&gt;
                  </span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {message.received_at && format(
                  new Date(message.received_at),
                  "d 'de' MMMM 'às' HH:mm",
                  { locale: ptBR }
                )}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Para: {formatRecipients(message.to_emails)}
            </div>
            {message.cc_emails.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Cc: {formatRecipients(message.cc_emails)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 p-2 border-b">
        <Button variant="outline" size="sm" onClick={onReply}>
          <Reply className="h-4 w-4 mr-2" />
          Responder
        </Button>
        <Button variant="outline" size="sm">
          <Forward className="h-4 w-4 mr-2" />
          Encaminhar
        </Button>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {message.body_html ? (
            <iframe
              srcDoc={prepareEmailHtml(message.body_html)}
              title="Email content"
              className="w-full border-0 min-h-[400px]"
              // allow-popups + escape-sandbox => links abrem em nova aba normalmente.
              // allow-same-origin é mantido para conseguir medir scrollHeight.
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              style={{ height: '600px' }}
              onLoad={(e) => {
                // Auto-resize iframe to content height
                const iframe = e.currentTarget;
                try {
                  const contentHeight = iframe.contentDocument?.documentElement?.scrollHeight;
                  if (contentHeight) {
                    iframe.style.height = `${contentHeight + 20}px`;
                  }
                } catch {}
              }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {message.body_text}
            </pre>
          )}
        </div>

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="p-4 border-t">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Anexos ({attachments.length})
            </h4>
            <div className="grid gap-2">
              {attachments.map(attachment => (
                <AttachmentDownloadItem key={attachment.id} attachment={attachment} />
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function AttachmentDownloadItem({ attachment }: { attachment: EmailAttachment }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!attachment.storage_path) {
      toast.error('Anexo não disponível para download');
      return;
    }

    setIsDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('email-attachments')
        .download(attachment.storage_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro ao baixar anexo');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 min-w-0">
        <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm truncate">{attachment.filename}</span>
        {attachment.size_bytes && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            ({Math.round(attachment.size_bytes / 1024)} KB)
          </span>
        )}
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}