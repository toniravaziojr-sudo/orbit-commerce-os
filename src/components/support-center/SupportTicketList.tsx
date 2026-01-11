import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertCircle, 
  ArrowUpCircle, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  MessageSquare,
  Building2,
} from "lucide-react";
import { SupportTicket } from "@/hooks/useSupportTickets";
import { cn } from "@/lib/utils";

interface SupportTicketListProps {
  tickets: SupportTicket[];
  isLoading: boolean;
  onSelectTicket: (id: string) => void;
  isPlatformView?: boolean;
}

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-600 border-blue-200' },
  high: { label: 'Alta', color: 'bg-amber-100 text-amber-600 border-amber-200' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-600 border-red-200' },
};

const statusConfig = {
  open: { label: 'Aberto', icon: Clock, color: 'text-amber-500' },
  pending: { label: 'Aguardando', icon: ArrowUpCircle, color: 'text-blue-500' },
  closed: { label: 'Fechado', icon: CheckCircle2, color: 'text-green-500' },
};

const categoryLabels: Record<string, string> = {
  general: 'Geral',
  billing: 'Cobrança',
  technical: 'Técnico',
  feature: 'Sugestão',
  bug: 'Bug/Erro',
  other: 'Outro',
};

export function SupportTicketList({ 
  tickets, 
  isLoading, 
  onSelectTicket,
  isPlatformView = false,
}: SupportTicketListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">
          Nenhum chamado encontrado
        </h3>
        <p className="text-sm text-muted-foreground/70 mt-1">
          {isPlatformView 
            ? "Não há chamados de suporte no momento"
            : "Você ainda não abriu nenhum chamado"
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tickets.map((ticket) => {
        const priority = priorityConfig[ticket.priority];
        const status = statusConfig[ticket.status];
        const StatusIcon = status.icon;

        return (
          <div
            key={ticket.id}
            className={cn(
              "group flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all",
              "hover:bg-accent/50 hover:border-primary/30",
              ticket.status === 'open' && "border-l-4 border-l-amber-500"
            )}
            onClick={() => onSelectTicket(ticket.id)}
          >
            {/* Status Icon */}
            <div className={cn("flex-shrink-0", status.color)}>
              <StatusIcon className="h-5 w-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm truncate">
                  {ticket.subject}
                </h4>
                <Badge variant="outline" className={cn("text-xs flex-shrink-0", priority.color)}>
                  {priority.label}
                </Badge>
              </div>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(ticket.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span>{categoryLabels[ticket.category] || ticket.category}</span>
                {isPlatformView && ticket.tenant_name && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {ticket.tenant_name}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <Badge 
              variant={ticket.status === 'closed' ? 'secondary' : 'default'}
              className="flex-shrink-0"
            >
              {status.label}
            </Badge>

            {/* Arrow */}
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        );
      })}
    </div>
  );
}
