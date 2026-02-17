// =============================================
// SHARED CHAT CONVERSATION LIST — Modern v2
// Clean sidebar with relative timestamps
// =============================================

import { Plus, MessageSquare, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatConversationListProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete?: (id: string) => void;
  isCreating?: boolean;
  isLoading?: boolean;
  title?: string;
  className?: string;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD < 7) return `${diffD}d`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function ChatConversationList({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  isCreating,
  isLoading,
  title = "Conversas",
  className,
}: ChatConversationListProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg hover:bg-primary/10"
          onClick={onNew}
          disabled={isCreating}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-1.5 pb-2 space-y-0.5">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer transition-all duration-150",
                currentId === conv.id
                  ? "bg-primary/8 text-foreground"
                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {currentId === conv.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
              )}
              <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium leading-tight">{conv.title || "Nova conversa"}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {relativeTime(conv.updated_at)}
                </p>
              </div>
              {onDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      className="text-destructive text-xs"
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {conversations.length === 0 && !isLoading && (
            <p className="text-[11px] text-muted-foreground/40 text-center py-8">
              Nenhuma conversa ainda
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
