// =============================================
// USE BUILDER DATA - Hooks for fetching builder data
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { BlockNode, PageVersion, StorefrontTemplate } from '@/lib/builder/types';
import { getDefaultTemplate } from '@/lib/builder/defaults';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout';

// Fetch templates for current tenant
export function useStorefrontTemplates() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['storefront-templates', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Initialize templates if needed
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

// Fetch a specific template version (draft or published)
export function useTemplateVersion(pageType: PageType, mode: 'draft' | 'published') {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['template-version', currentTenant?.id, pageType, mode],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get the template to find version numbers
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
        // Return default template
        return {
          content: getDefaultTemplate(pageType),
          version: null,
          isDefault: true,
        };
      }

      // Fetch the version content
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

// Fetch page versions for history
export function usePageVersionHistory(entityType: 'page' | 'template', pageId?: string, pageType?: PageType) {
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

// Save draft mutation
export function useSaveDraft() {
  const { currentTenant, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      entityType, 
      pageId, 
      pageType, 
      content 
    }: { 
      entityType: 'page' | 'template'; 
      pageId?: string; 
      pageType?: PageType; 
      content: BlockNode;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get current draft version number
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

      // Insert new version
      const insertData = {
        tenant_id: currentTenant.id,
        entity_type: entityType,
        version: newVersion,
        status: 'draft' as const,
        content: content as unknown as Record<string, unknown>,
        created_by: user?.id || null,
        page_type: entityType === 'template' ? pageType : null,
        page_id: entityType === 'page' ? pageId : null,
      };

      const { error: insertError } = await supabase
        .from('store_page_versions')
        .insert(insertData);

      if (insertError) throw insertError;

      // Update template/page with new draft version
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
    onSuccess: (_, variables) => {
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

// Publish mutation
export function usePublish() {
  const { currentTenant, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      entityType, 
      pageId, 
      pageType, 
      content 
    }: { 
      entityType: 'page' | 'template'; 
      pageId?: string; 
      pageType?: PageType; 
      content: BlockNode;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get current published version number
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

      // Archive old published version if exists
      if (currentPublishedVersion > 0) {
        const archiveQuery = supabase
          .from('store_page_versions')
          .update({ status: 'archived' })
          .eq('tenant_id', currentTenant.id)
          .eq('entity_type', entityType)
          .eq('status', 'published');

        if (entityType === 'template') {
          await archiveQuery.eq('page_type', pageType!);
        } else {
          await archiveQuery.eq('page_id', pageId!);
        }
      }

      // Insert new published version
      const insertData = {
        tenant_id: currentTenant.id,
        entity_type: entityType,
        version: newVersion,
        status: 'published' as const,
        content: content as unknown as Record<string, unknown>,
        created_by: user?.id || null,
        page_type: entityType === 'template' ? pageType : null,
        page_id: entityType === 'page' ? pageId : null,
      };

      const { error: insertError } = await supabase
        .from('store_page_versions')
        .insert(insertData);

      if (insertError) throw insertError;

      // Update template/page with new published version
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

// Restore version mutation
export function useRestoreVersion() {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      versionId 
    }: { 
      versionId: string;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get the version to restore
      const { data: version, error: fetchError } = await supabase
        .from('store_page_versions')
        .select('*')
        .eq('id', versionId)
        .single();

      if (fetchError) throw fetchError;

      // Get current draft version
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

      // Insert restored content as new draft
      const insertData = {
        tenant_id: currentTenant.id,
        entity_type: version.entity_type,
        version: newVersion,
        status: 'draft' as const,
        content: version.content as Record<string, unknown>,
        created_by: version.created_by,
        page_type: version.page_type,
        page_id: version.page_id,
      };

      const { error: insertError } = await supabase
        .from('store_page_versions')
        .insert(insertData);

      if (insertError) throw insertError;

      // Update draft version reference
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
        insertData.page_id = pageId;
      }

      const { error: insertError } = await supabase
        .from('store_page_versions')
        .insert(insertData);

      if (insertError) throw insertError;

      // Update template/page with new draft version
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
    onSuccess: (_, variables) => {
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

// Publish mutation
export function usePublish() {
  const { currentTenant, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      entityType, 
      pageId, 
      pageType, 
      content 
    }: { 
      entityType: 'page' | 'template'; 
      pageId?: string; 
      pageType?: PageType; 
      content: BlockNode;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get current published version number
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

      // Archive old published version if exists
      if (currentPublishedVersion > 0) {
        const archiveQuery = supabase
          .from('store_page_versions')
          .update({ status: 'archived' })
          .eq('tenant_id', currentTenant.id)
          .eq('entity_type', entityType)
          .eq('status', 'published');

        if (entityType === 'template') {
          await archiveQuery.eq('page_type', pageType);
        } else {
          await archiveQuery.eq('page_id', pageId);
        }
      }

      // Insert new published version
      const insertData: Record<string, unknown> = {
        tenant_id: currentTenant.id,
        entity_type: entityType,
        version: newVersion,
        status: 'published',
        content,
        created_by: user?.id,
      };

      if (entityType === 'template') {
        insertData.page_type = pageType;
      } else {
        insertData.page_id = pageId;
      }

      const { error: insertError } = await supabase
        .from('store_page_versions')
        .insert(insertData);

      if (insertError) throw insertError;

      // Update template/page with new published version
      if (entityType === 'template' && pageType) {
        await supabase
          .from('storefront_page_templates')
          .update({ 
            published_version: newVersion,
            draft_version: newVersion, // Sync draft with published
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

// Restore version mutation
export function useRestoreVersion() {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      versionId 
    }: { 
      versionId: string;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get the version to restore
      const { data: version, error: fetchError } = await supabase
        .from('store_page_versions')
        .select('*')
        .eq('id', versionId)
        .single();

      if (fetchError) throw fetchError;

      // Get current draft version
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

      // Insert restored content as new draft
      const insertData: Record<string, unknown> = {
        tenant_id: currentTenant.id,
        entity_type: version.entity_type,
        version: newVersion,
        status: 'draft',
        content: version.content,
        created_by: version.created_by,
      };

      if (version.entity_type === 'template') {
        insertData.page_type = version.page_type;
      } else {
        insertData.page_id = version.page_id;
      }

      const { error: insertError } = await supabase
        .from('store_page_versions')
        .insert(insertData);

      if (insertError) throw insertError;

      // Update draft version reference
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

      return { version: newVersion, content: version.content as BlockNode };
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
