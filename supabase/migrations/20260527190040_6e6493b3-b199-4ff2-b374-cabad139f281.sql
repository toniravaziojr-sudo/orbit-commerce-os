
-- Permitir order_id NULL em shipping_draft_queue (PV manual/duplicado)
ALTER TABLE public.shipping_draft_queue ALTER COLUMN order_id DROP NOT NULL;

-- 1) enqueue_shipping_draft_from_pv: usar transportadora do PV quando não há order
CREATE OR REPLACE FUNCTION public.enqueue_shipping_draft_from_pv()
RETURNS TRIGGER
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
    -- PV manual/duplicado: usa transportadora do próprio PV; padrão correios
    v_carrier := COALESCE(NULLIF(LOWER(TRIM(NEW.transportadora_nome)), ''), 'correios');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shipping_draft_queue
     WHERE source_pedido_venda_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.shipping_draft_queue (tenant_id, order_id, source_pedido_venda_id, provider)
  VALUES (NEW.tenant_id, NEW.order_id, NEW.id, COALESCE(v_carrier, 'correios'));

  RETURN NEW;
END;
$$;

-- 2) sync_shipment_with_pv_status: suportar PV sem order_id
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

  -- ENTRADA em em_aberto
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
        VALUES (NEW.tenant_id, NEW.order_id, NEW.id, 'correios', 'auto_pv_sync', 'label_created');
      ELSE
        UPDATE shipments
           SET source_pedido_venda_id = NEW.id
         WHERE order_id = NEW.order_id
           AND source_pedido_venda_id IS NULL
           AND (tracking_code IS NULL OR tracking_code = '');
      END IF;
    END IF;
    -- Quando order_id IS NULL, o worker da fila cria o shipment (lê do PV).
    RETURN NEW;
  END IF;

  -- SAÍDA de em_aberto: limpar rascunho de remessa (sem tracking)
  IF TG_OP = 'UPDATE' AND OLD.pedido_status = 'em_aberto' AND NEW.pedido_status IS DISTINCT FROM 'em_aberto' THEN
    IF NEW.order_id IS NOT NULL THEN
      DELETE FROM shipments
       WHERE order_id = NEW.order_id
         AND (tracking_code IS NULL OR tracking_code = '');
    ELSE
      DELETE FROM shipments
       WHERE source_pedido_venda_id = NEW.id
         AND (tracking_code IS NULL OR tracking_code = '');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Trigger AFTER DELETE em fiscal_invoices: limpar shipment rascunho do PV excluído
CREATE OR REPLACE FUNCTION public.cleanup_shipment_on_pv_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.fiscal_stage,'') <> 'pedido_venda' THEN RETURN OLD; END IF;
  IF OLD.source_order_invoice_id IS NOT NULL THEN RETURN OLD; END IF;

  DELETE FROM public.shipments
   WHERE source_pedido_venda_id = OLD.id
     AND (tracking_code IS NULL OR tracking_code = '');

  -- shipping_draft_queue já tem ON DELETE CASCADE em source_pedido_venda_id
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_shipment_on_pv_delete ON public.fiscal_invoices;
CREATE TRIGGER trg_cleanup_shipment_on_pv_delete
AFTER DELETE ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_shipment_on_pv_delete();
