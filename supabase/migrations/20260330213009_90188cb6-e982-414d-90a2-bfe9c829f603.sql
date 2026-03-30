
-- =============================================================
-- FASE 1: Modelo Meta v3.2 — 4 tabelas com RLS e criptografia
-- =============================================================

-- Habilitar pgcrypto para criptografia de tokens
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- =============================================================
-- 1. meta_auth_profiles (catálogo de perfis de autenticação)
-- =============================================================
CREATE TABLE public.meta_auth_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_key TEXT NOT NULL UNIQUE,              -- ex: 'auth_publicacoes', 'auth_leads'
  display_name TEXT NOT NULL,                     -- ex: 'Publicações FB/IG'
  description TEXT,
  config_id TEXT,                                 -- Facebook Login config_id correspondente
  base_scopes TEXT[] NOT NULL DEFAULT ARRAY['public_profile'],
  primary_scopes TEXT[] NOT NULL DEFAULT '{}',    -- escopos primários do perfil
  effective_scopes TEXT[] NOT NULL DEFAULT '{}',  -- lista final calculada (base + primários + deps)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.meta_auth_profiles IS 'Catálogo de perfis de autenticação Meta (Facebook Login for Business). Cada perfil mapeia para um config_id com escopos específicos.';
COMMENT ON COLUMN public.meta_auth_profiles.effective_scopes IS 'Lista final de escopos = base + primários + dependências automáticas. Deve ter paridade com o config_id na Meta.';

-- =============================================================
-- 2. meta_auth_profile_mappings (seleção → perfil)
-- =============================================================
CREATE TABLE public.meta_auth_profile_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,             -- ex: 'pixel_capi+publicacoes'
  auth_profile_id UUID NOT NULL REFERENCES public.meta_auth_profiles(id) ON DELETE CASCADE,
  integration_ids TEXT[] NOT NULL DEFAULT '{}',   -- ex: ['pixel_capi', 'publicacoes']
  display_label TEXT,                              -- ex: 'Pixel + Publicações'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.meta_auth_profile_mappings IS 'Mapeia combinações de integrações selecionadas na UI para o auth_profile correto.';

-- =============================================================
-- 3. tenant_meta_auth_grants (tokens criptografados por tenant)
-- =============================================================
CREATE TABLE public.tenant_meta_auth_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_profile_key TEXT NOT NULL REFERENCES public.meta_auth_profiles(profile_key) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'superseded', 'orphaned')),
  
  -- Tokens criptografados via pgcrypto
  access_token_encrypted BYTEA,                   -- pgp_sym_encrypt(token, key)
  refresh_token_encrypted BYTEA,
  token_expires_at TIMESTAMPTZ,
  
  -- Metadata do grant
  meta_user_id TEXT,                               -- Facebook User ID
  meta_user_name TEXT,
  granted_scopes TEXT[] DEFAULT '{}',              -- escopos efetivamente concedidos pela Meta
  
  -- Auditoria
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID,                                 -- user_id que autorizou
  superseded_at TIMESTAMPTZ,
  superseded_by UUID,                              -- grant_id que substituiu este
  revoked_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  last_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_meta_auth_grants IS 'Armazena tokens Meta criptografados. Máx 1 grant active por (tenant_id, auth_profile_key).';

-- Constraint: no máximo 1 grant active por (tenant_id, auth_profile_key)
CREATE UNIQUE INDEX idx_tenant_meta_grants_active_unique
  ON public.tenant_meta_auth_grants (tenant_id, auth_profile_key)
  WHERE status = 'active';

-- Indexes de performance
CREATE INDEX idx_tenant_meta_grants_tenant ON public.tenant_meta_auth_grants(tenant_id);
CREATE INDEX idx_tenant_meta_grants_status ON public.tenant_meta_auth_grants(tenant_id, status);

-- =============================================================
-- 4. tenant_meta_integrations (integrações atômicas por tenant)
-- =============================================================
CREATE TABLE public.tenant_meta_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL,                    -- ex: 'publicacoes', 'pixel_capi', 'whatsapp_notificacoes'
  auth_grant_id UUID REFERENCES public.tenant_meta_auth_grants(id) ON DELETE SET NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disconnected', 'error')),
  
  -- Ativos selecionados (Pages, Pixels, Ad Accounts, etc.)
  selected_assets JSONB DEFAULT '{}'::jsonb,       -- ex: {"page_id": "123", "pixel_id": "456"}
  
  -- Metadata operacional
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- UNIQUE: apenas 1 instância de cada integração por tenant
  CONSTRAINT tenant_meta_integrations_unique UNIQUE (tenant_id, integration_id)
);

