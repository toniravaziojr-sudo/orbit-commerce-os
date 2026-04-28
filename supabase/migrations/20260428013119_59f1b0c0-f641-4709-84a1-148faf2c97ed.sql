-- Onda 2: Resiliência observável — RPCs platform_admin

-- 1) KPIs de resiliência (3 números do header)
CREATE OR REPLACE FUNCTION public.get_resilience_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orphan_inbound int;
  v_open_incidents int;
  v_payment_divergences int;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'access denied: platform admin only';
  END IF;

  SELECT count(*) INTO v_orphan_inbound
  FROM public.whatsapp_inbound_messages
  WHERE processed_at IS NULL
    AND created_at < (now() - interval '5 minutes');

  SELECT count(*) INTO v_open_incidents
  FROM public.whatsapp_health_incidents
  WHERE status IN ('open','acknowledged');

  SELECT count(*) INTO v_payment_divergences
  FROM public.payment_transactions pt
  WHERE pt.status IN ('paid','approved','authorized')
    AND pt.created_at > (now() - interval '24 hours')
    AND (
      pt.order_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = pt.order_id)
    );

  RETURN jsonb_build_object(
    'orphan_inbound', v_orphan_inbound,
    'open_incidents', v_open_incidents,
    'payment_divergences_24h', v_payment_divergences,
    'captured_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_resilience_kpis() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_resilience_kpis() TO authenticated;

-- 2) Incidentes WhatsApp (lista detalhada)
CREATE OR REPLACE FUNCTION public.get_whatsapp_incidents(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  incident_type text,
  severity text,
  title text,
  detail text,
  status text,
  detected_at timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'access denied: platform admin only';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.tenant_id,
    COALESCE(t.name, '—') as tenant_name,
    i.incident_type,
    i.severity,
    i.title,
    i.detail,
    i.status,
    i.detected_at,
    i.acknowledged_at,
    i.resolved_at,
    i.metadata
  FROM public.whatsapp_health_incidents i
  LEFT JOIN public.tenants t ON t.id = i.tenant_id
  ORDER BY
    CASE i.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
    i.detected_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_incidents(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_incidents(int) TO authenticated;

-- 3) Mensagens WhatsApp órfãs (não processadas)
CREATE OR REPLACE FUNCTION public.get_whatsapp_orphan_inbound(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  provider text,
  external_message_id text,
  from_phone text,
  message_type text,
  age_minutes int,
  created_at timestamptz,
  processing_status text,
  processing_error text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'access denied: platform admin only';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.tenant_id,
    COALESCE(t.name, '—') as tenant_name,
    m.provider,
    m.external_message_id,
    m.from_phone,
    m.message_type,
    GREATEST(0, EXTRACT(EPOCH FROM (now() - m.created_at))::int / 60) as age_minutes,
    m.created_at,
    m.processing_status,
    m.processing_error
  FROM public.whatsapp_inbound_messages m
  LEFT JOIN public.tenants t ON t.id = m.tenant_id
  WHERE m.processed_at IS NULL
    AND m.created_at < (now() - interval '5 minutes')
  ORDER BY m.created_at ASC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_orphan_inbound(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_orphan_inbound(int) TO authenticated;

-- 4) Divergências de pagamento (gateway aprovou mas pedido não existe ou diverge)
CREATE OR REPLACE FUNCTION public.get_payment_divergences(p_window_hours int DEFAULT 24, p_limit int DEFAULT 100)
RETURNS TABLE (
  transaction_id uuid,
  tenant_id uuid,
  tenant_name text,
  provider text,
  provider_transaction_id text,
  status text,
  method text,
  amount numeric,
  paid_amount numeric,
  order_id uuid,
  order_exists boolean,
  divergence_type text,
  paid_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'access denied: platform admin only';
  END IF;

  RETURN QUERY
  WITH txs AS (
    SELECT
      pt.id, pt.tenant_id, pt.provider, pt.provider_transaction_id,
      pt.status, pt.method, pt.amount, pt.paid_amount, pt.order_id,
      pt.paid_at, pt.created_at,
      EXISTS (SELECT 1 FROM public.orders o WHERE o.id = pt.order_id) as order_exists,
      (SELECT o.total FROM public.orders o WHERE o.id = pt.order_id) as order_total
    FROM public.payment_transactions pt
    WHERE pt.status IN ('paid','approved','authorized')
      AND pt.created_at > (now() - make_interval(hours => GREATEST(1, LEAST(p_window_hours, 720))))
  )
  SELECT
    txs.id as transaction_id,
    txs.tenant_id,
    COALESCE(t.name, '—') as tenant_name,
    txs.provider,
    txs.provider_transaction_id,
    txs.status,
    txs.method,
    txs.amount,
    txs.paid_amount,
    txs.order_id,
    txs.order_exists,
    CASE
      WHEN txs.order_id IS NULL THEN 'no_order'
      WHEN NOT txs.order_exists THEN 'order_missing'
      WHEN txs.order_total IS NOT NULL AND ABS(txs.order_total - COALESCE(txs.paid_amount, txs.amount)) > 0.01 THEN 'amount_mismatch'
      ELSE 'unknown'
    END as divergence_type,
    txs.paid_at,
    txs.created_at
  FROM txs
  LEFT JOIN public.tenants t ON t.id = txs.tenant_id
  WHERE txs.order_id IS NULL
     OR NOT txs.order_exists
     OR (txs.order_total IS NOT NULL AND ABS(txs.order_total - COALESCE(txs.paid_amount, txs.amount)) > 0.01)
  ORDER BY txs.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.get_payment_divergences(int, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_divergences(int, int) TO authenticated;

-- 5) Resolver incidente WhatsApp (ação manual)
CREATE OR REPLACE FUNCTION public.resolve_whatsapp_incident(p_incident_id uuid, p_resolution_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_updated int;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'access denied: platform admin only';
  END IF;

  UPDATE public.whatsapp_health_incidents
  SET
    status = 'resolved',
    resolved_at = now(),
    acknowledged_by = COALESCE(acknowledged_by, v_user),
    acknowledged_at = COALESCE(acknowledged_at, now()),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'resolved_by', v_user,
      'resolution_note', p_resolution_note,
      'resolved_at_iso', now()
    ),
    updated_at = now()
  WHERE id = p_incident_id
    AND status IN ('open','acknowledged');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', v_updated > 0,
    'incident_id', p_incident_id,
    'updated', v_updated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_whatsapp_incident(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_whatsapp_incident(uuid, text) TO authenticated;