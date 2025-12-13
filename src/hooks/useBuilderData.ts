import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { BlockNode, PageVersion, StorefrontTemplate } from '@/lib/builder/types';
import type { Json } from '@/integrations/supabase/types';
import { getDefaultTemplate } from '@/lib/builder/defaults';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout';

export function useStorefrontTemplates() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['storefront-templates', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      await supabase.rpc('initialize_storefront_templates', { 
        p_tenant_id: currentTenant.id 
      });

      const { data, error } = await supabase
        .from('storefront_page_templates')
        .select('*')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
      return data as StorefrontTemplate[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useTemplateVersion(pageType: PageType, mode: 'draft' | 'published') {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['template-version', currentTenant?.id, pageType, mode],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data: template, error: templateError } = await supabase
        .from('storefront_page_templates')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('page_type', pageType)
        .single();

      if (templateError && templateError.code !== 'PGRST116') throw templateError;

      const versionNumber = mode === 'draft' 
        ? template?.draft_version 
        : template?.published_version;

      if (!versionNumber) {
        return {
          content: getDefaultTemplate(pageType),
          version: null,
          isDefault: true,
        };
      }

      const { data: version, error: versionError } = await supabase
        .from('store_page_versions')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('entity_type', 'template')
        .eq('page_type', pageType)
        .eq('version', versionNumber)
        .single();

      if (versionError) throw versionError;

      return {
        content: version.content as unknown as BlockNode,
        version: version as unknown as PageVersion,
        isDefault: false,
      };
    },
    enabled: !!currentTenant?.id,
  });
}

export function usePageVersionHistory(
  entityType: 'page' | 'template', 
  pageId?: string, 
  pageType?: PageType
) {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['page-version-history', currentTenant?.id, entityType, pageId, pageType],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      let query = supabase
        .from('store_page_versions')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('entity_type', entityType)
        .order('version', { ascending: false })
        .limit(30);

      if (entityType === 'page' && pageId) {
        query = query.eq('page_id', pageId);
      } else if (entityType === 'template' && pageType) {
        query = query.eq('page_type', pageType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PageVersion[];
    },
    enabled: !!currentTenant?.id && (
      (entityType === 'page' && !!pageId) || 
      (entityType === 'template' && !!pageType)
    ),
  });
}

