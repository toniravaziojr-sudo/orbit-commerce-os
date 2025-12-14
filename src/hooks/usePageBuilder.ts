// =============================================
// PAGE BUILDER HOOK - Version management for institutional pages
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { BlockNode } from '@/lib/builder/types';
import type { Json } from '@/integrations/supabase/types';

interface PageVersion {
  id: string;
  tenant_id: string;
  entity_type: string;
  page_id: string | null;
  page_type: string | null;
  version: number;
  status: 'draft' | 'published' | 'archived';
  content: BlockNode;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Default template for institutional pages
const defaultInstitutionalTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: 'header-1',
      type: 'Header',
      props: { menuId: '', showSearch: true, showCart: true, sticky: true },
    },
    {
      id: 'section-1',
      type: 'Section',
      props: { backgroundColor: 'transparent', padding: 'lg', fullWidth: false },
      children: [
        {
          id: 'container-1',
          type: 'Container',
          props: { maxWidth: 'md', centered: true },
          children: [
            {
              id: 'richtext-1',
              type: 'RichText',
              props: { content: '<h1>Título da Página</h1><p>Conteúdo da página institucional...</p>' },
            },
          ],
        },
      ],
    },
    {
      id: 'footer-1',
      type: 'Footer',
      props: { menuId: '', showSocial: true, copyrightText: '' },
    },
  ],
};

