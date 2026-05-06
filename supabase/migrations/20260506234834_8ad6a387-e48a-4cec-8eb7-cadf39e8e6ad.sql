-- 1) Tabela de custo mensal de infra por tenant
CREATE TABLE IF NOT EXISTS public.tenant_infra_monthly_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  cost_brl NUMERIC(10,2) NOT NULL CHECK (cost_brl >= 0),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','estimated','imported')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference_month)
);

-- Validação: reference_month sempre dia 1
CREATE OR REPLACE FUNCTION public.tenant_infra_monthly_costs_validate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF EXTRACT(DAY FROM NEW.reference_month) <> 1 THEN
    RAISE EXCEPTION 'reference_month must be the first day of the month (got %)', NEW.reference_month;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_infra_monthly_costs_validate ON public.tenant_infra_monthly_costs;
CREATE TRIGGER trg_tenant_infra_monthly_costs_validate
  BEFORE INSERT OR UPDATE ON public.tenant_infra_monthly_costs
  FOR EACH ROW EXECUTE FUNCTION public.tenant_infra_monthly_costs_validate();

CREATE INDEX IF NOT EXISTS idx_tenant_infra_monthly_costs_tenant_month
  ON public.tenant_infra_monthly_costs (tenant_id, reference_month);

ALTER TABLE public.tenant_infra_monthly_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_select_infra_costs" ON public.tenant_infra_monthly_costs
  FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY "platform_admin_insert_infra_costs" ON public.tenant_infra_monthly_costs
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());
CREATE POLICY "platform_admin_update_infra_costs" ON public.tenant_infra_monthly_costs
  FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "platform_admin_delete_infra_costs" ON public.tenant_infra_monthly_costs
  FOR DELETE TO authenticated USING (public.is_platform_admin());

COMMENT ON TABLE public.tenant_infra_monthly_costs IS
  'Custo mensal de infra Lovable (Cloud + AI) absorvido por tenant. Editado manualmente por platform_admin. Versão por mês de referência. Não substitui platform_cost_ledger (custos por chamada absorvidos pela plataforma).';

-- 2) Estende admin_tenant_economics: drop e recria (mudança de RETURNS TABLE)
DROP FUNCTION IF EXISTS public.admin_tenant_economics(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.admin_tenant_economics(
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date   TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  tenant_id        UUID,
  tenant_name      TEXT,
  tenant_slug      TEXT,
  total_cost_usd   NUMERIC,
  total_sell_usd   NUMERIC,
  margin_usd       NUMERIC,
  margin_pct       NUMERIC,
  events_count     BIGINT,
  by_category      JSONB,
  infra_cost_brl   NUMERIC,
  net_margin_brl   NUMERIC,
  net_margin_pct   NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fx NUMERIC := 5.5; -- snapshot display, alinhado a TenantEconomicsTab/D5
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT cl.tenant_id, cl.category, cl.cost_usd, cl.sell_usd
    FROM public.credit_ledger cl
    WHERE cl.created_at >= p_start_date
      AND cl.created_at <  p_end_date
      AND cl.transaction_type = 'capture'
      AND cl.tenant_id IS NOT NULL
  ),
  agg AS (
    SELECT
      b.tenant_id,
      COALESCE(SUM(b.cost_usd),0)::NUMERIC AS total_cost_usd,
      COALESCE(SUM(b.sell_usd),0)::NUMERIC AS total_sell_usd,
      COUNT(*)::BIGINT AS events_count,
      COALESCE(jsonb_object_agg(b.category, jsonb_build_object(
        'cost_usd', SUM(b.cost_usd),
        'sell_usd', SUM(b.sell_usd),
        'count', COUNT(*)
      )) FILTER (WHERE b.category IS NOT NULL), '{}'::jsonb) AS by_category
    FROM base b GROUP BY b.tenant_id
  ),
  -- Custo de infra proporcional: para cada mês tocado pelo período, usa (dias do período naquele mês / dias do mês) * cost_brl
  infra AS (
    SELECT
      tic.tenant_id,
      COALESCE(SUM(
        tic.cost_brl
        * GREATEST(0, LEAST(
            EXTRACT(EPOCH FROM (
              LEAST(p_end_date, (tic.reference_month + INTERVAL '1 month')::timestamptz)
              - GREATEST(p_start_date, tic.reference_month::timestamptz)
            )),
            EXTRACT(EPOCH FROM (INTERVAL '1 month'))
          )) / EXTRACT(EPOCH FROM ((tic.reference_month + INTERVAL '1 month')::timestamptz - tic.reference_month::timestamptz))
      ), 0)::NUMERIC AS infra_cost_brl
    FROM public.tenant_infra_monthly_costs tic
    WHERE tic.reference_month <  p_end_date::date
      AND (tic.reference_month + INTERVAL '1 month') > p_start_date
    GROUP BY tic.tenant_id
  )
  SELECT
    t.id, t.name, t.slug,
    COALESCE(a.total_cost_usd, 0),
    COALESCE(a.total_sell_usd, 0),
    COALESCE(a.total_sell_usd - a.total_cost_usd, 0),
    CASE WHEN COALESCE(a.total_sell_usd,0) > 0
      THEN ((a.total_sell_usd - a.total_cost_usd) / a.total_sell_usd) * 100
      ELSE 0 END,
    COALESCE(a.events_count, 0),
    COALESCE(a.by_category, '{}'::jsonb),
    ROUND(COALESCE(i.infra_cost_brl, 0), 2) AS infra_cost_brl,
    ROUND(COALESCE(a.total_sell_usd - a.total_cost_usd, 0) * v_fx - COALESCE(i.infra_cost_brl, 0), 2) AS net_margin_brl,
    CASE WHEN COALESCE(a.total_sell_usd,0) * v_fx > 0
      THEN ROUND((((a.total_sell_usd - a.total_cost_usd) * v_fx - COALESCE(i.infra_cost_brl,0)) / (a.total_sell_usd * v_fx)) * 100, 2)
      ELSE 0 END
  FROM public.tenants t
  LEFT JOIN agg a   ON a.tenant_id = t.id
  LEFT JOIN infra i ON i.tenant_id = t.id
  WHERE t.id IN (SELECT a2.tenant_id FROM agg a2)
     OR t.id IN (SELECT i2.tenant_id FROM infra i2)
     OR t.slug = 'respeite-o-homem'
  ORDER BY COALESCE(a.total_sell_usd, 0) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_tenant_economics(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_economics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- 3) Seed do Respeite o Homem para o mês corrente
INSERT INTO public.tenant_infra_monthly_costs (tenant_id, reference_month, cost_brl, source, notes)
VALUES (
  'd1a4d0ed-8842-495e-b741-540a9a345b25',
  date_trunc('month', now())::date,
  200.00,
  'estimated',
  'Baseline inicial 30d: 305 turnos IA + 198 pedidos + ~3k msgs WhatsApp + storefront. Editar manualmente.'
)
ON CONFLICT (tenant_id, reference_month) DO NOTHING;