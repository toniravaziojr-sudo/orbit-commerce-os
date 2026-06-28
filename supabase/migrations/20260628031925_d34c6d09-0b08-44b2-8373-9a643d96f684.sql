
ALTER TABLE public.meli_listings
  ADD COLUMN IF NOT EXISTS health_score integer,
  ADD COLUMN IF NOT EXISTS health_actions jsonb,
  ADD COLUMN IF NOT EXISTS health_checked_at timestamptz;

COMMENT ON COLUMN public.meli_listings.health_score IS
  'Nota oficial de qualidade do anúncio retornada pelo Mercado Livre (0-100). Coletada após publish/update e via meli-health-sync.';
COMMENT ON COLUMN public.meli_listings.health_actions IS
  'Lista de ações pendentes que o Mercado Livre indicou para melhorar o anúncio (campo health/actions da API ML).';
COMMENT ON COLUMN public.meli_listings.health_checked_at IS
  'Timestamp da última coleta de saúde do anúncio junto ao Mercado Livre.';

CREATE INDEX IF NOT EXISTS idx_meli_listings_health_score
  ON public.meli_listings (tenant_id, health_score)
  WHERE health_score IS NOT NULL;
