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
  v_reached_ready boolean := false;
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

    IF NEW.status::text = 'ready_to_invoice' AND COALESCE(OLD.status::text,'') <> 'ready_to_invoice' THEN
      v_should_fire := true;
      v_reached_ready := true;
    END IF;
  END IF;

  IF NOT v_should_fire THEN RETURN NEW; END IF;
  IF public.order_has_unlinked_items(NEW.id) THEN RETURN NEW; END IF;

  -- Primeira tentativa: inserir rascunho novo se ainda não existe
  INSERT INTO public.fiscal_draft_queue (tenant_id, order_id)
  VALUES (NEW.tenant_id, NEW.id)
  ON CONFLICT (order_id) DO NOTHING;

  -- Re-enfileiração idempotente: ao atingir ready_to_invoice, se já existe
  -- registro 'done'/'failed' e nenhum pendente/processing, reabre o existente.
  -- Evita violação do índice único fiscal_draft_queue_order_unique.
  IF v_reached_ready THEN
    UPDATE public.fiscal_draft_queue
       SET status = 'pending',
           attempts = 0,
           last_error = NULL,
           updated_at = now()
     WHERE order_id = NEW.id
       AND status NOT IN ('pending','processing');
  END IF;

  SELECT provider_id, provider_kind, reason
    INTO v_resolved
    FROM public.resolve_order_shipping_provider(NEW.id);

  UPDATE public.orders
     SET resolved_shipping_provider_id   = v_resolved.provider_id,
         resolved_shipping_provider_kind = v_resolved.provider_kind,
         resolved_shipping_reason        = v_resolved.reason
   WHERE id = NEW.id;

  IF v_resolved.reason = 'marketplace' THEN RETURN NEW; END IF;

  IF v_resolved.provider_kind = 'gateway' THEN
    INSERT INTO public.gateway_sync_queue (tenant_id, order_id, provider_id, action, payload)
    VALUES (NEW.tenant_id, NEW.id, v_resolved.provider_id, 'sync_order',
            jsonb_build_object('reason', v_resolved.reason))
    ON CONFLICT (order_id, action) WHERE status IN ('pending','processing') DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;