import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Mic, Image, Bot, User, ArrowLeftRight, XCircle, MessageSquare, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Conversation } from "@/hooks/useConversations";
import type { Message } from "@/hooks/useMessages";
import type { QuickReply } from "@/hooks/useQuickReplies";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { QuickRepliesDropdown } from "./QuickRepliesDropdown";

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  quickReplies: QuickReply[];
  isLoading: boolean;
  onSendMessage: (content: string, options?: { isInternal?: boolean; isNote?: boolean }) => void;
  onAssign: (userId: string | null) => void;
  onResolve: () => void;
  onTransfer: () => void;
  onAiRespond: () => void;
}

export function ChatWindow({
  conversation,
  messages,
  quickReplies,
  isLoading,
  onSendMessage,
  onAssign,
  onResolve,
  onTransfer,
  onAiRespond,
}: ChatWindowProps) {
  const { user, profile } = useAuth();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);


  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Selecione uma conversa</p>
          <p className="text-sm">Escolha uma conversa na lista para começar</p>
        </div>
      </div>
    );
  }

  const isAssignedToMe = conversation.assigned_to === user?.id;
  const canRespond = isAssignedToMe || !conversation.assigned_to;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={conversation.customer_avatar_url || undefined} />
            <AvatarFallback>
              {conversation.customer_name?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">
              {conversation.customer_name || conversation.customer_email || conversation.customer_phone || 'Cliente'}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{conversation.channel_type}</span>
              {conversation.customer_email && <span>• {conversation.customer_email}</span>}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isAssignedToMe && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAssign(user?.id || null)}
                >
                  <User className="h-4 w-4 mr-1" />
                  Assumir
                </Button>
              </TooltipTrigger>
              <TooltipContent>Assumir este atendimento</TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onTransfer}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Transferir conversa</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onResolve}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Encerrar conversa</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound';
            const isBot = msg.sender_type === 'bot';
            const isSystem = msg.sender_type === 'system';
            const isNote = msg.is_note;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              );
            }

            if (isNote) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 px-3 py-2 rounded-lg max-w-md">
                    <div className="flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400 mb-1">
                      <StickyNote className="h-3 w-3" />
                      <span>Nota interna • {msg.sender_name}</span>
                    </div>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2",
                  isOutbound ? "justify-end" : "justify-start"
                )}
              >
                {!isOutbound && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {conversation.customer_name?.[0]?.toUpperCase() || 'C'}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={cn(
                  "max-w-[70%] rounded-lg px-4 py-2",
                  isOutbound
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}>
                  {isBot && (
                    <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                      <Bot className="h-3 w-3" />
                      <span>IA</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <div className={cn(
                    "flex items-center gap-2 text-xs mt-1",
                    isOutbound ? "opacity-70" : "text-muted-foreground"
                  )}>
                    <span>{format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}</span>
                    {isOutbound && (
                      <span className="text-xs">
                        {msg.delivery_status === 'read' ? '✓✓' : 
                         msg.delivery_status === 'delivered' ? '✓✓' :
                         msg.delivery_status === 'sent' ? '✓' : '⏳'}
                      </span>
                    )}
                  </div>
                </div>
                {isOutbound && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {isBot ? <Bot className="h-4 w-4" /> : profile?.full_name?.[0]?.toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-center">
              <span className="text-sm text-muted-foreground animate-pulse">Carregando...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2 mb-2">
          <QuickRepliesDropdown onSelect={(content) => setMessage(content)} />

          <Button variant="ghost" size="sm" onClick={onAiRespond}>
            <Bot className="h-4 w-4 mr-1" />
            Resposta IA
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <StickyNote className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => {
                if (message.trim()) {
                  onSendMessage(message.trim(), { isNote: true });
                  setMessage('');
                }
              }}>
                <StickyNote className="h-4 w-4 mr-2" />
                Adicionar como nota
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 flex gap-2">
            <Button variant="ghost" size="icon" className="shrink-0">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Image className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Mic className="h-4 w-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              placeholder={canRespond ? "Digite sua mensagem..." : "Assuma a conversa para responder"}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!canRespond}
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
            />
          </div>
          <Button onClick={handleSend} disabled={!message.trim() || !canRespond}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
