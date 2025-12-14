import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface StorePage {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  content: Json | null;
  seo_title: string | null;
  seo_description: string | null;
  is_published: boolean;
  is_homepage: boolean;
  created_at: string;
  updated_at: string;
}

export type StorePageFormData = {
  title: string;
  slug: string;
  type?: string;
  status?: string;
  content?: Json | null;
  seo_title?: string | null;
  seo_description?: string | null;
  is_published?: boolean;
};

export function useStorePages() {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pages, isLoading, error } = useQuery({
    queryKey: ['store-pages', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_pages')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .neq('type', 'landing_page') // Exclude landing pages from institutional pages list
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StorePage[];
    },
    enabled: !!currentTenant?.id,
  });

  const createPage = useMutation({
    mutationFn: async (formData: StorePageFormData) => {
      const { data, error } = await supabase
        .from('store_pages')
        .insert({
          title: formData.title,
          slug: formData.slug,
          tenant_id: currentTenant!.id,
          type: formData.type || 'institutional',
          status: formData.status || 'draft',
          content: formData.content || null,
          seo_title: formData.seo_title || null,
          seo_description: formData.seo_description || null,
          is_published: formData.is_published ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
      toast({ title: 'Página criada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar página', description: error.message, variant: 'destructive' });
    },
  });

  const updatePage = useMutation({
    mutationFn: async ({ id, ...formData }: Partial<StorePage> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...formData };
      
      // Sync is_published with status
      if (formData.status === 'published') {
        updateData.is_published = true;
      }

      const { data, error } = await supabase
        .from('store_pages')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
      toast({ title: 'Página atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar página', description: error.message, variant: 'destructive' });
    },
  });

  const deletePage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('store_pages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
      toast({ title: 'Página excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir página', description: error.message, variant: 'destructive' });
    },
  });

  return {
    pages,
    isLoading,
    error,
    createPage,
    updatePage,
    deletePage,
  };
}
