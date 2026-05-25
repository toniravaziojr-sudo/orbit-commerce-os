
-- =========================================================
-- Fase 1 — Naturezas sensíveis ao Regime Tributário (CRT)
-- =========================================================
-- regimes_compativeis: lista de CRTs aceitos (1=Simples, 2=Simples Excesso, 3=Normal Presumido/Real, 4=MEI)
-- crt_overrides: JSON { "1": {...}, "4": {...} } com {cfop_intra, cfop_inter, csosn, cst_icms} por CRT
-- Quando não houver override para um CRT, usa o valor base da natureza.

ALTER TABLE public.fiscal_operation_natures
  ADD COLUMN IF NOT EXISTS regimes_compativeis integer[] NOT NULL DEFAULT ARRAY[1,2,3,4]::integer[],
  ADD COLUMN IF NOT EXISTS crt_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_fiscal_natures_regimes
  ON public.fiscal_operation_natures USING gin (regimes_compativeis);

-- ---------------------------------------------------------
-- Atualiza seed do sistema (idempotente)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_system_operation_natures(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.fiscal_operation_natures
    (tenant_id, nome, cfop_intra, cfop_inter, finalidade, tipo_documento,
     csosn_padrao, cst_icms, regimes_compativeis, crt_overrides, is_system, ativo)
  VALUES
    (p_tenant_id, 'Venda de Mercadoria',              '5102','6102', 1, 1, '102','00', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"00"},"4":{"csosn":"102","cst_icms":null}}'::jsonb, true, true),
    (p_tenant_id, 'Venda de Produção Própria',        '5101','6101', 1, 1, '102','00', ARRAY[1,2,3],
       '{"3":{"csosn":null,"cst_icms":"00"}}'::jsonb, true, true),
    (p_tenant_id, 'Venda para Entrega Futura',        '5922','6922', 1, 1, '102','00', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"00"},"4":{"csosn":"102"}}'::jsonb, true, true),
    (p_tenant_id, 'Transferência de Mercadoria',      '5152','6152', 1, 1, '400','00', ARRAY[1,2,3],
       '{"3":{"csosn":null,"cst_icms":"00"}}'::jsonb, true, true),
    (p_tenant_id, 'Devolução de Venda',               '1202','2202', 4, 0, '900','00', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"00"}}'::jsonb, true, true),
    (p_tenant_id, 'Devolução de Compra',              '5202','6202', 4, 1, '900','00', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"00"}}'::jsonb, true, true),
    (p_tenant_id, 'Compra de Mercadoria',             '1102','2102', 1, 0, '102','00', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"00"}}'::jsonb, true, true),
    (p_tenant_id, 'Compra de Material de Uso/Consumo','1556','2556', 1, 0, '400','90', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"90"}}'::jsonb, true, true),
    (p_tenant_id, 'Remessa para Conserto',            '5915','6915', 1, 1, '400','41', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"41"},"4":{"csosn":"900"}}'::jsonb, true, true),
    (p_tenant_id, 'Retorno de Conserto',              '5916','6916', 1, 0, '400','41', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"41"},"4":{"csosn":"900"}}'::jsonb, true, true),
    (p_tenant_id, 'Remessa para Demonstração',        '5912','6912', 1, 1, '400','41', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"41"},"4":{"csosn":"900"}}'::jsonb, true, true),
    (p_tenant_id, 'Retorno de Demonstração',          '1913','2913', 1, 0, '400','41', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"41"},"4":{"csosn":"900"}}'::jsonb, true, true),
    (p_tenant_id, 'Remessa em Consignação',           '5917','6917', 1, 1, '400','41', ARRAY[1,2,3],
       '{"3":{"csosn":null,"cst_icms":"41"}}'::jsonb, true, true),
    (p_tenant_id, 'Devolução de Consignação',         '5918','6918', 4, 1, '400','41', ARRAY[1,2,3],
       '{"3":{"csosn":null,"cst_icms":"41"}}'::jsonb, true, true),
    (p_tenant_id, 'Remessa para Troca',               '5949','6949', 1, 1, '400','41', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"41"},"4":{"csosn":"900"}}'::jsonb, true, true),
    (p_tenant_id, 'Bonificação',                      '5910','6910', 1, 1, '400','40', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"40"},"4":{"csosn":"900"}}'::jsonb, true, true),
    (p_tenant_id, 'Amostra Grátis',                   '5911','6911', 1, 1, '400','41', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"41"},"4":{"csosn":"900"}}'::jsonb, true, true),
    (p_tenant_id, 'Simples Remessa',                  '5949','6949', 1, 1, '400','41', ARRAY[1,2,3,4],
       '{"3":{"csosn":null,"cst_icms":"41"},"4":{"csosn":"900"}}'::jsonb, true, true)
  ON CONFLICT (tenant_id, nome) DO UPDATE SET
     cfop_intra = EXCLUDED.cfop_intra,
     cfop_inter = EXCLUDED.cfop_inter,
     finalidade = EXCLUDED.finalidade,
     tipo_documento = EXCLUDED.tipo_documento,
     csosn_padrao = COALESCE(public.fiscal_operation_natures.csosn_padrao, EXCLUDED.csosn_padrao),
     cst_icms = COALESCE(public.fiscal_operation_natures.cst_icms, EXCLUDED.cst_icms),
     regimes_compativeis = EXCLUDED.regimes_compativeis,
     crt_overrides = EXCLUDED.crt_overrides,
     updated_at = now();
END;
$function$;

-- ---------------------------------------------------------
-- Backfill: re-aplica seed em todos os tenants existentes
-- ---------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_system_operation_natures(r.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------
-- Resolver SQL: devolve o par CFOP/CSOSN/CST por CRT do emitente
-- (usado por views/RPCs futuras; o motor TS faz o mesmo merge no resolver)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_nature_for_crt(
  p_nature_id uuid,
  p_crt integer
)
RETURNS TABLE (
  id uuid,
  nome text,
  cfop_intra text,
  cfop_inter text,
  csosn text,
  cst_icms text,
  finalidade integer,
  tipo_documento integer,
  compativel boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.nome,
    COALESCE(n.crt_overrides->p_crt::text->>'cfop_intra', n.cfop_intra) AS cfop_intra,
    COALESCE(n.crt_overrides->p_crt::text->>'cfop_inter', n.cfop_inter) AS cfop_inter,
    CASE WHEN p_crt = 3 THEN NULL
         ELSE COALESCE(n.crt_overrides->p_crt::text->>'csosn', n.csosn_padrao)
    END AS csosn,
    CASE WHEN p_crt = 3
         THEN COALESCE(n.crt_overrides->p_crt::text->>'cst_icms', n.cst_icms)
         ELSE NULL
    END AS cst_icms,
    n.finalidade,
    n.tipo_documento,
    (p_crt = ANY(n.regimes_compativeis)) AS compativel
  FROM public.fiscal_operation_natures n
  WHERE n.id = p_nature_id;
$$;