COMMENT ON TABLE public.tenant_meta_integrations IS 'Estado operacional de cada integração atômica Meta por tenant. Vinculada ao grant que fornece o token.';

-- Indexes
CREATE INDEX idx_tenant_meta_integrations_tenant ON public.tenant_meta_integrations(tenant_id);
CREATE INDEX idx_tenant_meta_integrations_grant ON public.tenant_meta_integrations(auth_grant_id);
CREATE INDEX idx_tenant_meta_integrations_status ON public.tenant_meta_integrations(tenant_id, status);

-- =============================================================
-- RLS — Todas as tabelas
-- =============================================================

-- meta_auth_profiles: leitura para authenticated, escrita para platform_admin
ALTER TABLE public.meta_auth_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read auth profiles"
  ON public.meta_auth_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform admin can manage auth profiles"
  ON public.meta_auth_profiles FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- meta_auth_profile_mappings: leitura para authenticated, escrita para platform_admin
ALTER TABLE public.meta_auth_profile_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read profile mappings"
  ON public.meta_auth_profile_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform admin can manage profile mappings"
  ON public.meta_auth_profile_mappings FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- tenant_meta_auth_grants: apenas membros do tenant
ALTER TABLE public.tenant_meta_auth_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their grants"
  ON public.tenant_meta_auth_grants FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can insert grants"
  ON public.tenant_meta_auth_grants FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can update their grants"
  ON public.tenant_meta_auth_grants FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- tenant_meta_integrations: apenas membros do tenant
ALTER TABLE public.tenant_meta_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their integrations"
  ON public.tenant_meta_integrations FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can insert integrations"
  ON public.tenant_meta_integrations FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can update their integrations"
  ON public.tenant_meta_integrations FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can delete their integrations"
  ON public.tenant_meta_integrations FOR DELETE
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- =============================================================
-- Triggers updated_at
-- =============================================================
CREATE TRIGGER update_meta_auth_profiles_updated_at
  BEFORE UPDATE ON public.meta_auth_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_meta_auth_grants_updated_at
  BEFORE UPDATE ON public.tenant_meta_auth_grants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_meta_integrations_updated_at
  BEFORE UPDATE ON public.tenant_meta_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- Função helper: descriptografar token (SECURITY DEFINER)
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_meta_grant_token(
  p_grant_id UUID,
  p_encryption_key TEXT
)
RETURNS TABLE(access_token TEXT, refresh_token TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN g.access_token_encrypted IS NOT NULL 
      THEN extensions.pgp_sym_decrypt(g.access_token_encrypted, p_encryption_key)
      ELSE NULL
    END,
    CASE WHEN g.refresh_token_encrypted IS NOT NULL
      THEN extensions.pgp_sym_decrypt(g.refresh_token_encrypted, p_encryption_key)
      ELSE NULL
    END
  FROM public.tenant_meta_auth_grants g
  WHERE g.id = p_grant_id
    AND g.status = 'active';
END;
$$;

-- =============================================================
-- Função helper: criptografar e salvar token
-- =============================================================
CREATE OR REPLACE FUNCTION public.save_meta_grant_token(
  p_grant_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_encryption_key TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  UPDATE public.tenant_meta_auth_grants
  SET
    access_token_encrypted = extensions.pgp_sym_encrypt(p_access_token, p_encryption_key),
    refresh_token_encrypted = CASE 
      WHEN p_refresh_token IS NOT NULL 
      THEN extensions.pgp_sym_encrypt(p_refresh_token, p_encryption_key)
      ELSE refresh_token_encrypted
    END,
    token_expires_at = COALESCE(p_expires_at, token_expires_at),
    updated_at = now()
  WHERE id = p_grant_id;
END;
$$;

-- =============================================================
-- Função helper: superseder grant antigo ao criar novo
-- =============================================================
CREATE OR REPLACE FUNCTION public.supersede_meta_grant(
  p_tenant_id UUID,
  p_auth_profile_key TEXT,
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
    superseded_by = p_new_grant_id
  WHERE tenant_id = p_tenant_id
    AND auth_profile_key = p_auth_profile_key
    AND status = 'active'
    AND id != p_new_grant_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Atualizar integrações que apontavam para grants supersedidos
  UPDATE public.tenant_meta_integrations
  SET auth_grant_id = p_new_grant_id, updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND auth_grant_id IN (
      SELECT id FROM public.tenant_meta_auth_grants
      WHERE tenant_id = p_tenant_id
        AND auth_profile_key = p_auth_profile_key
        AND status = 'superseded'
        AND superseded_by = p_new_grant_id
    );
  
  RETURN v_count;
END;
$$;
