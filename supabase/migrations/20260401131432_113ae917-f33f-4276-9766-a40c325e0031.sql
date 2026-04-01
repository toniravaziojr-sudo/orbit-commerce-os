
-- Function to recalculate customer metrics from real orders
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

  -- Calculate tier based on orders and spend
  v_tier := CASE
    WHEN v_total_orders >= 30 OR v_total_spent >= 15000 THEN 'platinum'
    WHEN v_total_orders >= 15 OR v_total_spent >= 5000 THEN 'gold'
    WHEN v_total_orders >= 5 OR v_total_spent >= 1000 THEN 'silver'
    ELSE 'bronze'
  END;

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

-- Trigger function to recalc metrics on order payment approved
CREATE OR REPLACE FUNCTION public.trg_recalc_customer_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger on payment_status change to 'approved'
  IF NEW.payment_status = 'approved' AND (OLD IS NULL OR OLD.payment_status IS DISTINCT FROM 'approved') THEN
    -- Recalculate metrics
    PERFORM public.recalc_customer_metrics(NEW.tenant_id, NEW.customer_email);
    
    -- Auto-sync to email marketing (idempotent)
    PERFORM public.sync_subscriber_to_customer_with_tag(
      NEW.tenant_id,
      NEW.customer_email,
      NEW.customer_name,
      NEW.customer_phone,
      NULL, -- birth_date
      'order', -- source
      (SELECT l.id FROM public.email_marketing_lists l 
       JOIN public.customer_tags t ON l.tag_id = t.id 
       WHERE l.tenant_id = NEW.tenant_id AND t.name = 'Cliente' 
       LIMIT 1)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trg_recalc_customer_metrics_on_order ON public.orders;
CREATE TRIGGER trg_recalc_customer_metrics_on_order
  AFTER INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recalc_customer_on_order();
