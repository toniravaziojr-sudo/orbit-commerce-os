import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Star, Paperclip } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmailMessage } from "@/hooks/useEmailMessages";
import { EmptyState } from "@/components/ui/empty-state";
import { Mail } from "lucide-react";

interface EmailListProps {
  messages: EmailMessage[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function stripHtmlTags(text: string): string {
  if (!text) return '';
  // Decode HTML entities and strip tags
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return doc.body.textContent?.substring(0, 120) || '';
}

function formatEmailDate(dateStr: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  
  if (isToday(date)) {
    return format(date, 'HH:mm', { locale: ptBR });
  }
  if (isYesterday(date)) {
    return 'Ontem';
  }
  if (isThisYear(date)) {
    return format(date, 'd MMM', { locale: ptBR });
  }
  return format(date, 'd MMM yyyy', { locale: ptBR });
}

export function EmailList({ messages, isLoading, selectedId, onSelect }: EmailListProps) {
  if (isLoading) {
    return (
      <div className="p-2 space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="p-3 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <EmptyState
          icon={Mail}
          title="Nenhum email"
          description="Esta pasta está vazia"
        />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y">
        {messages.map(message => (
          <button
            key={message.id}
            className={cn(
              "w-full text-left p-3 hover:bg-muted/50 transition-colors",
              selectedId === message.id && "bg-muted",
              !message.is_read && "bg-primary/5"
            )}
            onClick={() => onSelect(message.id)}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    "text-sm truncate",
                    !message.is_read && "font-semibold"
                  )}>
                    {message.from_name || message.from_email}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatEmailDate(message.received_at || message.created_at)}
                  </span>
                </div>

                <div className={cn(
                  "text-sm truncate",
                  !message.is_read ? "text-foreground" : "text-muted-foreground"
                )}>
                  {message.subject || '(Sem assunto)'}
                </div>

                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {stripHtmlTags(message.snippet || message.body_text?.substring(0, 300) || '')}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {message.is_starred && (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  )}
                  {message.has_attachments && (
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
