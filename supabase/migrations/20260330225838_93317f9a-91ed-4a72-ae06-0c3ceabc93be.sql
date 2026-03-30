
-- =============================================================
-- Fase 1.1 — Limpeza V3 → V4: 2 Config IDs + Auth Único
-- =============================================================

-- 1. Drop meta_auth_profile_mappings
DROP POLICY IF EXISTS "Authenticated can read profile mappings" ON public.meta_auth_profile_mappings;
DROP POLICY IF EXISTS "Platform admin can manage profile mappings" ON public.meta_auth_profile_mappings;
DROP TABLE IF EXISTS public.meta_auth_profile_mappings;

-- 2. Limpar os 11 profiles antigos e inserir apenas os 2 do V4
DELETE FROM public.meta_auth_profiles;

INSERT INTO public.meta_auth_profiles (profile_key, display_name, description, base_scopes, primary_scopes, effective_scopes, config_id, is_active)
VALUES
  (
    'meta_auth_full',
    'Auth Completo (Tenants Especiais)',
    'Todos os escopos disponíveis. Usado apenas por tenants especiais e admin da plataforma.',
    ARRAY['public_profile'],
    ARRAY[
      'pages_show_list','pages_read_engagement','pages_manage_metadata','pages_manage_posts',
      'pages_manage_engagement','pages_read_user_content','pages_messaging','pages_manage_ads',
      'instagram_basic','instagram_content_publish','instagram_manage_comments','instagram_manage_messages',
      'whatsapp_business_management','whatsapp_business_messaging',
      'leads_retrieval','ads_management','ads_read',
      'catalog_management','business_management','read_insights','publish_video'
    ],
    ARRAY[
      'public_profile','pages_show_list','pages_read_engagement','pages_manage_metadata','pages_manage_posts',
      'pages_manage_engagement','pages_read_user_content','pages_messaging','pages_manage_ads',
      'instagram_basic','instagram_content_publish','instagram_manage_comments','instagram_manage_messages',
      'whatsapp_business_management','whatsapp_business_messaging',
      'leads_retrieval','ads_management','ads_read',
      'catalog_management','business_management','read_insights','publish_video'
    ],
    NULL,
    true
  ),
  (
    'meta_auth_external',
    'Auth Externo (Tenants Padrão)',
    'Apenas escopos já aprovados no App Review da Meta para usuários externos.',
    ARRAY['public_profile'],
    ARRAY[
      'pages_show_list','pages_read_engagement','pages_manage_metadata','pages_manage_posts',
      'instagram_basic','instagram_content_publish','instagram_manage_comments',
      'whatsapp_business_management','whatsapp_business_messaging','read_insights'
    ],
    ARRAY[
      'public_profile','pages_show_list','pages_read_engagement','pages_manage_metadata','pages_manage_posts',
      'instagram_basic','instagram_content_publish','instagram_manage_comments',
      'whatsapp_business_management','whatsapp_business_messaging','read_insights'
    ],
    NULL,
    true
  );

-- 3. Alterar constraint de grant ativo para semântica V4
DROP INDEX IF EXISTS idx_tenant_meta_grants_active_unique;
CREATE UNIQUE INDEX idx_tenant_meta_grants_active_unique
  ON public.tenant_meta_auth_grants (tenant_id)
  WHERE (status = 'active');

COMMENT ON INDEX idx_tenant_meta_grants_active_unique IS 'V4: no máximo 1 grant active por tenant no fluxo Meta principal';

-- 4. Ajustar supersede_meta_grant para V4 (por tenant, sem profile_key)
CREATE OR REPLACE FUNCTION public.supersede_meta_grant(
  p_tenant_id UUID,
  p_new_grant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.tenant_meta_auth_grants
  SET 
    status = 'superseded',
    superseded_at = now(),
    superseded_by = p_new_grant_id,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
    AND id != p_new_grant_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  UPDATE public.tenant_meta_integrations
  SET auth_grant_id = p_new_grant_id, updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND auth_grant_id IN (
      SELECT id FROM public.tenant_meta_auth_grants
      WHERE tenant_id = p_tenant_id
        AND status = 'superseded'
        AND superseded_by = p_new_grant_id
    );
  
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.supersede_meta_grant(UUID, UUID) IS 'V4: Supersede grant ativo do tenant e redireciona integrações.';

-- 5. Dropar versão antiga da função (3 parâmetros)
DROP FUNCTION IF EXISTS public.supersede_meta_grant(UUID, TEXT, UUID);
