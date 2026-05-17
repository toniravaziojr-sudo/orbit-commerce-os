
-- Helper: verifica se pedido tem itens sem vínculo com produto local
CREATE OR REPLACE FUNCTION public.order_has_unlinked_items(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_id = p_order_id AND product_id IS NULL
  );
$$;

-- Atualiza enqueue_fiscal_draft para bloquear fila quando há itens sem vínculo
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

  -- Bloqueio: pedidos com itens sem vínculo de produto local não entram na fila fiscal
  IF public.order_has_unlinked_items(NEW.id) THEN
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

-- Re-disparador: ao vincular produto local em item antes pendente,
-- se pedido está pago e todos os itens estão vinculados → entra na fila fiscal
CREATE OR REPLACE FUNCTION public.enqueue_fiscal_on_item_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_resolved RECORD;
BEGIN
  IF OLD.product_id IS NOT NULL OR NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, tenant_id, payment_status, shipping_carrier
    INTO v_order
    FROM public.orders
   WHERE id = NEW.order_id;

  IF v_order.id IS NULL OR v_order.payment_status <> 'approved' THEN
    RETURN NEW;
  END IF;

  IF public.order_has_unlinked_items(v_order.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.fiscal_draft_queue (tenant_id, order_id)
  VALUES (v_order.tenant_id, v_order.id)
  ON CONFLICT (order_id) DO NOTHING;

  SELECT provider_id, provider_kind, reason
    INTO v_resolved
    FROM public.resolve_order_shipping_provider(v_order.id);

  UPDATE public.orders
     SET resolved_shipping_provider_id   = v_resolved.provider_id,
         resolved_shipping_provider_kind = v_resolved.provider_kind,
         resolved_shipping_reason        = v_resolved.reason
   WHERE id = v_order.id;

  IF v_resolved.reason = 'marketplace' THEN
    RETURN NEW;
  END IF;

  IF v_resolved.provider_kind = 'gateway' THEN
    INSERT INTO public.gateway_sync_queue (tenant_id, order_id, provider_id, action, payload)
    VALUES (v_order.tenant_id, v_order.id, v_resolved.provider_id, 'sync_order',
            jsonb_build_object('reason', v_resolved.reason))
    ON CONFLICT (order_id, action) WHERE status IN ('pending','processing') DO NOTHING;
  ELSE
    INSERT INTO public.shipping_draft_queue (tenant_id, order_id, provider)
    VALUES (v_order.tenant_id, v_order.id,
            COALESCE(LOWER(TRIM(v_order.shipping_carrier)), 'manual'))
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_fiscal_on_item_link ON public.order_items;
CREATE TRIGGER trg_enqueue_fiscal_on_item_link
AFTER UPDATE OF product_id ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_fiscal_on_item_link();
