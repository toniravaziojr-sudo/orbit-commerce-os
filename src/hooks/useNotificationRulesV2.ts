import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

// Rule Types
export type RuleType = 'payment' | 'shipping' | 'abandoned_checkout' | 'post_sale';

// Trigger conditions by type
export type PaymentCondition = 
  | 'payment_approved' 
  | 'pix_generated' 
  | 'boleto_generated' 
  | 'payment_declined' 
  | 'payment_expired';

export type ShippingCondition = 
  | 'posted' 
  | 'in_transit' 
  | 'out_for_delivery' 
  | 'awaiting_pickup' 
  | 'returning' 
  | 'issue' 
  | 'delivered';

export type TriggerCondition = PaymentCondition | ShippingCondition | null;

// Channel types
export type NotificationChannel = 'email' | 'whatsapp';

// Delay units
export type DelayUnit = 'minutes' | 'hours' | 'days';

// Attachment type
export interface RuleAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
}

// Main rule interface
export interface NotificationRuleV2 {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  rule_type: RuleType;
  trigger_condition: TriggerCondition;
  trigger_event_type: string;
  channels: NotificationChannel[];
  whatsapp_message: string | null;
  email_subject: string | null;
  email_body: string | null;
  delay_seconds: number;
  delay_unit: DelayUnit;
  product_scope: 'all' | 'specific';
  product_ids: string[] | null;
  attachments: RuleAttachment[];
  priority: number;
  dedupe_scope: 'order' | 'customer' | 'cart' | 'none' | null;
  created_at: string;
  updated_at: string;
}

// Input for creating/updating rules
export interface NotificationRuleInputV2 {
  name: string;
  description?: string;
  is_enabled?: boolean;
  rule_type: RuleType;
  trigger_condition?: TriggerCondition;
  channels: NotificationChannel[];
  whatsapp_message?: string;
  email_subject?: string;
  email_body?: string;
  delay_seconds?: number;
  delay_unit?: DelayUnit;
  product_scope?: 'all' | 'specific';
  product_ids?: string[];
  attachments?: RuleAttachment[];
  priority?: number;
}

// Map rule_type + trigger_condition to trigger_event_type
function getTriggerEventType(ruleType: RuleType, condition: TriggerCondition): string {
  if (ruleType === 'payment') {
    switch (condition) {
      case 'payment_approved': return 'order.paid';
      case 'pix_generated': return 'order.pix_generated';
      case 'boleto_generated': return 'order.boleto_generated';
      case 'payment_declined': return 'order.payment_declined';
      case 'payment_expired': return 'order.payment_expired';
      default: return 'order.paid';
    }
  }
  if (ruleType === 'shipping') {
    switch (condition) {
      case 'posted': return 'order.shipped';
      case 'in_transit': return 'order.in_transit';
      case 'out_for_delivery': return 'order.out_for_delivery';
      case 'awaiting_pickup': return 'order.awaiting_pickup';
      case 'returning': return 'order.returning';
      case 'issue': return 'order.shipping_issue';
      case 'delivered': return 'order.delivered';
      default: return 'order.shipped';
    }
  }
  if (ruleType === 'abandoned_checkout') {
    return 'checkout.abandoned';
  }
  if (ruleType === 'post_sale') {
    return 'customer.first_order';
  }
  return 'order.created';
}

// Get dedupe scope based on rule type
function getDedupeScope(ruleType: RuleType): 'order' | 'customer' | 'cart' | 'none' {
  switch (ruleType) {
    case 'payment':
    case 'shipping':
      return 'order';
    case 'abandoned_checkout':
      return 'cart';
    case 'post_sale':
      return 'customer';
    default:
      return 'none';
  }
}

