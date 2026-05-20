
-- 1) Corrige registros existentes
UPDATE public.fiscal_settings
SET regime_tributario = CASE
  WHEN crt = 4 THEN 'mei'
  WHEN crt = 3 THEN 'lucro_presumido'
  ELSE 'simples_nacional'
END
WHERE regime_tributario IS DISTINCT FROM (
  CASE
    WHEN crt = 4 THEN 'mei'
    WHEN crt = 3 THEN 'lucro_presumido'
    ELSE 'simples_nacional'
  END
);

-- 2) Cria função de normalização
CREATE OR REPLACE FUNCTION public.fiscal_settings_sync_regime_from_crt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.regime_tributario := CASE
    WHEN NEW.crt = 4 THEN 'mei'
    WHEN NEW.crt = 3 THEN 'lucro_presumido'
    ELSE 'simples_nacional'
  END;
  RETURN NEW;
END;
$$;

-- 3) Trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_fiscal_settings_sync_regime ON public.fiscal_settings;
CREATE TRIGGER trg_fiscal_settings_sync_regime
BEFORE INSERT OR UPDATE OF crt ON public.fiscal_settings
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_settings_sync_regime_from_crt();
