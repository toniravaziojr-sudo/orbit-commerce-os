-- Fix orders with failed transactions that are still showing pending
UPDATE orders SET 
  payment_status = 'declined',
  updated_at = now()
FROM payment_transactions pt
WHERE pt.order_id = orders.id 
  AND pt.status = 'failed' 
  AND orders.payment_status = 'pending';