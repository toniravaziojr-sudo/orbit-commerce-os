CREATE OR REPLACE FUNCTION public.enqueue_fiscal_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resolved RECORD;
  v_should_fire boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.payment_status = 'approved'
     AND (OLD.payment_status IS DISTINCT FROM 'approved') THEN
    v_should_fire := true;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.payment_status = 'approved' THEN
    v_should_fire := true;
  END IF;

  IF NOT v_should_fire THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.fiscal_draft_queue (tenant_id, order_id)
  VALUES (NEW.tenant_id, NEW.id)
  ON CONFLICT (order_id) DO NOTHING;

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

DROP TRIGGER IF EXISTS trg_enqueue_fiscal_draft ON public.orders;
CREATE TRIGGER trg_enqueue_fiscal_draft
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_fiscal_draft();

DROP TRIGGER IF EXISTS trg_after_order_approved_sync ON public.orders;
CREATE TRIGGER trg_after_order_approved_sync
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW
WHEN (NEW.payment_status = 'approved'::payment_status)
EXECUTE FUNCTION public.after_order_approved_sync();