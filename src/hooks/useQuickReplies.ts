import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface QuickReply {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  shortcut: string | null;
  category: string | null;
  tags: string[];
  variables: string[];
  use_count: number;
  is_active: boolean;
  created_at: string;
}

export function useQuickReplies() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  const quickRepliesQuery = useQuery({
    queryKey: ['quick-replies', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('use_count', { ascending: false });

      if (error) throw error;
      return data as QuickReply[];
    },
    enabled: !!currentTenant?.id,
  });

  const createQuickReply = useMutation({
    mutationFn: async (input: {
      title: string;
      content: string;
      shortcut?: string;
      category?: string;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('quick_replies')
        .insert({
          tenant_id: currentTenant.id,
          title: input.title,
          content: input.content,
          shortcut: input.shortcut,
          category: input.category,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
      toast.success('Resposta rápida criada');
    },
    onError: (error) => {
      toast.error('Erro ao criar resposta rápida');
      console.error(error);
    },
  });

  const updateQuickReply = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuickReply> & { id: string }) => {
      const { error } = await supabase
        .from('quick_replies')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
      toast.success('Resposta rápida atualizada');
    },
  });

  const deleteQuickReply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quick_replies')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
      toast.success('Resposta rápida removida');
    },
  });

  const incrementUseCount = useMutation({
    mutationFn: async (id: string) => {
      // Get current count and increment
      const { data } = await supabase
        .from('quick_replies')
        .select('use_count')
        .eq('id', id)
        .single();

      if (data) {
        await supabase
          .from('quick_replies')
          .update({ use_count: (data.use_count || 0) + 1 })
          .eq('id', id);
      }
    },
  });

  // Apply variables to content
  const applyVariables = (content: string, variables: Record<string, string>) => {
    let result = content;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  };

  return {
    quickReplies: quickRepliesQuery.data || [],
    isLoading: quickRepliesQuery.isLoading,
    createQuickReply,
    updateQuickReply,
    deleteQuickReply,
    incrementUseCount,
    applyVariables,
  };
}
