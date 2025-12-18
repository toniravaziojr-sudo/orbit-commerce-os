// =============================================
// OFFER RULES HOOK - CRUD for offer rules (Cross-sell, Order Bump, Upsell)
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type OfferType = 'cross_sell' | 'order_bump' | 'upsell';
export type CustomerType = 'all' | 'new' | 'returning';
export type DiscountType = 'none' | 'percent' | 'fixed';

export interface OfferRule {
  id: string;
  tenant_id: string;
  name: string;
  type: OfferType;
  is_active: boolean;
  priority: number;
  trigger_product_ids: string[];
  min_order_value: number | null;
  customer_type: CustomerType;
  suggested_product_ids: string[];
  title: string | null;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  default_checked: boolean;
  max_items: number;
  created_at: string;
  updated_at: string;
}

export interface CreateOfferRuleInput {
  name: string;
  type: OfferType;
  is_active?: boolean;
  priority?: number;
  trigger_product_ids?: string[];
  min_order_value?: number | null;
  customer_type?: CustomerType;
  suggested_product_ids: string[];
  title?: string;
  description?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  default_checked?: boolean;
  max_items?: number;
}

export interface UpdateOfferRuleInput extends Partial<CreateOfferRuleInput> {
  id: string;
}

export function useOfferRules(type?: OfferType) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const queryKey = type 
    ? ['offer_rules', tenantId, type] 
    : ['offer_rules', tenantId];

  const { data: rules = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from('offer_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true });
      
      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as OfferRule[];
    },
    enabled: !!tenantId,
  });

  const createRule = useMutation({
    mutationFn: async (input: CreateOfferRuleInput) => {
      if (!tenantId) throw new Error('No tenant selected');

      const { data, error } = await supabase
        .from('offer_rules')
        .insert({
          tenant_id: tenantId,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as OfferRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offer_rules', tenantId] });
      toast.success('Regra criada com sucesso');
    },
    onError: (error) => {
      console.error('Error creating offer rule:', error);
      toast.error('Erro ao criar regra');
    },
  });

  const updateRule = useMutation({
    mutationFn: async (input: UpdateOfferRuleInput) => {
      const { id, ...updates } = input;

      const { data, error } = await supabase
        .from('offer_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as OfferRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offer_rules', tenantId] });
      toast.success('Regra atualizada com sucesso');
    },
    onError: (error) => {
      console.error('Error updating offer rule:', error);
      toast.error('Erro ao atualizar regra');
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('offer_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offer_rules', tenantId] });
      toast.success('Regra excluída com sucesso');
    },
    onError: (error) => {
      console.error('Error deleting offer rule:', error);
      toast.error('Erro ao excluir regra');
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('offer_rules')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as OfferRule;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['offer_rules', tenantId] });
      toast.success(data.is_active ? 'Regra ativada' : 'Regra desativada');
    },
    onError: (error) => {
      console.error('Error toggling offer rule:', error);
      toast.error('Erro ao alterar status da regra');
    },
  });

  return {
    rules,
    isLoading,
    error,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  };
}

// Hook for public storefront to get active rules matching conditions
export function useActiveOfferRules(type: OfferType, tenantSlug: string) {
  return useQuery({
    queryKey: ['offer_rules_public', tenantSlug, type],
    queryFn: async () => {
      // First get tenant_id from slug
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (!tenant) return [];

      const { data, error } = await supabase
        .from('offer_rules')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('type', type)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error) throw error;
      return data as OfferRule[];
    },
    enabled: !!tenantSlug,
  });
}
