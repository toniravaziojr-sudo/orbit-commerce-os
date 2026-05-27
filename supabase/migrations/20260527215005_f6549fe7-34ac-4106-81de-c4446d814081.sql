CREATE OR REPLACE FUNCTION public.sync_shipment_with_pv_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_provider_kind shipping_provider_kind;
BEGIN
  IF NEW.fiscal_stage <> 'pedido_venda' OR NEW.source_order_invoice_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.pedido_status,'') = COALESCE(NEW.pedido_status,'') THEN
    RETURN NEW;
  END IF;

  IF NEW.pedido_status = 'em_aberto' THEN
    IF NEW.order_id IS NOT NULL THEN
      SELECT o.resolved_shipping_provider_kind INTO v_provider_kind
      FROM orders o WHERE o.id = NEW.order_id LIMIT 1;
      IF v_provider_kind = 'gateway' THEN RETURN NEW; END IF;

      IF NOT EXISTS (
        SELECT 1 FROM shipments s
        WHERE s.order_id = NEW.order_id
          AND (s.tracking_code IS NULL OR s.tracking_code = '')
      ) THEN
        INSERT INTO shipments (tenant_id, order_id, source_pedido_venda_id, carrier, source, delivery_status)
        VALUES (NEW.tenant_id, NEW.order_id, NEW.id, 'correios', 'auto_pv_sync', 'draft');
      ELSE
        UPDATE shipments
           SET source_pedido_venda_id = NEW.id
         WHERE order_id = NEW.order_id
           AND source_pedido_venda_id IS NULL
           AND (tracking_code IS NULL OR tracking_code = '');
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.pedido_status = 'em_aberto' AND NEW.pedido_status IS DISTINCT FROM 'em_aberto' THEN
    IF NEW.order_id IS NOT NULL THEN
      DELETE FROM shipments
       WHERE order_id = NEW.order_id
         AND (tracking_code IS NULL OR tracking_code = '');
    END IF;

    DELETE FROM shipments
     WHERE source_pedido_venda_id = NEW.id
       AND (tracking_code IS NULL OR tracking_code = '');

    UPDATE shipping_draft_queue
       SET status = 'cancelled',
           cancelled_at = now(),
           cancel_reason = 'pv_left_em_aberto:' || COALESCE(NEW.pedido_status, 'unknown')
     WHERE source_pedido_venda_id = NEW.id
       AND status IN ('pending','processing');
  END IF;

  RETURN NEW;
END;
$function$;