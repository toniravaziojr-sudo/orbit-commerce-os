-- Replace recalc_customer_metrics with dynamic percentile-based loyalty tiers per tenant
CREATE OR REPLACE FUNCTION public.recalc_customer_metrics(p_tenant_id uuid, p_customer_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_orders INTEGER;
  v_total_spent NUMERIC;
  v_avg_ticket NUMERIC;
  v_first_order TIMESTAMPTZ;
  v_last_order TIMESTAMPTZ;
  v_tier TEXT;
  v_p50 NUMERIC;
  v_p75 NUMERIC;
  v_p90 NUMERIC;
BEGIN
  -- Calculate metrics from approved orders only (exclude ghost orders with total=0)
  SELECT 
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(total), 0),
    CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total) / COUNT(*), 0) ELSE 0 END,
    MIN(created_at),
    MAX(created_at)
  INTO v_total_orders, v_total_spent, v_avg_ticket, v_first_order, v_last_order
  FROM public.orders
  WHERE tenant_id = p_tenant_id
    AND LOWER(TRIM(customer_email)) = LOWER(TRIM(p_customer_email))
    AND payment_status = 'approved'
    AND total > 0;

  -- Calculate dynamic percentile thresholds from this tenant's customer base
  SELECT
    COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY COALESCE(total_spent, 0)), 0),
    COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY COALESCE(total_spent, 0)), 0),
    COALESCE(percentile_cont(0.90) WITHIN GROUP (ORDER BY COALESCE(total_spent, 0)), 0)
  INTO v_p50, v_p75, v_p90
  FROM public.customers
  WHERE tenant_id = p_tenant_id
    AND COALESCE(total_spent, 0) > 0
    AND deleted_at IS NULL;

  -- Calculate tier based on dynamic percentiles of the tenant
  -- If no customers with spend yet, default to bronze
  IF v_p50 = 0 AND v_p75 = 0 AND v_p90 = 0 THEN
    v_tier := 'bronze';
  ELSE
    v_tier := CASE
      WHEN v_total_spent >= v_p90 THEN 'platinum'
      WHEN v_total_spent >= v_p75 THEN 'gold'
      WHEN v_total_spent >= v_p50 THEN 'silver'
      ELSE 'bronze'
    END;
  END IF;

  -- Update customer record
  UPDATE public.customers
  SET 
    total_orders = v_total_orders,
    total_spent = v_total_spent,
    average_ticket = v_avg_ticket,
    first_order_at = v_first_order,
    last_order_at = v_last_order,
    loyalty_tier = v_tier,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND LOWER(TRIM(email)) = LOWER(TRIM(p_customer_email))
    AND deleted_at IS NULL;
END;
$$;