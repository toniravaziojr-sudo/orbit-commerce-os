// =============================================
// TEMPLATE SET SAVE HOOK - Save to multi-template system
// =============================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { BlockNode } from '@/lib/builder/types';
import type { Json } from '@/integrations/supabase/types';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail';

interface SaveToTemplateSetParams {
  templateSetId: string;
  pageType: PageType;
  content: BlockNode;
}

interface PublishTemplateSetParams {
  templateSetId: string;
}

export function useTemplateSetSave() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  // Save draft to template set
  const saveDraft = useMutation({
    mutationFn: async ({ templateSetId, pageType, content }: SaveToTemplateSetParams) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Fetch current draft_content
      const { data: templateSet, error: fetchError } = await supabase
        .from('storefront_template_sets')
        .select('draft_content')
        .eq('id', templateSetId)
        .eq('tenant_id', currentTenant.id)
        .single();

      if (fetchError) throw fetchError;

      // Merge the new content for this page type
      const currentDraftContent = (templateSet.draft_content as unknown as Record<string, BlockNode | null>) || {};
      const updatedDraftContent = {
        ...currentDraftContent,
        [pageType]: content,
      };

      // Update the template set
      const { error: updateError } = await supabase
        .from('storefront_template_sets')
        .update({
          draft_content: updatedDraftContent as unknown as Json,
          last_edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateSetId)
        .eq('tenant_id', currentTenant.id);

      if (updateError) throw updateError;

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['template-set-content', variables.templateSetId] });
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  // Publish template set (copy draft to published and set as active)
  const publishTemplateSet = useMutation({
    mutationFn: async ({ templateSetId }: PublishTemplateSetParams) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Fetch current draft_content
      const { data: templateSet, error: fetchError } = await supabase
        .from('storefront_template_sets')
        .select('draft_content')
        .eq('id', templateSetId)
        .eq('tenant_id', currentTenant.id)
        .single();

      if (fetchError) throw fetchError;

      // Copy draft to published
      const { error: updateError } = await supabase
        .from('storefront_template_sets')
        .update({
          published_content: templateSet.draft_content,
          is_published: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateSetId)
        .eq('tenant_id', currentTenant.id);

      if (updateError) throw updateError;

      // Set this template as the published template in store_settings AND mark store as published
      const { error: settingsError } = await supabase
        .from('store_settings')
        .update({
          published_template_id: templateSetId,
          is_published: true, // CRITICAL: Enable public storefront
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', currentTenant.id);

      if (settingsError) throw settingsError;

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['template-set-content', variables.templateSetId] });
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      toast.success('Template publicado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao publicar: ${error.message}`);
    },
  });

  return {
    saveDraft,
    publishTemplateSet,
  };
}
