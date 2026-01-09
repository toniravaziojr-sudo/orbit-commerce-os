import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface AffiliateProgram {
  tenant_id: string;
  is_enabled: boolean;
  attribution_window_days: number;
  commission_type: 'percent' | 'fixed';
  commission_value_cents: number;
  created_at: string;
  updated_at: string;
}

export interface Affiliate {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'paused' | 'blocked';
  payout_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateLink {
  id: string;
  tenant_id: string;
  affiliate_id: string;
  code: string;
  target_url: string | null;
  created_at: string;
}

export interface AffiliateConversion {
  id: string;
  tenant_id: string;
  affiliate_id: string;
  order_id: string;
  order_total_cents: number;
  commission_cents: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  created_at: string;
}

export interface AffiliatePayout {
  id: string;
  tenant_id: string;
  affiliate_id: string;
  amount_cents: number;
  status: 'pending' | 'approved' | 'paid';
  paid_at: string | null;
  proof_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface AffiliateStats {
  clicks: number;
  conversions: number;
  pending_commission: number;
  approved_commission: number;
  paid_commission: number;
}

export function useAffiliateProgram() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: program, isLoading } = useQuery({
    queryKey: ['affiliate-program', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('affiliate_programs')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (error) throw error;
      return data as AffiliateProgram | null;
    },
    enabled: !!tenantId,
  });

  const upsertProgram = useMutation({
    mutationFn: async (updates: Partial<Omit<AffiliateProgram, 'tenant_id' | 'created_at' | 'updated_at'>>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('affiliate_programs')
        .upsert({ tenant_id: tenantId, ...updates }, { onConflict: 'tenant_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-program', tenantId] });
      toast.success('Programa de afiliados atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar programa: ' + error.message);
    },
  });

  return { program, isLoading, upsertProgram };
}

export function useAffiliates() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: affiliates = [], isLoading } = useQuery({
    queryKey: ['affiliates', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Affiliate[];
    },
    enabled: !!tenantId,
  });

  const createAffiliate = useMutation({
    mutationFn: async (affiliate: Omit<Affiliate, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('affiliates')
        .insert({ ...affiliate, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates', tenantId] });
      toast.success('Afiliado criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar afiliado: ' + error.message);
    },
  });

  const updateAffiliate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Affiliate> & { id: string }) => {
      const { data, error } = await supabase
        .from('affiliates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates', tenantId] });
      toast.success('Afiliado atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar afiliado: ' + error.message);
    },
  });

  const deleteAffiliate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates', tenantId] });
      toast.success('Afiliado removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover afiliado: ' + error.message);
    },
  });

  return { affiliates, isLoading, createAffiliate, updateAffiliate, deleteAffiliate };
}

export function useAffiliateLinks(affiliateId?: string) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['affiliate-links', tenantId, affiliateId],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from('affiliate_links')
        .select('*')
        .eq('tenant_id', tenantId);
      
      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as AffiliateLink[];
    },
    enabled: !!tenantId,
  });

  const createLink = useMutation({
    mutationFn: async (link: { affiliate_id: string; code: string; target_url?: string }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('affiliate_links')
        .insert({ ...link, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-links', tenantId] });
      toast.success('Link criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar link: ' + error.message);
    },
  });

  return { links, isLoading, createLink };
}

export function useAffiliateConversions(affiliateId?: string) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: conversions = [], isLoading } = useQuery({
    queryKey: ['affiliate-conversions', tenantId, affiliateId],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from('affiliate_conversions')
        .select('*')
        .eq('tenant_id', tenantId);
      
      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as AffiliateConversion[];
    },
    enabled: !!tenantId,
  });

  const updateConversionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AffiliateConversion['status'] }) => {
      const { data, error } = await supabase
        .from('affiliate_conversions')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-conversions', tenantId] });
      toast.success('Status atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  return { conversions, isLoading, updateConversionStatus };
}

export function useAffiliateStats(affiliateId?: string) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['affiliate-stats', tenantId, affiliateId],
    queryFn: async (): Promise<AffiliateStats> => {
      if (!tenantId) return { clicks: 0, conversions: 0, pending_commission: 0, approved_commission: 0, paid_commission: 0 };

      // Get clicks
      let clicksQuery = supabase
        .from('affiliate_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if (affiliateId) clicksQuery = clicksQuery.eq('affiliate_id', affiliateId);
      const { count: clicks } = await clicksQuery;

      // Get conversions with commissions
      let conversionsQuery = supabase
        .from('affiliate_conversions')
        .select('status, commission_cents')
        .eq('tenant_id', tenantId);
      if (affiliateId) conversionsQuery = conversionsQuery.eq('affiliate_id', affiliateId);
      const { data: conversionData } = await conversionsQuery;

      const stats: AffiliateStats = {
        clicks: clicks || 0,
        conversions: conversionData?.length || 0,
        pending_commission: 0,
        approved_commission: 0,
        paid_commission: 0,
      };

      conversionData?.forEach(c => {
        if (c.status === 'pending') stats.pending_commission += c.commission_cents;
        if (c.status === 'approved') stats.approved_commission += c.commission_cents;
        if (c.status === 'paid') stats.paid_commission += c.commission_cents;
      });

      return stats;
    },
    enabled: !!tenantId,
  });
}

export function useAffiliatePayouts(affiliateId?: string) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['affiliate-payouts', tenantId, affiliateId],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from('affiliate_payouts')
        .select('*')
        .eq('tenant_id', tenantId);
      
      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as AffiliatePayout[];
    },
    enabled: !!tenantId,
  });

  const createPayout = useMutation({
    mutationFn: async (payout: { affiliate_id: string; amount_cents: number; notes?: string }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('affiliate_payouts')
        .insert({ ...payout, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-payouts', tenantId] });
      toast.success('Pagamento registrado');
    },
    onError: (error) => {
      toast.error('Erro ao registrar pagamento: ' + error.message);
    },
  });

  const updatePayout = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AffiliatePayout> & { id: string }) => {
      const { data, error } = await supabase
        .from('affiliate_payouts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-payouts', tenantId] });
      toast.success('Pagamento atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  return { payouts, isLoading, createPayout, updatePayout };
}

// Utility to generate affiliate code
export function generateAffiliateCode(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  const random = Math.random().toString(36).substring(2, 6);
  return `${slug}${random}`;
}
