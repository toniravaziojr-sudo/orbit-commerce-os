
CREATE OR REPLACE FUNCTION public.enqueue_fiscal_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resolved RECORD;
  v_should_fire boolean := false;
  v_was_paid boolean;
  v_is_paid boolean;
  v_status_was_paid boolean;
  v_status_is_paid boolean;
BEGIN
  v_is_paid := public.is_payment_approved(NEW.payment_status::text);
  v_status_is_paid := public.order_status_implies_paid(NEW.status::text);

  IF TG_OP = 'INSERT' THEN
    IF v_is_paid OR v_status_is_paid THEN
      v_should_fire := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_was_paid := public.is_payment_approved(OLD.payment_status::text);
    v_status_was_paid := public.order_status_implies_paid(OLD.status::text);
    IF (v_is_paid AND NOT v_was_paid) OR (v_status_is_paid AND NOT v_status_was_paid) THEN
      v_should_fire := true;
    END IF;
  END IF;

  IF NOT v_should_fire THEN
    RETURN NEW;
  END IF;

  IF public.order_has_unlinked_items(NEW.id) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.fiscal_invoices
     WHERE order_id = NEW.id
       AND COALESCE(fiscal_stage, '') = 'pedido_venda'
  ) THEN
    INSERT INTO public.fiscal_draft_queue (tenant_id, order_id)
    VALUES (NEW.tenant_id, NEW.id)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  SELECT provider_id, provider_kind, reason
    INTO v_resolved
    FROM public.resolve_order_shipping_provider(NEW.id);

  UPDATE public.orders
     SET resolved_shipping_provider_id   = v_resolved.provider_id,
         resolved_shipping_provider_kind = v_resolved.provider_kind,
         resolved_shipping_reason        = v_resolved.reason
   WHERE id = NEW.id;

  IF v_resolved.reason = 'marketplace' THEN
    RETURN NEW;
  END IF;

  IF v_resolved.provider_kind = 'gateway' THEN
    INSERT INTO public.gateway_sync_queue (tenant_id, order_id, provider_id, action, payload)
    VALUES (NEW.tenant_id, NEW.id, v_resolved.provider_id, 'sync_order',
            jsonb_build_object('reason', v_resolved.reason))
    ON CONFLICT (order_id, action) WHERE status IN ('pending','processing') DO NOTHING;
  ELSE
    INSERT INTO public.shipping_draft_queue (tenant_id, order_id, provider)
    VALUES (NEW.tenant_id, NEW.id,
            COALESCE(LOWER(TRIM(NEW.shipping_carrier)), 'manual'))
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_missing_fiscal_drafts(
  p_tenant_id uuid DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS TABLE(order_id uuid, order_number text, action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT o.id, o.tenant_id, o.order_number, o.shipping_carrier
      FROM public.orders o
     WHERE (p_tenant_id IS NULL OR o.tenant_id = p_tenant_id)
       AND (
         public.is_payment_approved(o.payment_status::text)
         OR public.order_status_implies_paid(o.status::text)
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.fiscal_invoices fi
          WHERE fi.order_id = o.id
            AND COALESCE(fi.fiscal_stage, '') = 'pedido_venda'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.fiscal_draft_queue q
          WHERE q.order_id = o.id
            AND q.status IN ('pending','processing')
       )
       AND NOT public.order_has_unlinked_items(o.id)
     ORDER BY o.created_at DESC
     LIMIT p_limit
  LOOP
    INSERT INTO public.fiscal_draft_queue (tenant_id, order_id)
    VALUES (v_order.tenant_id, v_order.id)
    ON CONFLICT (order_id) DO NOTHING;

    order_id := v_order.id;
    order_number := v_order.order_number;
    action := 'enqueued';
    RETURN NEXT;
  END LOOP;
END;
$function$;
