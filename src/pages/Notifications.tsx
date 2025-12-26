import { useState, useEffect } from "react";
import { Bell, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { useNotificationRulesV2, type NotificationRuleV2 } from "@/hooks/useNotificationRulesV2";
import {
  NotificationsStatsCards,
  NotificationsList,
  NotificationsFilterComponent,
  NotificationDetailDialog,
  RescheduleDialog,
  RulesListV2,
  RuleFormDialogV2,
  PostSaleBackfillButton,
  ReplayEventsButton,
} from "@/components/notifications";

function useIsAdminOrOwner(tenantId: string | null | undefined) {
  const [isAdminOrOwner, setIsAdminOrOwner] = useState<boolean | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !tenantId) {
      setIsAdminOrOwner(false);
      return;
    }

    const checkRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .in('role', ['owner', 'admin'])
        .maybeSingle();

      if (error) {
        setIsAdminOrOwner(false);
        return;
      }

      setIsAdminOrOwner(!!data);
    };

    checkRole();
  }, [user?.id, tenantId]);

  return isAdminOrOwner;
}

export default function Notifications() {
  const { profile } = useAuth();
  const isAdminOrOwner = useIsAdminOrOwner(profile?.current_tenant_id);
  
  // Notifications state
  const {
    notifications,
    stats,
    isLoading: isLoadingNotifications,
    hasMore,
    filter,
    setFilter,
    loadMore,
    fetchAttempts,
    cancelNotification,
    rescheduleNotification,
    reprocessNotification,
  } = useNotifications();

  // Rules state V2
  const {
    rules,
    isLoading: isLoadingRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  } = useNotificationRulesV2();

  // UI state
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<NotificationRuleV2 | null>(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);


  const handleViewDetails = (notification: Notification) => {
    setSelectedNotification(notification);
    setDetailOpen(true);
  };

  const handleReschedule = (id: string) => {
    setRescheduleId(id);
  };

  const handleRescheduleConfirm = async (date: Date) => {
    if (!rescheduleId) return false;
    const success = await rescheduleNotification(rescheduleId, date);
    if (success) setRescheduleId(null);
    return success;
  };

  const handleEditRule = (rule: NotificationRuleV2) => {
    setEditingRule(rule);
    setRuleFormOpen(true);
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setRuleFormOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Notificações & Automações"
        description="Configure regras, automações e notificações por WhatsApp e Email"
      />

      <NotificationsStatsCards stats={stats} />

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Zap className="h-4 w-4" />
            Regras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Notificações</CardTitle>
              <NotificationsFilterComponent filter={filter} onFilterChange={setFilter} />
            </CardHeader>
            <CardContent>
              <NotificationsList
                notifications={notifications}
                isLoading={isLoadingNotifications}
                hasMore={hasMore}
                onLoadMore={loadMore}
                onViewDetails={handleViewDetails}
                onCancel={cancelNotification}
                onReschedule={handleReschedule}
                onReprocess={reprocessNotification}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Regras de Automação</CardTitle>
                  <CardDescription>Configure regras para enviar notificações automáticas via WhatsApp e E-mail</CardDescription>
                </div>
                {isAdminOrOwner && (
                  <div className="flex items-center gap-2">
                    <PostSaleBackfillButton />
                    <ReplayEventsButton />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <RulesListV2
                rules={rules}
                isLoading={isLoadingRules}
                canEdit={!!isAdminOrOwner}
                onToggle={toggleRule}
                onEdit={handleEditRule}
                onDelete={deleteRule}
                onCreate={handleCreateRule}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NotificationDetailDialog
        notification={selectedNotification}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        fetchAttempts={fetchAttempts}
      />

      <RescheduleDialog
        open={!!rescheduleId}
        onOpenChange={() => setRescheduleId(null)}
        onConfirm={handleRescheduleConfirm}
      />

      <RuleFormDialogV2
        rule={editingRule}
        open={ruleFormOpen}
        onOpenChange={setRuleFormOpen}
        onSave={createRule}
        onUpdate={updateRule}
      />
    </div>
  );
}
