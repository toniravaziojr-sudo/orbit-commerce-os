
-- Re-test: simulate payment approval with corrected BEFORE trigger
UPDATE public.orders 
SET payment_status = 'approved', 
    paid_at = NOW(),
    updated_at = NOW()
WHERE order_number = 'SIMTEST-001'
  AND tenant_id = '38c8a488-01da-4f4c-8ae7-238c1e56b0e1';
