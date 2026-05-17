
-- 1) fiscal_settings: regime tributário + alíquotas padrão
ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS regime_tributario text NOT NULL DEFAULT 'simples_nacional'
    CHECK (regime_tributario IN ('simples_nacional','lucro_presumido','lucro_real')),
  ADD COLUMN IF NOT EXISTS pis_aliquota_padrao numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cofins_aliquota_padrao numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icms_aliquota_padrao numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pis_cst_padrao text NOT NULL DEFAULT '49',
  ADD COLUMN IF NOT EXISTS cofins_cst_padrao text NOT NULL DEFAULT '49';

-- Sincroniza regime_tributario com crt nos registros existentes
UPDATE public.fiscal_settings
   SET regime_tributario = CASE
     WHEN crt IN (1,2) THEN 'simples_nacional'
     WHEN crt = 3 THEN COALESCE(NULLIF(regime_tributario,''),'lucro_presumido')
     ELSE regime_tributario
   END;

-- 2) fiscal_products: overrides opcionais de tributos por produto
ALTER TABLE public.fiscal_products
  ADD COLUMN IF NOT EXISTS pis_aliquota numeric(7,4),
  ADD COLUMN IF NOT EXISTS cofins_aliquota numeric(7,4),
  ADD COLUMN IF NOT EXISTS icms_aliquota numeric(7,4),
  ADD COLUMN IF NOT EXISTS pis_cst text,
  ADD COLUMN IF NOT EXISTS cofins_cst text;
