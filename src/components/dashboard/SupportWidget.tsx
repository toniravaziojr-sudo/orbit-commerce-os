import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, AlertCircle, Bot, User, Clock, Mail, MessageCircle } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { Link } from "react-router-dom";

export function SupportWidget() {
  const { stats, conversations, isLoading } = useConversations();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Central de Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const needsAttention = stats?.needsAttention || 0;
  const openConversations = conversations?.filter(c => 
    c.status === 'new' || c.status === 'open' || c.status === 'bot'
  ) || [];

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return <MessageCircle className="h-4 w-4 text-green-500" />;
      case 'email': return <Mail className="h-4 w-4 text-blue-500" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  return (
    <Card className={needsAttention > 0 ? 'border-orange-500/50 bg-orange-500/5' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Central de Atendimento
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/support">Ver Central →</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert for conversations needing attention */}
        {needsAttention > 0 && (
          <div className="flex items-center gap-2 p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg text-orange-700 dark:text-orange-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">
              {needsAttention} {needsAttention === 1 ? 'conversa precisa' : 'conversas precisam'} de atenção
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-600">{stats?.needsAttention || 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3" /> Aguardando
            </div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{stats?.inProgress || 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <User className="h-3 w-3" /> Atendendo
            </div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-600">{stats?.botActive || 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Bot className="h-3 w-3" /> IA
            </div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{stats?.resolvedToday || 0}</div>
            <div className="text-xs text-muted-foreground">Resolvidas</div>
          </div>
        </div>

        {/* Recent open conversations */}
        {openConversations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Conversas em aberto</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {openConversations.slice(0, 5).map((conv) => (
                <Link
                  key={conv.id}
                  to={`/support?conversation=${conv.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  {getChannelIcon(conv.channel_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {conv.customer_name || conv.customer_phone || conv.customer_email || 'Cliente'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.subject || 'Sem assunto'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {getTimeAgo(conv.last_message_at)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {openConversations.length === 0 && needsAttention === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma conversa em aberto</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
