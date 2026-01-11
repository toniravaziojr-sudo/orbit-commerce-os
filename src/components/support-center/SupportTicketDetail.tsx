import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Send,
  Clock,
  CheckCircle2,
  ArrowUpCircle,
  Loader2,
  Building2,
  User,
  Shield,
} from "lucide-react";
import { useSupportTicketMessages, SupportTicket } from "@/hooks/useSupportTickets";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface SupportTicketDetailProps {
  ticketId: string;
  ticket?: SupportTicket;
  onBack: () => void;
}

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-slate-100 text-slate-600' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-600' },
  high: { label: 'Alta', color: 'bg-amber-100 text-amber-600' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-600' },
};

const statusConfig = {
  open: { label: 'Aberto', icon: Clock, color: 'text-amber-500 bg-amber-50' },
  pending: { label: 'Aguardando Cliente', icon: ArrowUpCircle, color: 'text-blue-500 bg-blue-50' },
  closed: { label: 'Fechado', icon: CheckCircle2, color: 'text-green-500 bg-green-50' },
};

const categoryLabels: Record<string, string> = {
  general: 'Geral',
  billing: 'Cobrança',
  technical: 'Técnico',
  feature: 'Sugestão',
  bug: 'Bug/Erro',
  other: 'Outro',
};

export function SupportTicketDetail({ ticketId, ticket, onBack }: SupportTicketDetailProps) {
  const { messages, isLoading, sendMessage } = useSupportTicketMessages(ticketId);
  const { updateTicketStatus } = useSupportTickets();
  const { isPlatformOperator } = usePlatformOperator();
  const { user } = useAuth();
  
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage.mutateAsync({
        ticketId,
        content: newMessage.trim(),
      });
      setNewMessage('');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCloseTicket = async () => {
    await updateTicketStatus.mutateAsync({
      ticketId,
      status: 'closed',
    });
  };

  const handleReopenTicket = async () => {
    await updateTicketStatus.mutateAsync({
      ticketId,
      status: 'open',
    });
  };

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = statusConfig[ticket.status];
  const priority = priorityConfig[ticket.priority];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold truncate">{ticket.subject}</h1>
            <Badge variant="outline" className={priority.color}>
              {priority.label}
            </Badge>
            <Badge className={cn("flex items-center gap-1", status.color)}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span>{categoryLabels[ticket.category] || ticket.category}</span>
            <span>•</span>
            <span>
              Criado {formatDistanceToNow(new Date(ticket.created_at), { 
                addSuffix: true, 
                locale: ptBR 
              })}
            </span>
            {isPlatformOperator && ticket.tenant_name && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {ticket.tenant_name}
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          {ticket.status !== 'closed' ? (
            <Button 
              variant="outline" 
              onClick={handleCloseTicket}
              disabled={updateTicketStatus.isPending}
            >
              {updateTicketStatus.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Fechar Chamado
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={handleReopenTicket}
              disabled={updateTicketStatus.isPending}
            >
              {updateTicketStatus.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="mr-2 h-4 w-4" />
              )}
              Reabrir
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <Card className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages?.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Nenhuma mensagem ainda.
            </div>
          ) : (
            <>
              {messages?.map((msg) => {
                const isFromPlatform = msg.sender_type === 'platform';
                const isFromCurrentUser = msg.sender_user_id === user?.id;

                return (
                  <div 
                    key={msg.id}
                    className={cn(
                      "flex gap-3",
                      isFromCurrentUser && "flex-row-reverse"
                    )}
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className={cn(
                        isFromPlatform 
                          ? "bg-primary/10 text-primary" 
                          : "bg-secondary"
                      )}>
                        {isFromPlatform ? (
                          <Shield className="h-5 w-5" />
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "flex-1 max-w-[80%]",
                      isFromCurrentUser && "flex flex-col items-end"
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {isFromPlatform ? 'Suporte Comando Central' : msg.sender_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className={cn(
                        "rounded-lg p-3 text-sm whitespace-pre-wrap",
                        isFromPlatform
                          ? "bg-primary/5 border border-primary/20"
                          : "bg-muted"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </CardContent>

        {/* Input */}
        {ticket.status !== 'closed' && (
          <>
            <Separator />
            <div className="p-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  className="resize-none"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="flex-shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
