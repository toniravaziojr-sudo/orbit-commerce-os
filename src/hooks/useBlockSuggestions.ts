// =============================================
// HOOK: useBlockSuggestions
// Manages block implementation requests for platform admins
// =============================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type BlockRequestStatus = 'pending' | 'in_progress' | 'implemented' | 'rejected' | 'mapped';

export interface BlockImplementationRequest {
  id: string;
  tenant_id: string;
  custom_block_id: string | null;
  pattern_name: string;
  pattern_description: string | null;
  html_sample: string;
  css_sample: string | null;
  source_url: string | null;
  source_platform: string | null;
  suggested_props: Record<string, any>;
  occurrences_count: number;
  status: BlockRequestStatus;
  implemented_as: string | null;
  mapped_to_block: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  implementation_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  tenant?: {
    name: string;
    slug: string;
  };
  custom_block?: {
    id: string;
    name: string;
    html_template: string;
    css_snapshot: string | null;
  };
}

interface UseBlockSuggestionsOptions {
  status?: BlockRequestStatus | BlockRequestStatus[];
}

export function useBlockSuggestions(options: UseBlockSuggestionsOptions = {}) {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<BlockImplementationRequest | null>(null);

  // Fetch all requests (platform admin only)
  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['block-implementation-requests', options.status],
    queryFn: async () => {
      let query = supabase
        .from('block_implementation_requests')
        .select(`
          *,
          tenant:tenants(name, slug),
          custom_block:custom_blocks(id, name, html_template, css_snapshot)
        `)
        .order('created_at', { ascending: false });

      // Filter by status if provided
      if (options.status) {
        if (Array.isArray(options.status)) {
          query = query.in('status', options.status);
        } else {
          query = query.eq('status', options.status);
        }
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as BlockImplementationRequest[];
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  // Update request status
  const updateStatus = useMutation({
    mutationFn: async ({ 
      requestId, 
      status,
      notes,
    }: { 
      requestId: string; 
      status: BlockRequestStatus;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('block_implementation_requests')
        .update({
          status,
          implementation_notes: notes,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-implementation-requests'] });
      toast.success('Status atualizado');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  // Mark as implemented
  const markImplemented = useMutation({
    mutationFn: async ({ 
      requestId, 
      implementedAs,
      notes,
    }: { 
      requestId: string; 
      implementedAs: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('block_implementation_requests')
        .update({
          status: 'implemented' as BlockRequestStatus,
          implemented_as: implementedAs,
          implementation_notes: notes,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      // Also update the custom_block if exists
      const request = requests?.find(r => r.id === requestId);
      if (request?.custom_block_id) {
        await supabase
          .from('custom_blocks')
          .update({
            status: 'promoted',
            promoted_to_block: implementedAs,
          })
          .eq('id', request.custom_block_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-implementation-requests'] });
      toast.success('Marcado como implementado');
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Map to existing block
  const mapToExisting = useMutation({
    mutationFn: async ({ 
      requestId, 
      existingBlockType,
      notes,
    }: { 
      requestId: string; 
      existingBlockType: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('block_implementation_requests')
        .update({
          status: 'mapped' as BlockRequestStatus,
          mapped_to_block: existingBlockType,
          implementation_notes: notes,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-implementation-requests'] });
      toast.success('Mapeado para bloco existente');
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Reject request
  const rejectRequest = useMutation({
    mutationFn: async ({ 
      requestId, 
      notes,
    }: { 
      requestId: string; 
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('block_implementation_requests')
        .update({
          status: 'rejected' as BlockRequestStatus,
          implementation_notes: notes,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      // Optionally deprecate the custom_block
      const request = requests?.find(r => r.id === requestId);
      if (request?.custom_block_id) {
        await supabase
          .from('custom_blocks')
          .update({ status: 'deprecated' })
          .eq('id', request.custom_block_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-implementation-requests'] });
      toast.success('Solicitação rejeitada');
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Calculate counts by status
  const counts = {
    pending: requests?.filter(r => r.status === 'pending').length || 0,
    in_progress: requests?.filter(r => r.status === 'in_progress').length || 0,
    implemented: requests?.filter(r => r.status === 'implemented').length || 0,
    rejected: requests?.filter(r => r.status === 'rejected').length || 0,
    mapped: requests?.filter(r => r.status === 'mapped').length || 0,
    total: requests?.length || 0,
  };

  return {
    requests,
    isLoading,
    error,
    counts,
    selectedRequest,
    setSelectedRequest,
    updateStatus,
    markImplemented,
    mapToExisting,
    rejectRequest,
  };
}
