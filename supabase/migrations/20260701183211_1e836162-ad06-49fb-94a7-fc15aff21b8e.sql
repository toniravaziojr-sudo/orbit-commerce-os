
ALTER TABLE public.marketplace_connections
  ADD COLUMN IF NOT EXISTS consecutive_failures int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'healthy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_connections_health_status_check'
  ) THEN
    ALTER TABLE public.marketplace_connections
      ADD CONSTRAINT marketplace_connections_health_status_check
      CHECK (health_status IN ('healthy','degraded','needs_reauth'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mc_health_retry
  ON public.marketplace_connections (marketplace, health_status, next_retry_at);

COMMENT ON COLUMN public.marketplace_connections.health_status IS
  'healthy = ok; degraded = falha transitória com backoff; needs_reauth = lojista precisa reconectar. Regra: padroes-operacionais.md secao 8.';