export function useNotificationRulesV2() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  
  const [rules, setRules] = useState<NotificationRuleV2[]>([]);
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

      const typedRules: NotificationRuleV2[] = (data || []).map(row => ({
        id: row.id,
        tenant_id: row.tenant_id,
        name: row.name,
        description: row.description,
        is_enabled: row.is_enabled,
        rule_type: (row.rule_type as RuleType) || 'payment',
        trigger_condition: row.trigger_condition as TriggerCondition,
        trigger_event_type: row.trigger_event_type,
        channels: (row.channels as NotificationChannel[]) || ['email'],
        whatsapp_message: row.whatsapp_message as string | null,
        email_subject: row.email_subject as string | null,
        email_body: row.email_body as string | null,
        delay_seconds: row.delay_seconds ?? 0,
        delay_unit: (row.delay_unit as DelayUnit) || 'minutes',
        product_scope: (row.product_scope as 'all' | 'specific') || 'all',
        product_ids: row.product_ids as string[] | null,
        attachments: (row.attachments as unknown as RuleAttachment[]) || [],
        priority: row.priority,
        dedupe_scope: row.dedupe_scope as NotificationRuleV2['dedupe_scope'],
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      setRules(typedRules);
    } catch (err) {
      console.error('[useNotificationRulesV2] Error fetching rules:', err);
      toast.error('Erro ao carregar regras');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const createRule = useCallback(async (input: NotificationRuleInputV2): Promise<NotificationRuleV2 | null> => {
    if (!tenantId) return null;

    try {
      const triggerEventType = getTriggerEventType(input.rule_type, input.trigger_condition || null);
      const dedupeScope = getDedupeScope(input.rule_type);

      // Calculate delay in seconds
      let delaySeconds = input.delay_seconds || 0;
      if (input.delay_unit === 'hours') delaySeconds *= 60;
      if (input.delay_unit === 'days') delaySeconds *= 60 * 24;

      const { data, error } = await supabase
        .from('notification_rules')
        .insert({
          tenant_id: tenantId,
          name: input.name,
          description: input.description || null,
          is_enabled: input.is_enabled ?? true,
          rule_type: input.rule_type,
          trigger_condition: input.trigger_condition || null,
          trigger_event_type: triggerEventType,
          channels: input.channels,
          whatsapp_message: input.whatsapp_message || null,
          email_subject: input.email_subject || null,
          email_body: input.email_body || null,
          delay_seconds: delaySeconds,
          delay_unit: input.delay_unit || 'minutes',
          product_scope: input.product_scope || 'all',
          product_ids: input.product_ids || null,
          attachments: (input.attachments || []) as unknown as Json,
          priority: input.priority || 0,
          dedupe_scope: dedupeScope,
          // Legacy fields for compatibility
          filters: [] as unknown as Json,
          actions: [{
            type: 'enqueue_notification',
            channel: input.channels[0] || 'email',
            recipient_path: input.channels.includes('whatsapp') ? 'customer_phone' : 'customer_email',
            template_key: `${input.rule_type}_${input.trigger_condition || 'default'}`,
            delay_seconds: delaySeconds,
          }] as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Regra criada com sucesso');
      await fetchRules();
      
      return data as unknown as NotificationRuleV2;
    } catch (err) {
      console.error('[useNotificationRulesV2] Error creating rule:', err);
      toast.error('Erro ao criar regra');
      return null;
    }
  }, [tenantId, fetchRules]);

  const updateRule = useCallback(async (id: string, input: Partial<NotificationRuleInputV2>): Promise<boolean> => {
    if (!tenantId) return false;

    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.is_enabled !== undefined) updateData.is_enabled = input.is_enabled;
      if (input.rule_type !== undefined) {
        updateData.rule_type = input.rule_type;
        updateData.dedupe_scope = getDedupeScope(input.rule_type);
      }
      if (input.trigger_condition !== undefined) updateData.trigger_condition = input.trigger_condition;
      if (input.rule_type && input.trigger_condition !== undefined) {
        updateData.trigger_event_type = getTriggerEventType(input.rule_type, input.trigger_condition);
      }
      if (input.channels !== undefined) updateData.channels = input.channels;
      if (input.whatsapp_message !== undefined) updateData.whatsapp_message = input.whatsapp_message;
      if (input.email_subject !== undefined) updateData.email_subject = input.email_subject;
      if (input.email_body !== undefined) updateData.email_body = input.email_body;
      if (input.delay_seconds !== undefined || input.delay_unit !== undefined) {
        let delaySeconds = input.delay_seconds ?? 0;
        const unit = input.delay_unit || 'minutes';
        if (unit === 'hours') delaySeconds *= 60;
        if (unit === 'days') delaySeconds *= 60 * 24;
        updateData.delay_seconds = delaySeconds;
        updateData.delay_unit = unit;
      }
      if (input.product_scope !== undefined) updateData.product_scope = input.product_scope;
      if (input.product_ids !== undefined) updateData.product_ids = input.product_ids;
      if (input.attachments !== undefined) updateData.attachments = input.attachments as unknown as Json;
      if (input.priority !== undefined) updateData.priority = input.priority;

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
      console.error('[useNotificationRulesV2] Error updating rule:', err);
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
      console.error('[useNotificationRulesV2] Error deleting rule:', err);
      toast.error('Erro ao excluir regra');
      return false;
    }
  }, [tenantId, fetchRules]);

  const toggleRule = useCallback(async (id: string, enabled: boolean): Promise<boolean> => {
    return updateRule(id, { is_enabled: enabled });
  }, [updateRule]);

  // Filter rules by type
  const getRulesByType = useCallback((type: RuleType): NotificationRuleV2[] => {
    return rules.filter(r => r.rule_type === type);
  }, [rules]);

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
    getRulesByType,
    paymentRules: getRulesByType('payment'),
    shippingRules: getRulesByType('shipping'),
    abandonedCheckoutRules: getRulesByType('abandoned_checkout'),
    postSaleRules: getRulesByType('post_sale'),
  };
}
