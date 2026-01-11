import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';
import { useEffect, useRef } from 'react';
import { 
  backfillStorefrontAssets,
} from '@/lib/registerFileToDrive';
import { replaceSystemAsset } from '@/lib/replaceSystemAsset';

// Interface para redes sociais customizadas
export interface CustomSocialLink {
  label: string;
  url: string;
  icon?: string;
}

export interface StoreSettings {
  id: string;
  tenant_id: string;
  // Informações do negócio
  business_legal_name: string | null;
  business_cnpj: string | null;
  store_name: string | null; // Nome Fantasia (campo legado, mantido)
  store_description: string | null; // Descrição curta (campo legado, mantido)
  logo_url: string | null;
  favicon_url: string | null;
  // Informações de contato
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  contact_support_hours: string | null;
  // Redes sociais
  social_facebook: string | null;
  social_instagram: string | null;
  social_whatsapp: string | null;
  social_tiktok: string | null;
  social_youtube: string | null;
  social_custom: CustomSocialLink[];
  // Cores do tema
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  // Outros campos existentes
  is_published: boolean;
  header_style: string | null;
  footer_style: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
  custom_css: string | null;
  custom_scripts: string | null;
  created_at: string;
  updated_at: string;
}

export type StoreSettingsFormData = {
  business_legal_name?: string | null;
  business_cnpj?: string | null;
  store_name?: string | null;
  store_description?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_address?: string | null;
  contact_support_hours?: string | null;
  social_facebook?: string | null;
  social_instagram?: string | null;
  social_whatsapp?: string | null;
  social_tiktok?: string | null;
  social_youtube?: string | null;
  social_custom?: Json;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  is_published?: boolean;
};

// Helper para converter social_custom de/para Json
function parseSocialCustom(data: Json | null): CustomSocialLink[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return {
          label: String((item as Record<string, unknown>).label || ''),
          url: String((item as Record<string, unknown>).url || ''),
          icon: (item as Record<string, unknown>).icon ? String((item as Record<string, unknown>).icon) : undefined,
        };
      }
      return { label: '', url: '' };
    });
  }
  return [];
}

export function useStoreSettings() {
  const { currentTenant, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const backfillRanRef = useRef(false);

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['store-settings', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      // Transformar para o tipo StoreSettings
      const result: StoreSettings = {
        ...data,
        social_custom: parseSocialCustom(data.social_custom),
      };
      
      return result;
    },
    enabled: !!currentTenant?.id,
  });

  // Backfill: register existing logo/favicon to Drive if not already there
  useEffect(() => {
    if (
      settings && 
      currentTenant?.id && 
      user?.id && 
      !backfillRanRef.current &&
      (settings.logo_url || settings.favicon_url)
    ) {
      backfillRanRef.current = true;
      backfillStorefrontAssets(
        currentTenant.id,
        user.id,
        settings.logo_url,
        settings.favicon_url
      ).then(() => {
        // Invalidate files query to show newly registered files
        queryClient.invalidateQueries({ queryKey: ['files', currentTenant.id] });
      });
    }
  }, [settings, currentTenant?.id, user?.id, queryClient]);

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

  // Upload de imagem para o bucket store-assets + registra no Drive
  // SEMPRE gera path único para evitar cache de sobrescrita
  const uploadAsset = async (file: File, assetType: 'logo' | 'favicon'): Promise<string | null> => {
    if (!currentTenant?.id || !user?.id) return null;
    
    // Get current URL for reference (old file)
    const oldUrl = assetType === 'logo' ? settings?.logo_url : settings?.favicon_url;
    
    // Use replaceSystemAsset which generates UNIQUE paths
    const result = await replaceSystemAsset({
      tenantId: currentTenant.id,
      userId: user.id,
      file,
      assetType,
      oldUrl,
    });
    
    if (!result) {
      toast({ 
        title: 'Erro no upload', 
        description: 'Não foi possível fazer o upload do arquivo',
        variant: 'destructive' 
      });
      return null;
    }

    // Invalidate files query to show newly registered file
    queryClient.invalidateQueries({ queryKey: ['files', currentTenant.id] });
    // Also invalidate store-settings-urls for badge updates
    queryClient.invalidateQueries({ queryKey: ['store-settings-urls', currentTenant.id] });
    
    return result.publicUrl;
  };

  return {
    settings,
    isLoading,
    error,
    upsertSettings,
    togglePublish,
    uploadAsset,
  };
}
