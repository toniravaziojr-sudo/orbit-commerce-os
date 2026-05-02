-- Recuperar pedido #390 órfão: converter payment_status 'paid' -> 'approved' para disparar triggers de fila fiscal e remessa
UPDATE public.orders
SET payment_status = 'approved'::payment_status,
    status = CASE WHEN status = 'pending' THEN 'ready_to_invoice' ELSE status END,
    shipping_status = CASE WHEN shipping_status = 'shipped' THEN 'awaiting_shipment'::shipping_status ELSE shipping_status END,
    shipped_at = CASE WHEN shipping_status = 'shipped' THEN NULL ELSE shipped_at END
WHERE order_number = '#390'
  AND payment_status = 'paid';