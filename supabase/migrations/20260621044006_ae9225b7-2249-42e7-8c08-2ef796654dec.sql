
-- Etapa 3 (parte 1): novos campos do cadastro universal de produto
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS universal_category_id UUID REFERENCES public.system_universal_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regulatory_regime TEXT,
  ADD COLUMN IF NOT EXISTS net_content_value NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS net_content_unit TEXT,
  ADD COLUMN IF NOT EXISTS gender_audience TEXT;

-- Restringe valores por CHECK (mais flexível que enum para evolução)
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_regulatory_regime_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_regulatory_regime_check
  CHECK (regulatory_regime IS NULL OR regulatory_regime IN (
    'none','anvisa_cosmetic','anvisa_supplement','anvisa_medicine','anvisa_health_product',
    'inmetro','anatel','mapa','denatran','exercito','ibama','iss_servico','outros'
  ));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_net_content_unit_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_net_content_unit_check
  CHECK (net_content_unit IS NULL OR net_content_unit IN ('ml','l','g','kg','un','m','cm','m2','m3'));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_gender_audience_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_gender_audience_check
  CHECK (gender_audience IS NULL OR gender_audience IN ('masculino','feminino','unissex','infantil','nao_aplicavel'));

CREATE INDEX IF NOT EXISTS idx_products_universal_category ON public.products(universal_category_id) WHERE universal_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_regulatory_regime ON public.products(regulatory_regime) WHERE regulatory_regime IS NOT NULL;
