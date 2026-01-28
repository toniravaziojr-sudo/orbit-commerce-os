-- ======================================
-- TikTok OAuth Integration Tables
-- ======================================

-- Tabela para estados OAuth temporários (anti-CSRF)
CREATE TABLE IF NOT EXISTS public.tiktok_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  state_hash TEXT NOT NULL UNIQUE,
  return_path TEXT DEFAULT '/marketing',
  scope_packs TEXT[] DEFAULT ARRAY['marketing'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  used_at TIMESTAMPTZ
);

-- Índice para limpeza de estados expirados
CREATE INDEX IF NOT EXISTS idx_tiktok_oauth_states_expires 
  ON public.tiktok_oauth_states(expires_at);

-- RLS
ALTER TABLE public.tiktok_oauth_states ENABLE ROW LEVEL SECURITY;

-- Apenas service role pode manipular (Edge Functions)
CREATE POLICY "tiktok_oauth_states_service_only" 
  ON public.tiktok_oauth_states 
  FOR ALL 
  USING (false) 
  WITH CHECK (false);

-- Adicionar colunas de conexão TikTok na marketing_integrations (se não existirem)
DO $$ 
BEGIN
  -- TikTok OAuth credentials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_integrations' AND column_name = 'tiktok_access_token') THEN
    ALTER TABLE public.marketing_integrations ADD COLUMN tiktok_access_token TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_integrations' AND column_name = 'tiktok_refresh_token') THEN
    ALTER TABLE public.marketing_integrations ADD COLUMN tiktok_refresh_token TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_integrations' AND column_name = 'tiktok_token_expires_at') THEN
    ALTER TABLE public.marketing_integrations ADD COLUMN tiktok_token_expires_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_integrations' AND column_name = 'tiktok_advertiser_id') THEN
    ALTER TABLE public.marketing_integrations ADD COLUMN tiktok_advertiser_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_integrations' AND column_name = 'tiktok_advertiser_name') THEN
    ALTER TABLE public.marketing_integrations ADD COLUMN tiktok_advertiser_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_integrations' AND column_name = 'tiktok_connected_at') THEN
    ALTER TABLE public.marketing_integrations ADD COLUMN tiktok_connected_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_integrations' AND column_name = 'tiktok_connected_by') THEN
    ALTER TABLE public.marketing_integrations ADD COLUMN tiktok_connected_by UUID;
  END IF;
END $$;

-- Função para limpar estados OAuth expirados do TikTok
CREATE OR REPLACE FUNCTION public.cleanup_expired_tiktok_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tiktok_oauth_states
  WHERE expires_at < now() - interval '1 hour';
END;
$$;