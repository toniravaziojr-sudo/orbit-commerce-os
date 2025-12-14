// =============================================
// LANDING PAGES HOOK - Manage landing pages
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { defaultNeutralPageTemplate } from '@/lib/builder/defaults';
import type { Json } from '@/integrations/supabase/types';

export interface LandingPage {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  content: Json | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // Menu visibility fields
  show_in_menu: boolean;
  menu_label: string | null;
  menu_order: number;
}

export function useLandingPages() {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: landingPages, isLoading } = useQuery({
    queryKey: ['landing-pages', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_pages')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .eq('type', 'landing_page')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LandingPage[];
    },
    enabled: !!currentTenant?.id,
  });

  const createLandingPage = useMutation({
    mutationFn: async (params: { title: string; slug: string }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Create the page with neutral template content
      const { data, error } = await supabase
        .from('store_pages')
        .insert({
          tenant_id: currentTenant.id,
          title: params.title,
          slug: params.slug,
          type: 'landing_page',
          status: 'draft',
          is_published: false,
          builder_enabled: true,
          content: defaultNeutralPageTemplate as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
      toast({ title: 'Landing page criada!' });
      return data;
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar landing page', description: error.message, variant: 'destructive' });
    },
  });

  const deleteLandingPage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('store_pages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
      toast({ title: 'Landing page excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  const duplicateLandingPage = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get original page
      const { data: original, error: fetchError } = await supabase
        .from('store_pages')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !original) throw fetchError || new Error('Page not found');

      // Create copy
      const { data, error } = await supabase
        .from('store_pages')
        .insert({
          tenant_id: currentTenant.id,
          title: `${original.title} (cópia)`,
          slug: `${original.slug}-copia-${Date.now()}`,
          type: 'landing_page',
          status: 'draft',
          is_published: false,
          builder_enabled: true,
          content: original.content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
      toast({ title: 'Landing page duplicada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao duplicar', description: error.message, variant: 'destructive' });
    },
  });

  const updateLandingPage = useMutation({
    mutationFn: async ({ id, ...formData }: { id: string; title?: string; slug?: string; status?: string; is_published?: boolean; show_in_menu?: boolean; menu_label?: string | null }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

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
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
      toast({ title: 'Landing page atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  return {
    landingPages,
    isLoading,
    createLandingPage,
    updateLandingPage,
    deleteLandingPage,
    duplicateLandingPage,
  };
}
