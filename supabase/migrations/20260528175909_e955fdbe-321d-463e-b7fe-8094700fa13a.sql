-- Cascata segura: ao excluir um PV, remove apenas remessas-rascunho (sem tracking_code).
-- Remessas postadas mantêm-se intocadas (FK SET NULL já preservada).
CREATE OR REPLACE FUNCTION public.cascade_delete_draft_shipment_on_pv_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.fiscal_stage <> 'pedido_venda' OR OLD.source_order_invoice_id IS NOT NULL THEN
    RETURN OLD;
  END IF;

  DELETE FROM public.shipments
   WHERE source_pedido_venda_id = OLD.id
     AND (tracking_code IS NULL OR tracking_code = '');

  -- Cancela itens pendentes na fila para evitar recriação
  UPDATE public.shipping_draft_queue
     SET status = 'cancelled',
         cancel_reason = 'pv_deleted'
   WHERE source_pedido_venda_id = OLD.id
     AND status IN ('pending','processing');

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_draft_shipment_on_pv_delete ON public.fiscal_invoices;
CREATE TRIGGER trg_cascade_delete_draft_shipment_on_pv_delete
BEFORE DELETE ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_draft_shipment_on_pv_delete();