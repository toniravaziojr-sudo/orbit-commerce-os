-- Alterar default de next_order_number para 1 (ao invés de 1000)
ALTER TABLE public.tenants 
ALTER COLUMN next_order_number SET DEFAULT 1;