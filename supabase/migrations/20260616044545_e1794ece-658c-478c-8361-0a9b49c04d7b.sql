-- H.4.0: campos de prontidão para geração de criativos

-- 1) tenant_brand_context: promessa, claims permitidas, compliance e confirmação
ALTER TABLE public.tenant_brand_context
  ADD COLUMN IF NOT EXISTS approved_main_promise TEXT,
  ADD COLUMN IF NOT EXISTS allowed_claims TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compliance_notes TEXT,
  ADD COLUMN IF NOT EXISTS no_additional_restrictions_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.tenant_brand_context.approved_main_promise IS 'H.4.0 — Promessa principal aprovada pelo lojista. Bloqueador de creative_readiness se vazio.';
COMMENT ON COLUMN public.tenant_brand_context.allowed_claims IS 'H.4.0 — Lista de claims permitidas (fonte de verdade). Bloqueador se vazio.';
COMMENT ON COLUMN public.tenant_brand_context.compliance_notes IS 'H.4.0 — Observações comerciais/compliance livres.';
COMMENT ON COLUMN public.tenant_brand_context.no_additional_restrictions_confirmed IS 'H.4.0 — Lojista confirmou explicitamente que não há restrições adicionais (libera categorias não sensíveis quando banned_claims/do_not_do estão vazias).';

-- 2) products: categoria regulatória e restrições por produto
DO $$ BEGIN
  CREATE TYPE public.product_regulatory_category AS ENUM ('cosmetic_hair','supplement','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS regulatory_category public.product_regulatory_category,
  ADD COLUMN IF NOT EXISTS commercial_restrictions TEXT,
  ADD COLUMN IF NOT EXISTS no_additional_restrictions_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.products.regulatory_category IS 'H.4.0 — Categoria regulatória/comercial do produto. Bloqueador de creative_readiness se nulo.';
COMMENT ON COLUMN public.products.commercial_restrictions IS 'H.4.0 — Restrições comerciais/legais declaradas pelo lojista (texto livre).';
COMMENT ON COLUMN public.products.no_additional_restrictions_confirmed IS 'H.4.0 — Lojista confirmou explicitamente que não há restrições adicionais para este produto.';