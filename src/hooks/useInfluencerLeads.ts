import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface InfluencerLead {
  id: string;
  tenant_id: string;
  name: string;
  platform: string;
  profile_url: string | null;
  handle: string | null;
  location: string | null;
  follower_range: string | null;
  niche: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  tags: string[];
  notes: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InfluencerLeadInsert = Omit<InfluencerLead, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>;
export type InfluencerLeadUpdate = Partial<InfluencerLeadInsert>;

export function useInfluencerLeads() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: influencers = [], isLoading, error } = useQuery({
    queryKey: ['influencer-leads', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('influencer_leads')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        tags: Array.isArray(item.tags) ? item.tags : []
      })) as InfluencerLead[];
    },
    enabled: !!tenantId,
  });

  const createInfluencer = useMutation({
    mutationFn: async (influencer: InfluencerLeadInsert) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('influencer_leads')
        .insert({ ...influencer, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['influencer-leads', tenantId] });
      toast.success('Influencer adicionado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar influencer: ' + error.message);
    },
  });

  const updateInfluencer = useMutation({
    mutationFn: async ({ id, ...updates }: InfluencerLeadUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('influencer_leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['influencer-leads', tenantId] });
      toast.success('Influencer atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar influencer: ' + error.message);
    },
  });

  const deleteInfluencer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('influencer_leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['influencer-leads', tenantId] });
      toast.success('Influencer removido com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao remover influencer: ' + error.message);
    },
  });

  return {
    influencers,
    isLoading,
    error,
    createInfluencer,
    updateInfluencer,
    deleteInfluencer,
  };
}
