DO $$
DECLARE
  v_order_id uuid := 'a12eae53-cd9b-4869-8e98-d60a4bcc9842';
BEGIN
  DELETE FROM shipment_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id = v_order_id);
  DELETE FROM shipments WHERE order_id = v_order_id;
  DELETE FROM shipping_draft_queue WHERE order_id = v_order_id;

  DELETE FROM fiscal_invoice_events WHERE invoice_id IN (SELECT id FROM fiscal_invoices WHERE order_id = v_order_id);
  DELETE FROM fiscal_invoice_items WHERE invoice_id IN (SELECT id FROM fiscal_invoices WHERE order_id = v_order_id);
  DELETE FROM fiscal_invoices WHERE order_id = v_order_id;
  DELETE FROM fiscal_draft_queue WHERE order_id = v_order_id;

  DELETE FROM order_history WHERE order_id = v_order_id;
  DELETE FROM order_attribution WHERE order_id = v_order_id;
  DELETE FROM order_price_audit WHERE order_id = v_order_id;
  DELETE FROM order_items WHERE order_id = v_order_id;
  DELETE FROM orders WHERE id = v_order_id;
END $$;