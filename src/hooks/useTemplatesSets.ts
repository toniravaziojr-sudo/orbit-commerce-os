// =============================================
// MULTI-TEMPLATE SETS HOOK
// Manages multiple storefront templates per tenant
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { BlockNode } from '@/lib/builder/types';
import type { Json } from '@/integrations/supabase/types';
import { getBlankTemplate } from '@/lib/builder/defaults';

export interface TemplateSet {
  id: string;
  tenant_id: string;
  name: string;
  base_preset: 'blank' | 'custom';
  draft_content: Record<string, BlockNode | null> | null;
  published_content: Record<string, BlockNode | null> | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  last_edited_at: string;
  is_archived: boolean;
}

export interface CreateTemplateParams {
  name: string;
  basePreset: 'blank';
}

export function useTemplateSets() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all templates for the tenant
  const templatesQuery = useQuery({
    queryKey: ['template-sets', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('storefront_template_sets')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as TemplateSet[];
    },
    enabled: !!currentTenant?.id,
  });

  // Get the published template ID from store_settings
  const publishedTemplateQuery = useQuery({
    queryKey: ['published-template-id', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('store_settings')
        .select('published_template_id, is_published')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return {
        publishedTemplateId: data?.published_template_id as string | null,
        isStorePublished: data?.is_published ?? false,
      };
    },
    enabled: !!currentTenant?.id,
  });

  // Get the published template
  const publishedTemplate = templatesQuery.data?.find(
    t => t.id === publishedTemplateQuery.data?.publishedTemplateId
  );

  // Create a new template
  const createTemplate = useMutation({
    mutationFn: async ({ name, basePreset }: CreateTemplateParams) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Build initial draft content - blank template with header/footer for all page types
      const draftContent: Record<string, BlockNode | null> = {};
      const pageTypes = ['home', 'category', 'product', 'cart', 'checkout', 'thank_you', 'account', 'account_orders', 'account_order_detail'];
      for (const pageType of pageTypes) {
        draftContent[pageType] = getBlankTemplate(pageType);
      }

      const { data, error } = await supabase
        .from('storefront_template_sets')
        .insert({
          tenant_id: currentTenant.id,
          name,
          base_preset: basePreset,
          draft_content: draftContent as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as TemplateSet;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
      toast({ title: `Template "${data.name}" criado!` });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update template name
  const renameTemplate = useMutation({
    mutationFn: async ({ templateId, newName }: { templateId: string; newName: string }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('storefront_template_sets')
        .update({ name: newName })
        .eq('id', templateId)
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
      toast({ title: 'Template renomeado!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao renomear template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Duplicate template
  const duplicateTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // First get the template to duplicate
      const { data: original, error: fetchError } = await supabase
        .from('storefront_template_sets')
        .select('*')
        .eq('id', templateId)
        .single();

      if (fetchError) throw fetchError;

      // Create new template with copy of content
      const { data, error } = await supabase
        .from('storefront_template_sets')
        .insert({
          tenant_id: currentTenant.id,
          name: `Cópia de ${original.name}`,
          base_preset: original.base_preset,
          draft_content: original.draft_content,
          // Don't copy published content - new template starts as draft
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as TemplateSet;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
      toast({ title: `Template duplicado: "${data.name}"` });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao duplicar template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete (archive) template
  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Check if this is the published template
      if (publishedTemplateQuery.data?.publishedTemplateId === templateId) {
        throw new Error('Não é possível excluir o template publicado');
      }

      const { error } = await supabase
        .from('storefront_template_sets')
        .update({ is_archived: true })
        .eq('id', templateId)
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
      toast({ title: 'Template excluído!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Set a template as published
  const setPublishedTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get the template to publish
      const { data: template, error: fetchError } = await supabase
        .from('storefront_template_sets')
        .select('*')
        .eq('id', templateId)
        .single();

      if (fetchError) throw fetchError;

      // Update template: copy draft to published, mark as published
      const { error: templateError } = await supabase
        .from('storefront_template_sets')
        .update({
          published_content: template.draft_content,
          is_published: true,
        })
        .eq('id', templateId);

      if (templateError) throw templateError;

      // Unmark previous published template (if any)
      const { error: unmarkError } = await supabase
        .from('storefront_template_sets')
        .update({ is_published: false })
        .eq('tenant_id', currentTenant.id)
        .neq('id', templateId);

      if (unmarkError) throw unmarkError;

      // Update store_settings with the new published template
      const { error: settingsError } = await supabase
        .from('store_settings')
        .update({ published_template_id: templateId })
        .eq('tenant_id', currentTenant.id);

      if (settingsError) throw settingsError;

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
      queryClient.invalidateQueries({ queryKey: ['published-template-id'] });
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      toast({ title: 'Template publicado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao publicar template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save draft content for a specific page in a template
  const saveDraft = useMutation({
    mutationFn: async ({ 
      templateId, 
      pageType, 
      content 
    }: { 
      templateId: string; 
      pageType: string; 
      content: BlockNode;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get current draft content
      const { data: template, error: fetchError } = await supabase
        .from('storefront_template_sets')
        .select('draft_content')
        .eq('id', templateId)
        .single();

      if (fetchError) throw fetchError;

      // Merge with new page content
      const updatedContent = {
        ...(template.draft_content as Record<string, any> || {}),
        [pageType]: content,
      };

      const { error } = await supabase
        .from('storefront_template_sets')
        .update({
          draft_content: updatedContent as unknown as Json,
          last_edited_at: new Date().toISOString(),
        })
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
      toast({ title: 'Rascunho salvo!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar rascunho',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    templates: templatesQuery.data || [],
    publishedTemplateId: publishedTemplateQuery.data?.publishedTemplateId,
    publishedTemplate,
    isStorePublished: publishedTemplateQuery.data?.isStorePublished ?? false,
    isLoading: templatesQuery.isLoading || publishedTemplateQuery.isLoading,
    createTemplate,
    renameTemplate,
    duplicateTemplate,
    deleteTemplate,
    setPublishedTemplate,
    saveDraft,
  };
}
