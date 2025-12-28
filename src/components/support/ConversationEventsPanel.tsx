import { useQuery } from "@tanstack/react-query";
import { Clock, User, Bot, ArrowRight, MessageSquare, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ConversationEvent {
  id: string;
  conversation_id: string;
  event_type: string;
  description: string | null;
  actor_type: string | null;
  actor_name: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ConversationEventsPanelProps {
  conversationId: string | null;
}

const EVENT_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
  color: string;
}> = {
  'created': { icon: MessageSquare, label: 'Conversa iniciada', color: 'text-blue-500' },
  'assigned': { icon: User, label: 'Atribuída', color: 'text-green-500' },
  'unassigned': { icon: User, label: 'Desatribuída', color: 'text-orange-500' },
  'transferred': { icon: ArrowRight, label: 'Transferida', color: 'text-purple-500' },
  'status_changed': { icon: AlertCircle, label: 'Status alterado', color: 'text-yellow-500' },
  'resolved': { icon: CheckCircle, label: 'Resolvida', color: 'text-green-600' },
  'reopened': { icon: XCircle, label: 'Reaberta', color: 'text-red-500' },
  'ai_response': { icon: Bot, label: 'Resposta IA', color: 'text-cyan-500' },
  'handoff': { icon: ArrowRight, label: 'Handoff para humano', color: 'text-orange-600' },
  'note_added': { icon: MessageSquare, label: 'Nota adicionada', color: 'text-gray-500' },
  'priority_changed': { icon: AlertCircle, label: 'Prioridade alterada', color: 'text-amber-500' },
  'tags_changed': { icon: MessageSquare, label: 'Tags alteradas', color: 'text-indigo-500' },
};

export function ConversationEventsPanel({ conversationId }: ConversationEventsPanelProps) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['conversation-events', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('conversation_events')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ConversationEvent[];
    },
    enabled: !!conversationId,
  });

  if (!conversationId) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Selecione uma conversa para ver o histórico
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Carregando histórico...
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Nenhum evento registrado
      </div>
    );
  }

  const formatEventDescription = (event: ConversationEvent) => {
    if (event.description) return event.description;

    switch (event.event_type) {
      case 'assigned':
        return `Atribuída para ${event.new_value?.name || 'atendente'}`;
      case 'unassigned':
        return `Removida de ${event.old_value?.name || 'atendente'}`;
      case 'transferred':
        return `Transferida de ${event.old_value?.name || '?'} para ${event.new_value?.name || '?'}`;
      case 'status_changed':
        return `Status: ${event.old_value?.status || '?'} → ${event.new_value?.status || '?'}`;
      case 'ai_response':
        return 'IA gerou resposta automática';
      case 'handoff':
        return event.metadata?.reason 
          ? `Motivo: ${event.metadata.reason}` 
          : 'Cliente solicitou atendimento humano';
      default:
        return event.event_type;
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Histórico de eventos
        </h3>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {events.map((event, index) => {
              const config = EVENT_CONFIG[event.event_type] || {
                icon: MessageSquare,
                label: event.event_type,
                color: 'text-gray-500',
              };
              const Icon = config.icon;

              return (
                <div key={event.id} className="relative flex gap-3 pl-8">
                  {/* Timeline dot */}
                  <div className={cn(
                    "absolute left-2 w-4 h-4 rounded-full bg-background border-2 flex items-center justify-center",
                    config.color.replace('text-', 'border-')
                  )}>
                    <Icon className={cn("h-2 w-2", config.color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{config.label}</span>
                      {event.actor_name && (
                        <span className="text-muted-foreground">
                          por {event.actor_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {formatEventDescription(event)}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      {' · '}
                      {formatDistanceToNow(new Date(event.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