export function useSaveDraft() {
  const { currentTenant, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { 
      entityType: 'page' | 'template'; 
      pageId?: string; 
      pageType?: PageType; 
      content: BlockNode;
    }) => {
      const { entityType, pageId, pageType, content } = params;
      if (!currentTenant?.id) throw new Error('No tenant');

      let currentDraftVersion = 0;

      if (entityType === 'template' && pageType) {
        const { data: template } = await supabase
          .from('storefront_page_templates')
          .select('draft_version')
          .eq('tenant_id', currentTenant.id)
          .eq('page_type', pageType)
          .single();
        currentDraftVersion = template?.draft_version || 0;
      } else if (entityType === 'page' && pageId) {
        const { data: page } = await supabase
          .from('store_pages')
          .select('draft_version')
          .eq('id', pageId)
          .single();
        currentDraftVersion = page?.draft_version || 0;
      }

      const newVersion = currentDraftVersion + 1;

      const { error: insertError } = await supabase
        .from('store_page_versions')
        .insert([{
          tenant_id: currentTenant.id,
          entity_type: entityType,
          version: newVersion,
          status: 'draft',
          content: content as unknown as Json,
          created_by: user?.id || null,
          page_type: entityType === 'template' ? pageType : null,
          page_id: entityType === 'page' ? pageId : null,
        }]);

      if (insertError) throw insertError;

      if (entityType === 'template' && pageType) {
        await supabase
          .from('storefront_page_templates')
          .update({ draft_version: newVersion })
          .eq('tenant_id', currentTenant.id)
          .eq('page_type', pageType);
      } else if (entityType === 'page' && pageId) {
        await supabase
          .from('store_pages')
          .update({ draft_version: newVersion })
          .eq('id', pageId);
      }

      return newVersion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-version'] });
      queryClient.invalidateQueries({ queryKey: ['page-version-history'] });
      toast({ title: 'Rascunho salvo!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao salvar rascunho', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

export function usePublish() {
  const { currentTenant, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { 
      entityType: 'page' | 'template'; 
      pageId?: string; 
      pageType?: PageType; 
      content: BlockNode;
    }) => {
      const { entityType, pageId, pageType, content } = params;
      if (!currentTenant?.id) throw new Error('No tenant');

      let currentPublishedVersion = 0;

      if (entityType === 'template' && pageType) {
        const { data: template } = await supabase
          .from('storefront_page_templates')
          .select('published_version')
          .eq('tenant_id', currentTenant.id)
          .eq('page_type', pageType)
          .single();
        currentPublishedVersion = template?.published_version || 0;
      } else if (entityType === 'page' && pageId) {
        const { data: page } = await supabase
          .from('store_pages')
          .select('published_version')
          .eq('id', pageId)
          .single();
        currentPublishedVersion = page?.published_version || 0;
      }

      const newVersion = currentPublishedVersion + 1;

      if (currentPublishedVersion > 0) {
        if (entityType === 'template' && pageType) {
          await supabase
            .from('store_page_versions')
            .update({ status: 'archived' })
            .eq('tenant_id', currentTenant.id)
            .eq('entity_type', entityType)
            .eq('status', 'published')
            .eq('page_type', pageType);
        } else if (entityType === 'page' && pageId) {
          await supabase
            .from('store_page_versions')
            .update({ status: 'archived' })
            .eq('tenant_id', currentTenant.id)
            .eq('entity_type', entityType)
            .eq('status', 'published')
            .eq('page_id', pageId);
        }
      }

      const { error: insertError } = await supabase
        .from('store_page_versions')
        .insert([{
          tenant_id: currentTenant.id,
          entity_type: entityType,
          version: newVersion,
          status: 'published',
          content: content as unknown as Json,
          created_by: user?.id || null,
          page_type: entityType === 'template' ? pageType : null,
          page_id: entityType === 'page' ? pageId : null,
        }]);

      if (insertError) throw insertError;

      if (entityType === 'template' && pageType) {
        await supabase
          .from('storefront_page_templates')
          .update({ 
            published_version: newVersion,
            draft_version: newVersion,
          })
          .eq('tenant_id', currentTenant.id)
          .eq('page_type', pageType);
      } else if (entityType === 'page' && pageId) {
        await supabase
          .from('store_pages')
          .update({ 
            published_version: newVersion,
            draft_version: newVersion,
            is_published: true,
            status: 'published',
          })
          .eq('id', pageId);
      }

      return newVersion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-version'] });
      queryClient.invalidateQueries({ queryKey: ['page-version-history'] });
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
      toast({ title: 'Publicado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao publicar', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

export function useRestoreVersion() {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { versionId: string }) => {
      const { versionId } = params;
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data: version, error: fetchError } = await supabase
        .from('store_page_versions')
        .select('*')
        .eq('id', versionId)
        .single();

      if (fetchError) throw fetchError;

      let currentDraftVersion = 0;

      if (version.entity_type === 'template' && version.page_type) {
        const { data: template } = await supabase
          .from('storefront_page_templates')
          .select('draft_version')
          .eq('tenant_id', currentTenant.id)
          .eq('page_type', version.page_type)
          .single();
        currentDraftVersion = template?.draft_version || 0;
      } else if (version.entity_type === 'page' && version.page_id) {
        const { data: page } = await supabase
          .from('store_pages')
          .select('draft_version')
          .eq('id', version.page_id)
          .single();
        currentDraftVersion = page?.draft_version || 0;
      }

      const newVersion = currentDraftVersion + 1;

      const { error: insertError } = await supabase
        .from('store_page_versions')
        .insert([{
          tenant_id: currentTenant.id,
          entity_type: version.entity_type,
          version: newVersion,
          status: 'draft',
          content: version.content,
          created_by: version.created_by,
          page_type: version.page_type,
          page_id: version.page_id,
        }]);

      if (insertError) throw insertError;

      if (version.entity_type === 'template' && version.page_type) {
        await supabase
          .from('storefront_page_templates')
          .update({ draft_version: newVersion })
          .eq('tenant_id', currentTenant.id)
          .eq('page_type', version.page_type);
      } else if (version.entity_type === 'page' && version.page_id) {
        await supabase
          .from('store_pages')
          .update({ draft_version: newVersion })
          .eq('id', version.page_id);
      }

      return { version: newVersion, content: version.content as unknown as BlockNode };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-version'] });
      queryClient.invalidateQueries({ queryKey: ['page-version-history'] });
      toast({ title: 'Versão restaurada como novo rascunho!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao restaurar versão', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

// Convenience hook that returns all builder data operations
export function useBuilderData(tenantId: string) {
  const saveDraft = useSaveDraft();
  const publish = usePublish();
  const restoreVersion = useRestoreVersion();

  return {
    saveDraft,
    publish,
    restoreVersion,
  };
}
