
-- TEST MIGRATION: Simulate payment approval to validate trigger
-- Will be a real migration but only affects the test order
UPDATE public.orders 
SET payment_status = 'approved', 
    paid_at = NOW(),
    updated_at = NOW()
WHERE order_number = 'SIMTEST-001'
  AND tenant_id = '38c8a488-01da-4f4c-8ae7-238c1e56b0e1';
