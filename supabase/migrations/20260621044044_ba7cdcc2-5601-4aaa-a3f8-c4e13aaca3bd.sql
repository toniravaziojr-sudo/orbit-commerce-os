
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_regulatory_regime_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_regulatory_regime_check
  CHECK (regulatory_regime IS NULL OR regulatory_regime IN (
    'none','anvisa_cosmetic','anvisa_health','anvisa_supplement','anvisa_medicine',
    'inmetro','anatel','mapa','denatran','exercito','ibama','iss_servico','outros'
  ));
