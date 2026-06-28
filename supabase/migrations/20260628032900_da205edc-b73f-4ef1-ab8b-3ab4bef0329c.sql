
-- ============================================================
-- Onda B: Espelho da Ficha Técnica + Coverage Report
-- ============================================================

-- 1) Espelho da ficha técnica da categoria (multi-marketplace)
CREATE TABLE IF NOT EXISTS public.marketplace_category_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace text NOT NULL,            -- 'mercado_livre' | 'shopee' | 'tiktok_shop' ...
  category_id text NOT NULL,            -- ID nativo do marketplace (ex: MLB1234)
  category_name text,
  category_path_text text,
  attributes jsonb NOT NULL DEFAULT '[]'::jsonb,   -- ficha bruta normalizada (id, name, tags, value_type, values[])
  raw_payload jsonb,                                -- payload original do marketplace (debug/auditoria)
  source_version text,                              -- versão/etag retornado, quando houver
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (marketplace, category_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_category_specs_lookup
  ON public.marketplace_category_specs (marketplace, category_id);
CREATE INDEX IF NOT EXISTS idx_mp_category_specs_expires
  ON public.marketplace_category_specs (expires_at);

GRANT SELECT ON public.marketplace_category_specs TO authenticated;
GRANT ALL ON public.marketplace_category_specs TO service_role;

ALTER TABLE public.marketplace_category_specs ENABLE ROW LEVEL SECURITY;

-- Catálogo global (compartilhado por todos os tenants). Leitura para autenticados, escrita só service_role.
CREATE POLICY "Authenticated can read category specs"
  ON public.marketplace_category_specs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages category specs"
  ON public.marketplace_category_specs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2) Coverage report + versão do adaptador em meli_listings
ALTER TABLE public.meli_listings
  ADD COLUMN IF NOT EXISTS coverage_report jsonb,
  ADD COLUMN IF NOT EXISTS adapter_version text;

COMMENT ON COLUMN public.meli_listings.coverage_report IS
  'Onda B: relatório do adaptador — required_total, required_filled, optional_filled, na_filled, missing[], sources{cadastro,memory,dictionary,ai,fallback}';
COMMENT ON COLUMN public.meli_listings.adapter_version IS
  'Onda B: versão do marketplace-adapter que gerou o payload (ex: meli@v3.0.0)';

-- 3) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_mp_category_specs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mp_category_specs_updated_at ON public.marketplace_category_specs;
CREATE TRIGGER trg_mp_category_specs_updated_at
  BEFORE UPDATE ON public.marketplace_category_specs
  FOR EACH ROW EXECUTE FUNCTION public.tg_mp_category_specs_updated_at();
