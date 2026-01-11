-- =============================================================
-- Meta OAuth: Tabela de estados para anti-CSRF
-- =============================================================

-- Tabela para armazenar states temporários do OAuth (anti-CSRF)
CREATE TABLE IF NOT EXISTS public.meta_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  state_hash text NOT NULL UNIQUE,
  scope_packs text[] NOT NULL DEFAULT '{}',
  return_path text DEFAULT '/integrations',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_meta_oauth_states_hash ON public.meta_oauth_states(state_hash);
CREATE INDEX idx_meta_oauth_states_expires ON public.meta_oauth_states(expires_at);

-- RLS
ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;

-- Política: apenas service_role pode manipular (edge functions)
-- Usuários não precisam acessar diretamente
CREATE POLICY "Service role full access on meta_oauth_states"
ON public.meta_oauth_states
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Cleanup automático de states expirados (opcional, pode ser feito por cron job)
-- Para não acumular lixo, vamos criar uma função que limpa states antigos
CREATE OR REPLACE FUNCTION public.cleanup_expired_meta_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.meta_oauth_states
  WHERE expires_at < now() - interval '1 hour';
END;
$$;

-- =============================================================
-- Comentário: marketplace_connections já existe e suporta Meta
-- Basta inserir com marketplace='meta' e salvar os assets no metadata
-- =============================================================

-- Adicionar índice único para tenant_id + marketplace se não existir
-- (já existe baseado no upsert do meli-oauth-callback usando onConflict)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'marketplace_connections' 
    AND indexname = 'marketplace_connections_tenant_marketplace_unique'
  ) THEN
    CREATE UNIQUE INDEX marketplace_connections_tenant_marketplace_unique 
    ON public.marketplace_connections(tenant_id, marketplace);
  END IF;
END $$;