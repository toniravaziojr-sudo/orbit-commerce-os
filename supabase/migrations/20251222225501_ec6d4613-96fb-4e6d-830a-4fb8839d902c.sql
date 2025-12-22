-- Add shipping service details to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shipping_service_code TEXT,
ADD COLUMN IF NOT EXISTS shipping_service_name TEXT,
ADD COLUMN IF NOT EXISTS shipping_estimated_days INTEGER;