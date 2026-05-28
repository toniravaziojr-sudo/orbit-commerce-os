
-- Recalcula peso/dimensões/valor da remessa-rascunho do PV após inserção dos itens.
-- Resolve a corrida: o gatilho de criação da remessa roda quando o PV nasce em_aberto,
-- mas antes dos itens existirem. Sem isso o peso cai no padrão de 300g.
CREATE OR REPLACE FUNCTION public.recompute_shipment_metadata_from_pv_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pv RECORD;
  v_weight numeric := 0;
  v_max_h numeric := 0;
  v_max_w numeric := 0;
  v_sum_d numeric := 0;
  v_declared numeric := 0;
  v_items_count integer := 0;
  v_shipment_id uuid;
  v_meta jsonb;
BEGIN
  SELECT id, tenant_id, order_id, fiscal_stage, source_order_invoice_id, pedido_status
    INTO v_pv
    FROM public.fiscal_invoices
   WHERE id = NEW.invoice_id;

  IF NOT FOUND OR v_pv.fiscal_stage <> 'pedido_venda' OR v_pv.source_order_invoice_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF COALESCE(v_pv.pedido_status,'') <> 'em_aberto' THEN
    RETURN NEW;
  END IF;

  SELECT s.id INTO v_shipment_id
    FROM public.shipments s
   WHERE s.source_pedido_venda_id = v_pv.id
     AND (s.tracking_code IS NULL OR s.tracking_code = '')
     AND COALESCE(s.manually_adjusted, false) = false
   LIMIT 1;

  IF v_shipment_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_pv.order_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(COALESCE(p.weight, 300) * oi.quantity), 300),
      COALESCE(MAX(COALESCE(p.height, 10)), 10),
      COALESCE(MAX(COALESCE(p.width, 15)), 15),
      COALESCE(SUM(COALESCE(p.depth, 20)), 20),
      COALESCE(SUM(oi.total_price), 0),
      COALESCE(SUM(oi.quantity), 0)
    INTO v_weight, v_max_h, v_max_w, v_sum_d, v_declared, v_items_count
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = v_pv.order_id;
  ELSE
    SELECT
      COALESCE(SUM(COALESCE(p.weight, 300) * fii.quantidade), 300),
      COALESCE(MAX(COALESCE(p.height, 10)), 10),
      COALESCE(MAX(COALESCE(p.width, 15)), 15),
      COALESCE(SUM(COALESCE(p.depth, 20)), 20),
      COALESCE(SUM(fii.valor_total), 0),
      COALESCE(SUM(fii.quantidade), 0)
    INTO v_weight, v_max_h, v_max_w, v_sum_d, v_declared, v_items_count
    FROM public.fiscal_invoice_items fii
    LEFT JOIN public.products p
      ON p.id = fii.product_id
      OR (p.sku IS NOT NULL AND p.sku = fii.codigo_produto AND p.tenant_id = v_pv.tenant_id)
    WHERE fii.invoice_id = v_pv.id;
  END IF;

  v_meta := jsonb_build_object(
    'weight_grams',  GREATEST(ROUND(v_weight)::int, 1),
    'height_cm',     v_max_h,
    'width_cm',      v_max_w,
    'depth_cm',      v_sum_d,
    'declared_value', v_declared,
    'items_count',   v_items_count,
    'computed_by',   'recompute_shipment_metadata_from_pv_items',
    'computed_at',   to_jsonb(now())
  );

  UPDATE public.shipments
     SET metadata = COALESCE(metadata, '{}'::jsonb) || v_meta
   WHERE id = v_shipment_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_shipment_metadata_from_pv_items
  ON public.fiscal_invoice_items;

CREATE TRIGGER trg_recompute_shipment_metadata_from_pv_items
AFTER INSERT ON public.fiscal_invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.recompute_shipment_metadata_from_pv_items();
