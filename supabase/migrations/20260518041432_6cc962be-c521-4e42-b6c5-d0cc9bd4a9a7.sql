CREATE TABLE IF NOT EXISTS public.cep_cache (
  cep text PRIMARY KEY,
  logradouro text,
  bairro text,
  cidade text,
  uf text,
  ibge text,
  fonte text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cep_cache_fetched_at ON public.cep_cache (fetched_at);

ALTER TABLE public.cep_cache ENABLE ROW LEVEL SECURITY;

-- CEP é dado público, mas bloqueamos anon/authenticated; uso é via service_role nas edge functions
CREATE POLICY "cep_cache_service_only_select" ON public.cep_cache FOR SELECT TO authenticated USING (false);
CREATE POLICY "cep_cache_service_only_insert" ON public.cep_cache FOR INSERT TO authenticated WITH CHECK (false);
