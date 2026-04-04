
-- Cleanup test data
DELETE FROM public.customers WHERE email = 'teste-validacao-fluxo@teste.com' AND tenant_id = '38c8a488-01da-4f4c-8ae7-238c1e56b0e1';
DELETE FROM public.orders WHERE order_number = 'SIMTEST-001' AND tenant_id = '38c8a488-01da-4f4c-8ae7-238c1e56b0e1';
