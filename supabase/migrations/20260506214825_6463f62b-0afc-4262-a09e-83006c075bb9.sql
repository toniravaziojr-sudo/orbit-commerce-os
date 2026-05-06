CREATE OR REPLACE FUNCTION public.admin_tenant_economics(
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_slug TEXT,
  total_cost_usd NUMERIC,
  total_sell_usd NUMERIC,
  margin_usd NUMERIC,
  margin_pct NUMERIC,
  events_count BIGINT,
  by_category JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      cl.tenant_id,
      cl.category,
      cl.cost_usd,
      cl.sell_usd
    FROM public.credit_ledger cl
    WHERE cl.created_at >= p_start_date
      AND cl.created_at <  p_end_date
      AND cl.transaction_type = 'capture'
      AND cl.tenant_id IS NOT NULL
  ),
  agg AS (
    SELECT
      b.tenant_id,
      COALESCE(SUM(b.cost_usd), 0)::NUMERIC AS total_cost_usd,
      COALESCE(SUM(b.sell_usd), 0)::NUMERIC AS total_sell_usd,
      COUNT(*)::BIGINT AS events_count,
      COALESCE(jsonb_object_agg(
        b.category,
        jsonb_build_object(
          'cost_usd', SUM(b.cost_usd),
          'sell_usd', SUM(b.sell_usd),
          'count',    COUNT(*)
        )
      ) FILTER (WHERE b.category IS NOT NULL), '{}'::jsonb) AS by_category
    FROM base b
    GROUP BY b.tenant_id
  )
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    COALESCE(a.total_cost_usd, 0) AS total_cost_usd,
    COALESCE(a.total_sell_usd, 0) AS total_sell_usd,
    COALESCE(a.total_sell_usd - a.total_cost_usd, 0) AS margin_usd,
    CASE
      WHEN COALESCE(a.total_sell_usd, 0) > 0
        THEN ((a.total_sell_usd - a.total_cost_usd) / a.total_sell_usd) * 100
      ELSE 0
    END AS margin_pct,
    COALESCE(a.events_count, 0) AS events_count,
    COALESCE(a.by_category, '{}'::jsonb) AS by_category
  FROM public.tenants t
  LEFT JOIN agg a ON a.tenant_id = t.id
  WHERE t.id IN (SELECT tenant_id FROM agg)
     OR t.slug = 'respeite-o-homem'
  ORDER BY COALESCE(a.total_sell_usd, 0) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_tenant_economics(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_economics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;