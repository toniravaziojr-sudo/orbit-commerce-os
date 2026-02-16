// =============================================
// SHARED CHAT CONVERSATION LIST
// Sidebar list of conversations
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
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-primary/10"
          onClick={onNew}
          disabled={isCreating}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "group flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-all duration-150",
                currentId === conv.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{conv.title || "Nova conversa"}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {new Date(conv.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              {onDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 flex-shrink-0"
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
            <p className="text-[11px] text-muted-foreground/60 text-center py-6">
              Nenhuma conversa ainda
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
