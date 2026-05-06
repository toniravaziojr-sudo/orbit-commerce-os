
CREATE OR REPLACE FUNCTION public.get_credit_history(
  p_tenant_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_transaction_type text DEFAULT NULL,
  p_operation_status text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_service_key text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_job_id uuid DEFAULT NULL,
  p_include_platform boolean DEFAULT false,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  event_id uuid,
  ledger_id uuid,
  tenant_id uuid,
  created_at timestamptz,
  transaction_type text,
  operation_status text,
  category text,
  service_key_public text,
  service_key text,
  provider text,
  feature text,
  credits_delta integer,
  balance_before integer,
  balance_after integer,
  description text,
  job_id uuid,
  creative_job_id uuid,
  creative_product_name text,
  source_function text,
  cost_usd numeric,
  sell_usd numeric,
  markup_pct_snap numeric,
  cost_brl numeric,
  sell_brl numeric,
  fx_rate_usd_brl numeric,
  metadata_public jsonb,
  metadata_admin jsonb,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.is_platform_admin_by_auth();
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_include_platform boolean := COALESCE(p_include_platform, false);
BEGIN
  -- Tenant Identity Guard
  IF NOT v_is_admin THEN
    IF p_tenant_id IS NULL OR NOT public.user_has_tenant_access(p_tenant_id) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    v_include_platform := false;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      cl.id              AS ledger_id,
      cl.tenant_id       AS tenant_id,
      cl.created_at      AS created_at,
      cl.transaction_type,
      cl.operation_status,
      cl.category,
      cl.service_key,
      cl.provider        AS ledger_provider,
      cl.feature,
      cl.credits_delta,
      cl.balance_before,
      cl.balance_after,
      cl.description,
      cl.job_id,
      cl.cost_usd,
      cl.sell_usd,
      cl.markup_pct_snap,
      cl.cost_brl,
      cl.sell_brl,
      cl.fx_rate_usd_brl,
      cl.metadata
    FROM public.credit_ledger cl
    WHERE cl.tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR cl.created_at >= p_start_date)
      AND (p_end_date   IS NULL OR cl.created_at <= p_end_date)
      AND (p_transaction_type IS NULL OR cl.transaction_type = p_transaction_type)
      AND (p_operation_status IS NULL OR cl.operation_status = p_operation_status)
      AND (p_category   IS NULL OR cl.category = p_category)
      AND (p_service_key IS NULL OR cl.service_key = p_service_key)
      AND (p_provider   IS NULL OR cl.provider = p_provider)
      AND (p_job_id     IS NULL OR cl.job_id = p_job_id)
  ),
  enriched AS (
    SELECT
      b.*,
      sue.id                AS sue_id,
      sue.cost_owner        AS sue_cost_owner,
      sue.status            AS sue_status,
      sue.provider          AS sue_provider,
      sue.service_key       AS sue_service_key,
      sue.origin_function   AS sue_origin_function,
      sue.metadata          AS sue_metadata,
      cj.id                 AS creative_job_id,
      cj.product_name       AS creative_product_name
    FROM base b
    LEFT JOIN LATERAL (
      SELECT s.*
      FROM public.service_usage_events s
      WHERE s.tenant_id = b.tenant_id
        AND (
          s.credit_ledger_id      = b.ledger_id
          OR s.reservation_ledger_id = b.ledger_id
          OR (s.metadata ->> 'capture_ledger_id')::uuid = b.ledger_id
        )
      ORDER BY
        (CASE WHEN s.credit_ledger_id      = b.ledger_id THEN 1
              WHEN s.reservation_ledger_id = b.ledger_id THEN 2
              WHEN (s.metadata ->> 'capture_ledger_id')::uuid = b.ledger_id THEN 3
              ELSE 9 END),
        s.created_at DESC
      LIMIT 1
    ) sue ON TRUE
    LEFT JOIN public.creative_jobs cj
      ON cj.id = b.job_id AND cj.tenant_id = b.tenant_id
  ),
  filtered AS (
    SELECT * FROM enriched e
    WHERE
      -- Não-admin: nunca ver eventos shadow ou de cost_owner='platform'
      (
        v_is_admin
        OR (
          (e.sue_status IS NULL OR e.sue_status <> 'shadow')
          AND (e.sue_cost_owner IS NULL OR e.sue_cost_owner = 'tenant')
        )
      )
      -- Admin com include_platform=false: oculta eventos puramente platform
      AND (
        v_is_admin = false
        OR v_include_platform = true
        OR (e.sue_cost_owner IS NULL OR e.sue_cost_owner = 'tenant')
      )
  ),
  counted AS (
    SELECT f.*, count(*) OVER () AS total_count
    FROM filtered f
  )
  SELECT
    c.sue_id                                                AS event_id,
    c.ledger_id                                             AS ledger_id,
    c.tenant_id                                             AS tenant_id,
    c.created_at                                            AS created_at,
    c.transaction_type                                      AS transaction_type,
    c.operation_status                                      AS operation_status,
    c.category                                              AS category,
    -- service_key_public: categoria amigável (sempre); se admin, devolve service_key cru aqui também
    COALESCE(c.category, split_part(c.service_key, '.', 1)) AS service_key_public,
    CASE WHEN v_is_admin THEN COALESCE(c.service_key, c.sue_service_key) ELSE NULL END AS service_key,
    CASE WHEN v_is_admin THEN COALESCE(c.ledger_provider, c.sue_provider, split_part(c.service_key, '.', 1)) ELSE NULL END AS provider,
    c.feature                                               AS feature,
    c.credits_delta                                         AS credits_delta,
    c.balance_before                                        AS balance_before,
    c.balance_after                                         AS balance_after,
    c.description                                           AS description,
    c.job_id                                                AS job_id,
    c.creative_job_id                                       AS creative_job_id,
    c.creative_product_name                                 AS creative_product_name,
    CASE WHEN v_is_admin THEN c.sue_origin_function ELSE NULL END AS source_function,
    CASE WHEN v_is_admin THEN c.cost_usd ELSE NULL END      AS cost_usd,
    CASE WHEN v_is_admin THEN c.sell_usd ELSE NULL END      AS sell_usd,
    CASE WHEN v_is_admin THEN c.markup_pct_snap ELSE NULL END AS markup_pct_snap,
    CASE WHEN v_is_admin THEN c.cost_brl ELSE NULL END      AS cost_brl,
    CASE WHEN v_is_admin THEN c.sell_brl ELSE NULL END      AS sell_brl,
    CASE WHEN v_is_admin THEN c.fx_rate_usd_brl ELSE NULL END AS fx_rate_usd_brl,
    -- metadata_public: subset seguro (só campos não sensíveis)
    jsonb_build_object(
      'has_event', c.sue_id IS NOT NULL
    )                                                       AS metadata_public,
    CASE WHEN v_is_admin THEN
      jsonb_build_object(
        'ledger_metadata', c.metadata,
        'event_metadata',  c.sue_metadata,
        'sue_status',      c.sue_status,
        'sue_cost_owner',  c.sue_cost_owner
      )
    ELSE NULL END                                           AS metadata_admin,
    c.total_count                                           AS total_count
  FROM counted c
  ORDER BY c.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_credit_history(uuid, timestamptz, timestamptz, text, text, text, text, text, uuid, boolean, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_credit_history(uuid, timestamptz, timestamptz, text, text, text, text, text, uuid, boolean, int, int) TO authenticated;
