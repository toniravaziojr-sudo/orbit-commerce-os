CREATE OR REPLACE FUNCTION public.sync_shipment_with_pv_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_kind shipping_provider_kind;
BEGIN
  IF NEW.fiscal_stage <> 'pedido_venda' OR NEW.source_order_invoice_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.pedido_status,'') = COALESCE(NEW.pedido_status,'') THEN
    RETURN NEW;
  END IF;

  IF NEW.pedido_status = 'em_aberto' AND NEW.order_id IS NOT NULL THEN
    SELECT o.resolved_shipping_provider_kind INTO v_provider_kind
    FROM orders o WHERE o.id = NEW.order_id LIMIT 1;

    IF v_provider_kind = 'gateway' THEN
      RETURN NEW;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.order_id = NEW.order_id
        AND (s.tracking_code IS NULL OR s.tracking_code = '')
    ) THEN
      INSERT INTO shipments (
        tenant_id, order_id, source_pedido_venda_id,
        carrier, source, delivery_status
      ) VALUES (
        NEW.tenant_id, NEW.order_id, NEW.id,
        'correios', 'auto_pv_sync', 'label_created'
      );
    ELSE
      UPDATE shipments
         SET source_pedido_venda_id = NEW.id
       WHERE order_id = NEW.order_id
         AND source_pedido_venda_id IS NULL
         AND (tracking_code IS NULL OR tracking_code = '');
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.pedido_status = 'em_aberto'
     AND NEW.pedido_status IS DISTINCT FROM 'em_aberto'
     AND NEW.order_id IS NOT NULL
  THEN
    DELETE FROM shipments
     WHERE order_id = NEW.order_id
       AND (tracking_code IS NULL OR tracking_code = '');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shipment_with_pv_status ON public.fiscal_invoices;
CREATE TRIGGER trg_sync_shipment_with_pv_status
AFTER INSERT OR UPDATE OF pedido_status ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_shipment_with_pv_status();

DELETE FROM shipments s
WHERE (s.tracking_code IS NULL OR s.tracking_code = '')
  AND NOT EXISTS (
    SELECT 1 FROM fiscal_invoices fi
    WHERE fi.fiscal_stage = 'pedido_venda'
      AND fi.source_order_invoice_id IS NULL
      AND fi.order_id = s.order_id
      AND fi.pedido_status = 'em_aberto'
  );

INSERT INTO shipments (tenant_id, order_id, source_pedido_venda_id, carrier, source, delivery_status)
SELECT fi.tenant_id, fi.order_id, fi.id, 'correios', 'auto_pv_sync', 'label_created'
FROM fiscal_invoices fi
LEFT JOIN orders o ON o.id = fi.order_id
WHERE fi.fiscal_stage='pedido_venda'
  AND fi.source_order_invoice_id IS NULL
  AND fi.pedido_status='em_aberto'
  AND fi.order_id IS NOT NULL
  AND (o.resolved_shipping_provider_kind IS NULL OR o.resolved_shipping_provider_kind <> 'gateway')
  AND NOT EXISTS (
    SELECT 1 FROM shipments s WHERE s.order_id = fi.order_id
      AND (s.tracking_code IS NULL OR s.tracking_code = '')
  );