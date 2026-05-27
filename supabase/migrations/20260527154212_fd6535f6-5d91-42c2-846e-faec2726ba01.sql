
CREATE OR REPLACE FUNCTION public.enqueue_shipping_draft_from_pv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved RECORD;
  v_carrier text;
BEGIN
  IF COALESCE(NEW.fiscal_stage, '') <> 'pedido_venda' THEN RETURN NEW; END IF;
  IF NEW.source_order_invoice_id IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.order_id IS NOT NULL THEN
    SELECT provider_id, provider_kind, reason
      INTO v_resolved
      FROM public.resolve_order_shipping_provider(NEW.order_id);
    IF v_resolved.reason = 'marketplace' THEN RETURN NEW; END IF;
    IF v_resolved.provider_kind = 'gateway' THEN RETURN NEW; END IF;
    SELECT COALESCE(LOWER(TRIM(shipping_carrier)), 'manual')
      INTO v_carrier FROM public.orders WHERE id = NEW.order_id;
  ELSE
    v_carrier := 'manual';
  END IF;

  -- Evita duplicado checando antes (índice é parcial, ON CONFLICT não casa)
  IF EXISTS (
    SELECT 1 FROM public.shipping_draft_queue
     WHERE source_pedido_venda_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.shipping_draft_queue (tenant_id, order_id, source_pedido_venda_id, provider)
  VALUES (NEW.tenant_id, NEW.order_id, NEW.id, COALESCE(v_carrier, 'manual'));

  RETURN NEW;
END;
$$;
