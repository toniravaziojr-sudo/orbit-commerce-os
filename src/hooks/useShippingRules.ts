// =============================================
// SHIPPING RULES HOOKS
// Hooks for managing free and custom shipping rules
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// =============================================
// TYPES
// =============================================

export interface ShippingFreeRule {
  id: string;
  tenant_id: string;
  name: string;
  region_type: 'capital' | 'interior';
  cep_start: string;
  cep_end: string;
  uf: string | null;
  min_order_cents: number | null;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ShippingCustomRule {
  id: string;
  tenant_id: string;
  name: string;
  region_type: 'capital' | 'interior';
  cep_start: string;
  cep_end: string;
  uf: string | null;
  min_order_cents: number | null;
  price_cents: number;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ShippingFreeRuleInput = Omit<ShippingFreeRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>;
export type ShippingCustomRuleInput = Omit<ShippingCustomRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>;

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Normalize CEP to only digits (8 characters)
 */
export function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '').padStart(8, '0').slice(0, 8);
}

/**
 * Format CEP for display (XXXXX-XXX)
 */
export function formatCep(cep: string): string {
  const normalized = normalizeCep(cep);
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}

/**
 * Format price in cents to BRL
 */
export function formatPriceBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// =============================================
// FREE SHIPPING RULES HOOK
// =============================================

export function useShippingFreeRules() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['shipping-free-rules', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('shipping_free_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as ShippingFreeRule[];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (input: ShippingFreeRuleInput) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('shipping_free_rules')
        .insert({
          ...input,
          tenant_id: tenantId,
          cep_start: normalizeCep(input.cep_start),
          cep_end: normalizeCep(input.cep_end),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-free-rules', tenantId] });
      toast.success('Regra de frete grátis criada com sucesso');
    },
    onError: (error) => {
      console.error('Error creating free shipping rule:', error);
      toast.error('Erro ao criar regra de frete grátis');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ShippingFreeRuleInput> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...input };
      if (input.cep_start) updateData.cep_start = normalizeCep(input.cep_start);
      if (input.cep_end) updateData.cep_end = normalizeCep(input.cep_end);
      
      const { data, error } = await supabase
        .from('shipping_free_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-free-rules', tenantId] });
      toast.success('Regra de frete grátis atualizada');
    },
    onError: (error) => {
      console.error('Error updating free shipping rule:', error);
      toast.error('Erro ao atualizar regra de frete grátis');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shipping_free_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-free-rules', tenantId] });
      toast.success('Regra de frete grátis excluída');
    },
    onError: (error) => {
      console.error('Error deleting free shipping rule:', error);
      toast.error('Erro ao excluir regra de frete grátis');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('shipping_free_rules')
        .update({ is_enabled })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-free-rules', tenantId] });
    },
    onError: (error) => {
      console.error('Error toggling free shipping rule:', error);
      toast.error('Erro ao alterar status da regra');
    },
  });

  return {
    rules,
    isLoading,
    error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    toggle: toggleMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// =============================================
// CUSTOM SHIPPING RULES HOOK
// =============================================

export function useShippingCustomRules() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['shipping-custom-rules', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('shipping_custom_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as ShippingCustomRule[];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (input: ShippingCustomRuleInput) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('shipping_custom_rules')
        .insert({
          ...input,
          tenant_id: tenantId,
          cep_start: normalizeCep(input.cep_start),
          cep_end: normalizeCep(input.cep_end),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-custom-rules', tenantId] });
      toast.success('Regra de frete personalizado criada com sucesso');
    },
    onError: (error) => {
      console.error('Error creating custom shipping rule:', error);
      toast.error('Erro ao criar regra de frete personalizado');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ShippingCustomRuleInput> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...input };
      if (input.cep_start) updateData.cep_start = normalizeCep(input.cep_start);
      if (input.cep_end) updateData.cep_end = normalizeCep(input.cep_end);
      
      const { data, error } = await supabase
        .from('shipping_custom_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-custom-rules', tenantId] });
      toast.success('Regra de frete personalizado atualizada');
    },
    onError: (error) => {
      console.error('Error updating custom shipping rule:', error);
      toast.error('Erro ao atualizar regra de frete personalizado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shipping_custom_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-custom-rules', tenantId] });
      toast.success('Regra de frete personalizado excluída');
    },
    onError: (error) => {
      console.error('Error deleting custom shipping rule:', error);
      toast.error('Erro ao excluir regra de frete personalizado');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('shipping_custom_rules')
        .update({ is_enabled })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-custom-rules', tenantId] });
    },
    onError: (error) => {
      console.error('Error toggling custom shipping rule:', error);
      toast.error('Erro ao alterar status da regra');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const ruleToDuplicate = rules.find(r => r.id === id);
      if (!ruleToDuplicate) throw new Error('Regra não encontrada');
      
      const { data, error } = await supabase
        .from('shipping_custom_rules')
        .insert({
          tenant_id: tenantId,
          name: `${ruleToDuplicate.name} (cópia)`,
          region_type: ruleToDuplicate.region_type,
          cep_start: ruleToDuplicate.cep_start,
          cep_end: ruleToDuplicate.cep_end,
          uf: ruleToDuplicate.uf,
          min_order_cents: ruleToDuplicate.min_order_cents,
          price_cents: ruleToDuplicate.price_cents,
          delivery_days_min: ruleToDuplicate.delivery_days_min,
          delivery_days_max: ruleToDuplicate.delivery_days_max,
          is_enabled: false,
          sort_order: ruleToDuplicate.sort_order + 1,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-custom-rules', tenantId] });
      toast.success('Regra duplicada com sucesso');
    },
    onError: (error) => {
      console.error('Error duplicating custom shipping rule:', error);
      toast.error('Erro ao duplicar regra');
    },
  });

  return {
    rules,
    isLoading,
    error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    toggle: toggleMutation.mutate,
    duplicate: duplicateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
