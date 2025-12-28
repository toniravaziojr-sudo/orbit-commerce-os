import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, AlertCircle, Bot, User } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { Link } from "react-router-dom";

export function SupportWidget() {
  const { stats, isLoading } = useConversations();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const needsAttention = stats?.needsAttention || 0;

  return (
    <Card className={needsAttention > 0 ? 'border-orange-500/50' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Atendimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {needsAttention > 0 && (
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {needsAttention} {needsAttention === 1 ? 'conversa precisa' : 'conversas precisam'} de atenção
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-muted rounded">
            <div className="text-lg font-bold">{stats?.inProgress || 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <User className="h-3 w-3" /> Atendendo
            </div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-lg font-bold">{stats?.botActive || 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Bot className="h-3 w-3" /> IA
            </div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-lg font-bold">{stats?.resolvedToday || 0}</div>
            <div className="text-xs text-muted-foreground">Resolvidas</div>
          </div>
        </div>

        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to="/support">Ver Central →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
