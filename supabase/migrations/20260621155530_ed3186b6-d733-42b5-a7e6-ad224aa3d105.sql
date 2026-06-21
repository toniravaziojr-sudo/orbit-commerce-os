-- Etapa 5.5: Atributos cosméticos no cadastro de produto
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS dermatologically_tested TEXT,
  ADD COLUMN IF NOT EXISTS hypoallergenic TEXT,
  ADD COLUMN IF NOT EXISTS cruelty_free TEXT,
  ADD COLUMN IF NOT EXISTS vegan TEXT,
  ADD COLUMN IF NOT EXISTS has_fragrance TEXT,
  ADD COLUMN IF NOT EXISTS fragrance_name TEXT,
  ADD COLUMN IF NOT EXISTS recommended_hair_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS treatment_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS expected_effects TEXT;

-- Restrições tri-state (Sim / Não / N/A)
DO $$
DECLARE
  col TEXT;
BEGIN
  FOR col IN SELECT unnest(ARRAY['dermatologically_tested','hypoallergenic','cruelty_free','vegan','has_fragrance'])
  LOOP
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_%s_check', col);
    EXECUTE format($f$ALTER TABLE public.products ADD CONSTRAINT products_%s_check
      CHECK (%I IS NULL OR %I IN ('yes','no','not_applicable'))$f$, col, col, col);
  END LOOP;
END $$;