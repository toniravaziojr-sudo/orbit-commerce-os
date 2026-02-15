
-- =============================================
-- FASE 1: Hub TikTok — tiktok_ads_connections
-- =============================================

-- 1. Criar tabela tiktok_ads_connections (1 por tenant)
CREATE TABLE public.tiktok_ads_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  connected_by UUID REFERENCES auth.users(id),
  
  -- TikTok user/advertiser info
  tiktok_user_id TEXT,
  advertiser_id TEXT,
  advertiser_name TEXT,
  
  -- Tokens
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Scope packs e escopos reais
  scope_packs TEXT[] DEFAULT '{}',
  granted_scopes TEXT[] DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'error', 'disconnected')),
  last_error TEXT,
  last_sync_at TIMESTAMPTZ,
  
  -- Assets descobertos (advertiser_ids, pixel_ids, etc.)
  assets JSONB DEFAULT '{}',
  
  -- Timestamps
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.tiktok_ads_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant tiktok ads connections"
  ON public.tiktok_ads_connections FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant tiktok ads connections"
  ON public.tiktok_ads_connections FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant tiktok ads connections"
  ON public.tiktok_ads_connections FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete own tenant tiktok ads connections"
  ON public.tiktok_ads_connections FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Service role bypass for edge functions
CREATE POLICY "Service role full access tiktok ads connections"
  ON public.tiktok_ads_connections FOR ALL
  USING (auth.role() = 'service_role');

-- 3. Trigger updated_at
CREATE TRIGGER update_tiktok_ads_connections_updated_at
  BEFORE UPDATE ON public.tiktok_ads_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Adicionar coluna 'product' à tabela tiktok_oauth_states
ALTER TABLE public.tiktok_oauth_states
  ADD COLUMN IF NOT EXISTS product TEXT DEFAULT 'ads';

-- 5. Migrar dados existentes de marketing_integrations para tiktok_ads_connections
INSERT INTO public.tiktok_ads_connections (
  tenant_id,
  access_token,
  refresh_token,
  token_expires_at,
  advertiser_id,
  advertiser_name,
  connected_by,
  connected_at,
  scope_packs,
  granted_scopes,
  is_active,
  connection_status,
  last_error,
  assets
)
SELECT
  mi.tenant_id,
  mi.tiktok_access_token,
  mi.tiktok_refresh_token,
  mi.tiktok_token_expires_at,
  mi.tiktok_advertiser_id,
  mi.tiktok_advertiser_name,
  mi.tiktok_connected_by,
  mi.tiktok_connected_at,
  ARRAY['pixel']::TEXT[],
  ARRAY['event.track.create', 'event.track.view', 'advertiser.data.readonly']::TEXT[],
  mi.tiktok_enabled,
  CASE 
    WHEN mi.tiktok_access_token IS NOT NULL AND mi.tiktok_enabled THEN 'connected'
    WHEN mi.tiktok_last_error IS NOT NULL THEN 'error'
    ELSE 'disconnected'
  END,
  mi.tiktok_last_error,
  jsonb_build_object(
    'advertiser_ids', CASE WHEN mi.tiktok_advertiser_id IS NOT NULL 
      THEN jsonb_build_array(mi.tiktok_advertiser_id) ELSE '[]'::jsonb END,
    'pixels', CASE WHEN mi.tiktok_pixel_id IS NOT NULL 
      THEN jsonb_build_array(mi.tiktok_pixel_id) ELSE '[]'::jsonb END
  )
FROM public.marketing_integrations mi
WHERE mi.tiktok_access_token IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;
