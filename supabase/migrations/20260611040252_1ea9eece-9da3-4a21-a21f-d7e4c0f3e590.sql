-- Fase A2 — Trava de produção também na escrita da nota fiscal
-- Complementa o gatilho existente fiscal_settings_force_producao (que trava a config)
-- garantindo que nenhuma nota (PV ou NF) seja gravada como 'homologacao' quando o
-- tenant está em produção. Cobre INSERT e UPDATE.

CREATE OR REPLACE FUNCTION public.fiscal_invoices_force_producao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_ambiente text;
BEGIN
  -- Lê o ambiente configurado para o tenant
  SELECT ambiente INTO v_tenant_ambiente
    FROM public.fiscal_settings
   WHERE tenant_id = NEW.tenant_id
   LIMIT 1;

  -- Se o tenant está em produção e a nota está vindo como homologação, corrige
  IF v_tenant_ambiente = 'producao'
     AND COALESCE(NEW.ambiente, '') <> 'producao' THEN
    NEW.ambiente := 'producao';
    -- Marca de auditoria não-destrutiva no campo observacoes (apenas registro)
    NEW.observacoes := COALESCE(NEW.observacoes, '') ||
      CASE WHEN COALESCE(NEW.observacoes, '') = '' THEN '' ELSE E'\n' END ||
      '[guard] ambiente normalizado para producao em ' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_invoices_force_producao ON public.fiscal_invoices;
CREATE TRIGGER trg_fiscal_invoices_force_producao
BEFORE INSERT OR UPDATE ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_invoices_force_producao();

COMMENT ON FUNCTION public.fiscal_invoices_force_producao() IS
'Trava de segurança: força ambiente=producao em qualquer gravação de nota fiscal quando o tenant está configurado em produção. Complementa fiscal_settings_force_producao (que protege a configuração). Memória: mem://constraints/fiscal-producao-universal.';