export function usePageBuilder(pageId: string | undefined) {
  const { currentTenant, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get page info
  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ['store-page', pageId],
    queryFn: async () => {
      if (!pageId) return null;
      const { data, error } = await supabase
        .from('store_pages')
        .select('*')
        .eq('id', pageId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!pageId,
  });

  // Get draft version
  const { data: draftVersion, isLoading: draftLoading } = useQuery({
    queryKey: ['page-draft-version', pageId],
    queryFn: async () => {
      if (!pageId || !currentTenant?.id) return null;
      
      const { data, error } = await supabase
        .from('store_page_versions')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('entity_type', 'page')
        .eq('page_id', pageId)
        .eq('status', 'draft')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      
      // If no draft exists, create one from existing content or template
      if (!data) {
        // Check if page has legacy content to migrate
        const pageData = await supabase
          .from('store_pages')
          .select('content, title')
          .eq('id', pageId)
          .single();
        
        let initialContent = defaultInstitutionalTemplate;
        
        // Migrate legacy content if exists
        if (pageData.data?.content && typeof pageData.data.content === 'object') {
          const legacyContent = pageData.data.content as { text?: string };
          if (legacyContent.text) {
            // Convert text content to RichText block
            initialContent = {
              ...defaultInstitutionalTemplate,
              children: [
                defaultInstitutionalTemplate.children![0],
                {
                  id: 'section-1',
                  type: 'Section',
                  props: { backgroundColor: 'transparent', padding: 'lg', fullWidth: false },
                  children: [
                    {
                      id: 'container-1',
                      type: 'Container',
                      props: { maxWidth: 'md', centered: true },
                      children: [
                        {
                          id: 'richtext-1',
                          type: 'RichText',
                          props: { 
                            content: `<h1>${pageData.data.title || 'Página'}</h1><p>${legacyContent.text}</p>` 
                          },
                        },
                      ],
                    },
                  ],
                },
                defaultInstitutionalTemplate.children![2],
              ],
            };
          }
        }
        
        return {
          id: 'new',
          version: 1,
          status: 'draft',
          content: initialContent,
        } as PageVersion;
      }
      
      return {
        ...data,
        content: data.content as unknown as BlockNode,
      } as PageVersion;
    },
    enabled: !!pageId && !!currentTenant?.id,
  });

  // Get version history
  const { data: versions } = useQuery({
    queryKey: ['page-versions', pageId],
    queryFn: async () => {
      if (!pageId || !currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('store_page_versions')
        .select('id, version, status, created_at, created_by')
        .eq('tenant_id', currentTenant.id)
        .eq('entity_type', 'page')
        .eq('page_id', pageId)
        .order('version', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data;
    },
    enabled: !!pageId && !!currentTenant?.id,
  });

  // Save draft
  const saveDraft = useMutation({
    mutationFn: async (content: BlockNode) => {
      if (!pageId || !currentTenant?.id) throw new Error('Missing page or tenant');
      
      // Get MAX version number from the versions table directly
      const { data: maxVersion } = await supabase
        .from('store_page_versions')
        .select('version')
        .eq('tenant_id', currentTenant.id)
        .eq('entity_type', 'page')
        .eq('page_id', pageId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const nextVersion = (maxVersion?.version || 0) + 1;
      
      // Create new draft version
      const { data, error } = await supabase
        .from('store_page_versions')
        .insert({
          tenant_id: currentTenant.id,
          entity_type: 'page',
          page_id: pageId,
          version: nextVersion,
          status: 'draft',
          content: content as unknown as Json,
          created_by: user?.id || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update page draft_version
      await supabase
        .from('store_pages')
        .update({ 
          draft_version: data.version,
          builder_enabled: true,
        })
        .eq('id', pageId);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-draft-version', pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-versions', pageId] });
      toast({ title: 'Rascunho salvo!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    },
  });

  // Publish
  const publish = useMutation({
    mutationFn: async (content: BlockNode) => {
      if (!pageId || !currentTenant?.id) throw new Error('Missing page or tenant');
      
      // Archive current published
      await supabase
        .from('store_page_versions')
        .update({ status: 'archived' })
        .eq('tenant_id', currentTenant.id)
        .eq('entity_type', 'page')
        .eq('page_id', pageId)
        .eq('status', 'published');
      
      // Get MAX version number from the versions table directly
      const { data: maxVersion } = await supabase
        .from('store_page_versions')
        .select('version')
        .eq('tenant_id', currentTenant.id)
        .eq('entity_type', 'page')
        .eq('page_id', pageId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const nextVersion = (maxVersion?.version || 0) + 1;
      
      // Create published version
      const { data, error } = await supabase
        .from('store_page_versions')
        .insert({
          tenant_id: currentTenant.id,
          entity_type: 'page',
          page_id: pageId,
          version: nextVersion,
          status: 'published',
          content: content as unknown as Json,
          created_by: user?.id || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update page
      await supabase
        .from('store_pages')
        .update({ 
          published_version: data.version,
          draft_version: data.version,
          is_published: true,
          status: 'published',
          builder_enabled: true,
        })
        .eq('id', pageId);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-draft-version', pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-versions', pageId] });
      queryClient.invalidateQueries({ queryKey: ['store-page', pageId] });
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
      toast({ title: 'Página publicada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao publicar', description: error.message, variant: 'destructive' });
    },
  });

  // Restore version
  const restoreVersion = useMutation({
    mutationFn: async (versionId: string) => {
      if (!pageId || !currentTenant?.id) throw new Error('Missing page or tenant');
      
      // Get version content
      const { data: oldVersion, error: fetchError } = await supabase
        .from('store_page_versions')
        .select('content')
        .eq('id', versionId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Get next version number
      const { data: maxVersion } = await supabase
        .from('store_page_versions')
        .select('version')
        .eq('tenant_id', currentTenant.id)
        .eq('entity_type', 'page')
        .eq('page_id', pageId)
        .order('version', { ascending: false })
        .limit(1)
        .single();
      
      const nextVersion = (maxVersion?.version || 0) + 1;
      
      // Create new draft from old version
      const { error } = await supabase
        .from('store_page_versions')
        .insert({
          tenant_id: currentTenant.id,
          entity_type: 'page',
          page_id: pageId,
          version: nextVersion,
          status: 'draft',
          content: oldVersion.content,
          created_by: user?.id || null,
        });
      
      if (error) throw error;
      
      // Update page draft_version
      await supabase
        .from('store_pages')
        .update({ draft_version: nextVersion })
        .eq('id', pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-draft-version', pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-versions', pageId] });
      toast({ title: 'Versão restaurada como rascunho!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao restaurar', description: error.message, variant: 'destructive' });
    },
  });

  return {
    page,
    draftVersion,
    versions,
    isLoading: pageLoading || draftLoading,
    saveDraft,
    publish,
    restoreVersion,
  };
}
