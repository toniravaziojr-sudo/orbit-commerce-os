import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, AlertTriangle, Mail, Bell } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function CommunicationsWidget() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const { stats, isLoading: conversationsLoading } = useConversations();

  // Fetch notification errors count
  const { data: notificationErrors = 0, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notification-errors-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'failed');
      
      if (error) {
        console.error('Error fetching notification errors:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch unread emails count
  const { data: unreadEmails = 0, isLoading: emailsLoading } = useQuery({
    queryKey: ['unread-emails-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count, error } = await supabase
        .from('email_messages')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_read', false);
      
      if (error) {
        console.error('Error fetching unread emails:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Refresh every 30s
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!tenantId) return;

    // Subscribe to notifications changes
    const notificationsChannel = supabase
      .channel('notifications-errors-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notification-errors-count', tenantId] });
        }
      )
      .subscribe();

    // Subscribe to email_messages changes
    const emailsChannel = supabase
      .channel('emails-unread-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unread-emails-count', tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(emailsChannel);
    };
  }, [tenantId, queryClient]);

  const isLoading = conversationsLoading || notificationsLoading || emailsLoading;

  // Calculate open conversations (new + open + bot)
  const openConversations = (stats?.needsAttention || 0) + (stats?.inProgress || 0) + (stats?.botActive || 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comunicações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const hasIssues = openConversations > 0 || notificationErrors > 0 || unreadEmails > 0;

  return (
    <Card className={hasIssues ? 'border-primary/30' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comunicações
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Open Conversations */}
          <Link 
            to="/support" 
            className="p-3 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors group"
          >
            <div className={`text-2xl font-bold ${openConversations > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
              {openConversations}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 group-hover:text-foreground">
              <MessageSquare className="h-3 w-3" /> 
              <span>Atendimentos</span>
            </div>
          </Link>

          {/* Notification Errors */}
          <Link 
            to="/notifications" 
            className="p-3 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors group"
          >
            <div className={`text-2xl font-bold ${notificationErrors > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {notificationErrors}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 group-hover:text-foreground">
              <AlertTriangle className="h-3 w-3" /> 
              <span>Erros</span>
            </div>
          </Link>

          {/* Unread Emails */}
          <Link 
            to="/emails" 
            className="p-3 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors group"
          >
            <div className={`text-2xl font-bold ${unreadEmails > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
              {unreadEmails}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 group-hover:text-foreground">
              <Mail className="h-3 w-3" /> 
              <span>Não lidos</span>
            </div>
          </Link>
        </div>

        {/* Quick links */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link to="/support">
              <MessageSquare className="h-4 w-4 mr-1" />
              Atendimento
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link to="/notifications">
              <Bell className="h-4 w-4 mr-1" />
              Notificações
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link to="/emails">
              <Mail className="h-4 w-4 mr-1" />
              Emails
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
