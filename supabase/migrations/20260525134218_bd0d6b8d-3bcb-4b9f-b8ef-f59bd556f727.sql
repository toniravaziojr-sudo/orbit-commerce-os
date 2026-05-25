
-- =========================================================
-- FASE 1 — CFOP via Natureza de Operação (não-quebrante)
-- =========================================================

-- 1) Vínculo formal: nota fiscal -> natureza de operação
ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS natureza_operacao_id uuid
  REFERENCES public.fiscal_operation_natures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_natureza_operacao_id
  ON public.fiscal_invoices(natureza_operacao_id);

-- 2) Natureza padrão para vendas automáticas (por tenant)
ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS default_sales_nature_id uuid
  REFERENCES public.fiscal_operation_natures(id) ON DELETE SET NULL;

-- 3) Função de seed das 16 naturezas-sistema (idempotente)
CREATE OR REPLACE FUNCTION public.seed_system_operation_natures(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fiscal_operation_natures
    (tenant_id, nome, cfop_intra, cfop_inter, finalidade, tipo_documento, is_system, ativo)
  VALUES
    (p_tenant_id, 'Venda de Mercadoria',              '5102','6102', 1, 1, true, true),
    (p_tenant_id, 'Venda de Produção Própria',        '5101','6101', 1, 1, true, true),
    (p_tenant_id, 'Venda para Entrega Futura',        '5922','6922', 1, 1, true, true),
    (p_tenant_id, 'Transferência de Mercadoria',      '5152','6152', 1, 1, true, true),
    (p_tenant_id, 'Devolução de Venda',               '1202','2202', 4, 0, true, true),
    (p_tenant_id, 'Devolução de Compra',              '5202','6202', 4, 1, true, true),
    (p_tenant_id, 'Compra de Mercadoria',             '1102','2102', 1, 0, true, true),
    (p_tenant_id, 'Compra de Material de Uso/Consumo','1556','2556', 1, 0, true, true),
    (p_tenant_id, 'Remessa para Conserto',            '5915','6915', 1, 1, true, true),
    (p_tenant_id, 'Retorno de Conserto',              '5916','6916', 1, 0, true, true),
    (p_tenant_id, 'Remessa para Demonstração',        '5912','6912', 1, 1, true, true),
    (p_tenant_id, 'Retorno de Demonstração',          '1913','2913', 1, 0, true, true),
    (p_tenant_id, 'Remessa em Consignação',           '5917','6917', 1, 1, true, true),
    (p_tenant_id, 'Devolução de Consignação',         '5918','6918', 4, 1, true, true),
    (p_tenant_id, 'Remessa para Troca',               '5949','6949', 1, 1, true, true),
    (p_tenant_id, 'Bonificação',                      '5910','6910', 1, 1, true, true),
    (p_tenant_id, 'Amostra Grátis',                   '5911','6911', 1, 1, true, true),
    (p_tenant_id, 'Simples Remessa',                  '5949','6949', 1, 1, true, true)
  ON CONFLICT (tenant_id, nome) DO NOTHING;
END;
$$;

-- 4) Trigger: ao criar um tenant, semear as naturezas-sistema
CREATE OR REPLACE FUNCTION public.trg_seed_system_operation_natures()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_system_operation_natures(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_seed_system_natures ON public.tenants;
CREATE TRIGGER tenants_seed_system_natures
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_system_operation_natures();

-- 5) Backfill: garantir as 16 naturezas em todos os tenants existentes
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_system_operation_natures(t.id);
  END LOOP;
END;
$$;

-- 6) Pré-seleção da natureza padrão de vendas nas configurações já existentes
UPDATE public.fiscal_settings fs
SET default_sales_nature_id = fon.id
FROM public.fiscal_operation_natures fon
WHERE fs.default_sales_nature_id IS NULL
  AND fon.tenant_id = fs.tenant_id
  AND fon.is_system = true
  AND fon.nome = 'Venda de Mercadoria';
