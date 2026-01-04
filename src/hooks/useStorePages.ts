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
  // Menu visibility fields
  show_in_menu: boolean;
  menu_label: string | null;
  menu_order: number;
  // SEO fields
  meta_title: string | null;
  meta_description: string | null;
  meta_image_url: string | null;
  no_index: boolean | null;
  canonical_url: string | null;
  // Template fields (Shopify-like)
  template_id: string | null;
  individual_content: string | null;
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
  // Menu visibility fields
  show_in_menu?: boolean;
  menu_label?: string | null;
  menu_order?: number;
  // Template fields
  template_id?: string | null;
  individual_content?: string | null;
};

export function useStorePages() {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pages, isLoading, error, refetch } = useQuery({
    queryKey: ['store-pages', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_pages')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .in('type', ['institutional', 'landing_page', 'custom']) // Include all content page types in unified "Páginas da Loja"
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
          template_id: formData.template_id || null,
          individual_content: formData.individual_content || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as StorePage;
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
      // First, get the page to check if it has a template
      const { data: page, error: fetchError } = await supabase
        .from('store_pages')
        .select('template_id')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const templateId = page?.template_id;
      
      // Delete the page first
      const { error } = await supabase.from('store_pages').delete().eq('id', id);
      if (error) throw error;
      
      // Then delete the associated template if it exists
      if (templateId) {
        await supabase.from('page_templates').delete().eq('id', templateId);
        // We don't throw on template deletion error - page is already deleted
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
      queryClient.invalidateQueries({ queryKey: ['page-templates'] });
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
    refetch,
    createPage,
    updatePage,
    deletePage,
  };
}
