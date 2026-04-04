
-- Clean up first test and re-test with corrected triggers
-- Reset the test order to pending (simulating fresh order)
UPDATE public.orders 
SET payment_status = 'pending', customer_id = NULL, is_first_sale = false, paid_at = NULL
WHERE order_number = 'SIMTEST-001';

-- Delete the customer created by the first (broken) test
DELETE FROM public.customers 
WHERE email = 'teste-validacao-fluxo@teste.com' 
AND tenant_id = '38c8a488-01da-4f4c-8ae7-238c1e56b0e1';
