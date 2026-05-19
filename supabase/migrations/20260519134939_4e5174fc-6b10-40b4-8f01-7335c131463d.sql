-- Universalizar ambiente fiscal em PRODUÇÃO para todos os tenants
UPDATE public.fiscal_settings
SET ambiente = 'producao',
    focus_ambiente = 'producao',
    updated_at = now()
WHERE ambiente <> 'producao' OR focus_ambiente <> 'producao' OR ambiente IS NULL OR focus_ambiente IS NULL;

-- Default da coluna passa a ser 'producao' (novos tenants já entram em produção)
ALTER TABLE public.fiscal_settings
  ALTER COLUMN ambiente SET DEFAULT 'producao',
  ALTER COLUMN focus_ambiente SET DEFAULT 'producao';

-- Trigger de guarda: impede que qualquer fluxo grave 'homologacao' novamente
CREATE OR REPLACE FUNCTION public.fiscal_settings_force_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ambiente IS DISTINCT FROM 'producao' THEN
    NEW.ambiente := 'producao';
  END IF;
  IF NEW.focus_ambiente IS DISTINCT FROM 'producao' THEN
    NEW.focus_ambiente := 'producao';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_settings_force_producao ON public.fiscal_settings;
CREATE TRIGGER trg_fiscal_settings_force_producao
BEFORE INSERT OR UPDATE ON public.fiscal_settings
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_settings_force_producao();