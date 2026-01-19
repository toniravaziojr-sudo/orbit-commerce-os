import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface PageTemplate {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  content: Json;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageTemplateFormData {
  name: string;
  slug?: string;
  description?: string;
  content?: Json;
  is_default?: boolean;
}

export function usePageTemplates() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['page-templates', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('page_templates')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as PageTemplate[];
    },
    enabled: !!currentTenant?.id,
  });

  const createTemplate = useMutation({
    mutationFn: async (formData: PageTemplateFormData) => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      const slug = formData.slug || formData.name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Default content for new institutional pages
      // Uses same structure as home template - direct editable content, no PageContent placeholder
      const timestamp = Date.now().toString(36);
      const defaultContent = {
        id: 'root',
        type: 'Page',
        props: {},
        children: [
          {
            id: `header-${timestamp}`,
            type: 'Header',
            props: { 
              menuId: '', 
              showSearch: true, 
              showCart: true, 
              sticky: true,
              noticeEnabled: false,
              noticeText: '',
              noticeBgColor: '#1e40af',
              noticeTextColor: '#ffffff',
            }
          },
          {
            id: `section-main-${timestamp}`,
            type: 'Section',
            props: { 
              padding: 'lg',
              backgroundColor: 'transparent',
              fullWidth: false,
            },
            children: []
          },
          {
            id: `footer-${timestamp}`,
            type: 'Footer',
            props: { 
              menuId: '', 
              showSocial: true,
              copyrightText: '',
              footerBgColor: '',
              footerTextColor: '',
              noticeEnabled: false,
              noticeText: '',
              noticeBgColor: '#1e40af',
              noticeTextColor: '#ffffff',
            }
          }
        ]
      };

      const { data, error } = await supabase
        .from('page_templates')
        .insert({
          tenant_id: currentTenant.id,
          name: formData.name,
          slug,
          description: formData.description || null,
          content: formData.content || defaultContent,
          is_default: formData.is_default || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PageTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-templates', currentTenant?.id] });
      toast.success('Template criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar template: ${error.message}`);
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...formData }: Partial<PageTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('page_templates')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as PageTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-templates', currentTenant?.id] });
      toast.success('Template atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar template: ${error.message}`);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('page_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-templates', currentTenant?.id] });
      toast.success('Template excluído');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir template: ${error.message}`);
    },
  });

  const duplicateTemplate = useMutation({
    mutationFn: async (template: PageTemplate) => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      const newSlug = `${template.slug}-copia-${Date.now()}`;
      
      const { data, error } = await supabase
        .from('page_templates')
        .insert({
          tenant_id: currentTenant.id,
          name: `${template.name} (Cópia)`,
          slug: newSlug,
          description: template.description,
          content: template.content,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PageTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-templates', currentTenant?.id] });
      toast.success('Template duplicado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao duplicar template: ${error.message}`);
    },
  });

  const setDefaultTemplate = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      // First, unset all defaults
      await supabase
        .from('page_templates')
        .update({ is_default: false })
        .eq('tenant_id', currentTenant.id);

      // Then set the new default
      const { error } = await supabase
        .from('page_templates')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-templates', currentTenant?.id] });
      toast.success('Template padrão definido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao definir template padrão: ${error.message}`);
    },
  });

  // Initialize default template if none exists
  const initializeDefaultTemplate = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .rpc('initialize_default_page_template', { p_tenant_id: currentTenant.id });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-templates', currentTenant?.id] });
    },
  });

  return {
    templates,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    setDefaultTemplate,
    initializeDefaultTemplate,
  };
}
