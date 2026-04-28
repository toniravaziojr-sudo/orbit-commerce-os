-- count_unique_visitors (preserva RETURNS integer + LANGUAGE sql)
CREATE OR REPLACE FUNCTION public.count_unique_visitors(
  p_tenant_id uuid,
  p_start timestamp with time zone,
  p_end timestamp with time zone
)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(DISTINCT visitor_id)::integer INTO v_count
  FROM public.storefront_visits
  WHERE tenant_id = p_tenant_id
    AND created_at >= p_start
    AND created_at <= p_end;

  RETURN COALESCE(v_count, 0);
END;
$function$;

-- log_marketing_sync_audit (preserva defaults e RETURNS void)
CREATE OR REPLACE FUNCTION public.log_marketing_sync_audit(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_source text,
  p_status text,
  p_reason text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  INSERT INTO email_marketing_sync_audit (tenant_id, customer_id, source, status, reason, metadata)
  VALUES (p_tenant_id, p_customer_id, p_source, p_status, p_reason, p_metadata);
END;
$function$;

-- update_customer_order_stats (preserva RETURNS TABLE + lógica completa)
CREATE OR REPLACE FUNCTION public.update_customer_order_stats(p_tenant_id uuid)
RETURNS TABLE(updated_count integer, total_customers integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_updated_count INTEGER := 0;
  v_total_customers INTEGER := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total_customers
  FROM customers
  WHERE tenant_id = p_tenant_id;

  WITH order_stats AS (
    SELECT 
      c.id as customer_id,
      COUNT(o.id) as order_count,
      COALESCE(SUM(o.total), 0) as spent_total,
      COALESCE(AVG(o.total), 0) as avg_ticket,
      MIN(o.created_at) as first_order,
      MAX(o.created_at) as last_order
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    WHERE c.tenant_id = p_tenant_id
    GROUP BY c.id
  )
  UPDATE customers c
  SET 
    total_orders = CASE WHEN os.order_count > 0 THEN os.order_count ELSE total_orders END,
    total_spent = CASE WHEN os.spent_total > 0 THEN os.spent_total ELSE total_spent END,
    average_ticket = CASE WHEN os.avg_ticket > 0 THEN os.avg_ticket ELSE average_ticket END,
    first_order_at = COALESCE(os.first_order, first_order_at),
    last_order_at = COALESCE(os.last_order, last_order_at),
    updated_at = NOW()
  FROM order_stats os
  WHERE c.id = os.customer_id
    AND c.tenant_id = p_tenant_id
    AND (
      c.total_orders IS DISTINCT FROM os.order_count
      OR c.total_spent IS DISTINCT FROM os.spent_total
    );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN QUERY SELECT v_updated_count, v_total_customers;
END;
$function$;