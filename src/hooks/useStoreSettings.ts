import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface StoreSettings {
  id: string;
  tenant_id: string;
  store_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  is_published: boolean;
  header_style: string | null;
  footer_style: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_whatsapp: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
  custom_css: string | null;
  custom_scripts: string | null;
  store_description: string | null;
  created_at: string;
  updated_at: string;
}

export type StoreSettingsFormData = Partial<Omit<StoreSettings, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>;

export function useStoreSettings() {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['store-settings', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();

      if (error) throw error;
      return data as StoreSettings | null;
    },
    enabled: !!currentTenant?.id,
  });

  const upsertSettings = useMutation({
    mutationFn: async (formData: StoreSettingsFormData) => {
      // If settings exist, update. Otherwise, create.
      if (settings?.id) {
        const { data, error } = await supabase
          .from('store_settings')
          .update(formData)
          .eq('id', settings.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('store_settings')
          .insert({ ...formData, tenant_id: currentTenant!.id })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      toast({ title: 'Configurações salvas!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar configurações', description: error.message, variant: 'destructive' });
    },
  });

  const togglePublish = useMutation({
    mutationFn: async (publish: boolean) => {
      if (settings?.id) {
        const { data, error } = await supabase
          .from('store_settings')
          .update({ is_published: publish })
          .eq('id', settings.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('store_settings')
          .insert({ tenant_id: currentTenant!.id, is_published: publish })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      toast({ 
        title: data.is_published ? 'Loja publicada!' : 'Loja despublicada',
        description: data.is_published 
          ? 'Sua loja está agora visível para o público.' 
          : 'Sua loja foi ocultada do público.'
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao alterar publicação', description: error.message, variant: 'destructive' });
    },
  });

  return {
    settings,
    isLoading,
    error,
    upsertSettings,
    togglePublish,
  };
}
