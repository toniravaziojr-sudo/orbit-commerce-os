DO $$
DECLARE
  v_order uuid := '9fc93211-aa23-4a43-949e-26a0ee144dd9';
  v_cust  uuid := '99a6dd48-80a6-4547-99d7-a0db35e242cd';
  v_email text := 'teste-fluxo-2026-05-20@inexistente-respeite.local';
BEGIN
  DELETE FROM public.fiscal_invoices WHERE source_order_invoice_id IN (SELECT id FROM public.fiscal_invoices WHERE order_id = v_order);
  DELETE FROM public.fiscal_invoices WHERE order_id = v_order;
  DELETE FROM public.fiscal_draft_queue WHERE order_id = v_order;
  DELETE FROM public.shipping_draft_queue WHERE order_id = v_order;
  DELETE FROM public.payment_transactions WHERE order_id = v_order;
  DELETE FROM public.order_items WHERE order_id = v_order;
  DELETE FROM public.order_history WHERE order_id = v_order;
  DELETE FROM public.notification_logs WHERE order_id = v_order;
  DELETE FROM public.notifications WHERE payload->>'order_id' = v_order::text;
  DELETE FROM public.orders WHERE id = v_order;
  DELETE FROM public.events_inbox WHERE idempotency_key = 'test-e2e-2026-05-20-orderpaid';
  DELETE FROM public.email_marketing_list_members WHERE subscriber_id IN (SELECT id FROM public.email_marketing_subscribers WHERE email = v_email);
  DELETE FROM public.email_marketing_subscribers WHERE email = v_email;
  DELETE FROM public.customer_tag_assignments WHERE customer_id = v_cust;
  DELETE FROM public.customers WHERE id = v_cust;
END $$;