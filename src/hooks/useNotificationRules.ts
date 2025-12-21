import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface NotificationRuleFilter {
  path: string;
  op: 'eq' | 'neq' | 'exists' | 'gte' | 'lte' | 'contains';
  value: unknown;
}

export interface NotificationRuleAction {
  type: 'enqueue_notification';
  channel: string;
  recipient_path: string;
  template_key: string;
  delay_seconds: number;
}

export interface NotificationRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger_event_type: string;
  filters: NotificationRuleFilter[] | null;
  actions: NotificationRuleAction[] | null;
  dedupe_scope: 'order' | 'customer' | 'cart' | 'none' | null;
  priority: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationRuleInput {
  name: string;
  description?: string;
  trigger_event_type: string;
  filters?: NotificationRuleFilter[];
  actions?: NotificationRuleAction[];
  dedupe_scope?: 'order' | 'customer' | 'cart' | 'none';
  priority?: number;
  is_enabled?: boolean;
}

export function useNotificationRules() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('notification_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false });

      if (error) throw error;

      // Convert from database types
      const typedRules: NotificationRule[] = (data || []).map(row => ({
        id: row.id,
        tenant_id: row.tenant_id,
        name: row.name,
        description: row.description,
        trigger_event_type: row.trigger_event_type,
        filters: row.filters as unknown as NotificationRuleFilter[] | null,
        actions: row.actions as unknown as NotificationRuleAction[] | null,
        dedupe_scope: row.dedupe_scope as NotificationRule['dedupe_scope'],
        priority: row.priority,
        is_enabled: row.is_enabled,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      setRules(typedRules);
    } catch (err) {
      console.error('[useNotificationRules] Error fetching rules:', err);
      toast.error('Erro ao carregar regras');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const createRule = useCallback(async (input: NotificationRuleInput): Promise<NotificationRule | null> => {
    if (!tenantId) return null;

    try {
      const { data, error } = await supabase
        .from('notification_rules')
        .insert({
          tenant_id: tenantId,
          name: input.name,
          description: input.description || null,
          trigger_event_type: input.trigger_event_type,
          filters: (input.filters || []) as unknown as Json,
          actions: (input.actions || []) as unknown as Json,
          dedupe_scope: input.dedupe_scope || 'none',
          priority: input.priority || 0,
          is_enabled: input.is_enabled ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Regra criada com sucesso');
      await fetchRules();
      
      return data as unknown as NotificationRule;
    } catch (err) {
      console.error('[useNotificationRules] Error creating rule:', err);
      toast.error('Erro ao criar regra');
      return null;
    }
  }, [tenantId, fetchRules]);

  const updateRule = useCallback(async (id: string, input: Partial<NotificationRuleInput>): Promise<boolean> => {
    if (!tenantId) return false;

    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.trigger_event_type !== undefined) updateData.trigger_event_type = input.trigger_event_type;
      if (input.filters !== undefined) updateData.filters = input.filters as unknown as Json;
      if (input.actions !== undefined) updateData.actions = input.actions as unknown as Json;
      if (input.dedupe_scope !== undefined) updateData.dedupe_scope = input.dedupe_scope;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.is_enabled !== undefined) updateData.is_enabled = input.is_enabled;

      const { error } = await supabase
        .from('notification_rules')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      
      toast.success('Regra atualizada');
      await fetchRules();
      return true;
    } catch (err) {
      console.error('[useNotificationRules] Error updating rule:', err);
      toast.error('Erro ao atualizar regra');
      return false;
    }
  }, [tenantId, fetchRules]);

  const deleteRule = useCallback(async (id: string): Promise<boolean> => {
    if (!tenantId) return false;

    try {
      const { error } = await supabase
        .from('notification_rules')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      
      toast.success('Regra excluída');
      await fetchRules();
      return true;
    } catch (err) {
      console.error('[useNotificationRules] Error deleting rule:', err);
      toast.error('Erro ao excluir regra');
      return false;
    }
  }, [tenantId, fetchRules]);

  const toggleRule = useCallback(async (id: string, enabled: boolean): Promise<boolean> => {
    return updateRule(id, { is_enabled: enabled });
  }, [updateRule]);

  useEffect(() => {
    if (tenantId) {
      fetchRules();
    }
  }, [tenantId, fetchRules]);

  return {
    rules,
    isLoading,
    refetch: fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  };
}
