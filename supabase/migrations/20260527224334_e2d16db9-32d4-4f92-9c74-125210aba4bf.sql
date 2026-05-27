
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS manually_adjusted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.shipments.manually_adjusted IS
  'Quando true, a remessa foi ajustada manualmente pelo operador. Triggers de espelho (sync_shipment_with_pv_status) e workers nao recalculam nem deletam.';

CREATE INDEX IF NOT EXISTS idx_shipments_manually_adjusted
  ON public.shipments(tenant_id, manually_adjusted)
  WHERE manually_adjusted = true;

CREATE OR REPLACE FUNCTION public.sync_shipment_with_pv_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_provider_kind shipping_provider_kind;
  v_carrier text;
  v_service_name text;
  v_service_code text;
  v_weight_grams numeric := 0;
  v_max_h numeric := 0;
  v_max_w numeric := 0;
  v_sum_d numeric := 0;
  v_declared numeric := 0;
  v_items_count integer := 0;
  v_meta jsonb;
BEGIN
  IF NEW.fiscal_stage <> 'pedido_venda' OR NEW.source_order_invoice_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.pedido_status,'') = COALESCE(NEW.pedido_status,'') THEN
    RETURN NEW;
  END IF;

  IF NEW.pedido_status = 'em_aberto' THEN
    IF NEW.order_id IS NOT NULL THEN
      SELECT o.resolved_shipping_provider_kind,
             COALESCE(NULLIF(LOWER(o.shipping_carrier),''), 'correios'),
             NULLIF(o.shipping_service_name,''),
             NULLIF(o.shipping_service_code,'')
        INTO v_provider_kind, v_carrier, v_service_name, v_service_code
        FROM orders o WHERE o.id = NEW.order_id LIMIT 1;
      IF v_provider_kind = 'gateway' THEN RETURN NEW; END IF;
    ELSE
      v_carrier := COALESCE(NULLIF(LOWER(NEW.transportadora_nome),''), 'manual');
      v_service_name := NULLIF(NEW.transportadora_servico,'');
      v_service_code := NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM shipments s
       WHERE (
              (NEW.order_id IS NOT NULL AND s.order_id = NEW.order_id)
              OR s.source_pedido_venda_id = NEW.id
             )
         AND (s.tracking_code IS NULL OR s.tracking_code = '')
    ) THEN
      UPDATE shipments
         SET source_pedido_venda_id = NEW.id
       WHERE (
              (NEW.order_id IS NOT NULL AND order_id = NEW.order_id)
              OR source_pedido_venda_id = NEW.id
             )
         AND source_pedido_venda_id IS NULL
         AND (tracking_code IS NULL OR tracking_code = '');
      RETURN NEW;
    END IF;

    IF NEW.order_id IS NOT NULL THEN
      SELECT
        COALESCE(SUM(COALESCE(p.weight, 300) * oi.quantity), 300),
        COALESCE(MAX(COALESCE(p.height, 10)), 10),
        COALESCE(MAX(COALESCE(p.width, 15)), 15),
        COALESCE(SUM(COALESCE(p.depth, 20)), 20),
        COALESCE(SUM(oi.total_price), 0),
        COALESCE(SUM(oi.quantity), 0)
      INTO v_weight_grams, v_max_h, v_max_w, v_sum_d, v_declared, v_items_count
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.order_id;
    ELSE
      SELECT
        COALESCE(SUM(COALESCE(p.weight, 300) * fii.quantidade), 300),
        COALESCE(MAX(COALESCE(p.height, 10)), 10),
        COALESCE(MAX(COALESCE(p.width, 15)), 15),
        COALESCE(SUM(COALESCE(p.depth, 20)), 20),
        COALESCE(SUM(fii.valor_total), 0),
        COALESCE(SUM(fii.quantidade), 0)
      INTO v_weight_grams, v_max_h, v_max_w, v_sum_d, v_declared, v_items_count
      FROM fiscal_invoice_items fii
      LEFT JOIN products p ON p.id = fii.product_id
                           OR (p.sku IS NOT NULL AND p.sku = fii.codigo_produto AND p.tenant_id = NEW.tenant_id)
      WHERE fii.invoice_id = NEW.id;
    END IF;

    v_meta := jsonb_build_object(
      'weight_grams', GREATEST(ROUND(v_weight_grams)::int, 1),
      'height_cm',    v_max_h,
      'width_cm',     v_max_w,
      'depth_cm',     v_sum_d,
      'declared_value', v_declared,
      'items_count',  v_items_count,
      'computed_by', 'sync_shipment_with_pv_status',
      'computed_at', to_jsonb(now())
    );

    INSERT INTO shipments (
      tenant_id, order_id, source_pedido_venda_id,
      carrier, service_name, service_code,
      source, delivery_status, metadata
    )
    VALUES (
      NEW.tenant_id, NEW.order_id, NEW.id,
      v_carrier, v_service_name, v_service_code,
      'auto_pv_sync', 'draft', v_meta
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.pedido_status = 'em_aberto' AND NEW.pedido_status IS DISTINCT FROM 'em_aberto' THEN
    IF NEW.order_id IS NOT NULL THEN
      DELETE FROM shipments
       WHERE order_id = NEW.order_id
         AND (tracking_code IS NULL OR tracking_code = '')
         AND manually_adjusted = false;
    END IF;

    DELETE FROM shipments
     WHERE source_pedido_venda_id = NEW.id
       AND (tracking_code IS NULL OR tracking_code = '')
       AND manually_adjusted = false;

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
