
-- Add provider column to payment_method_discounts
ALTER TABLE public.payment_method_discounts 
ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'pagarme';

-- Drop old unique constraint
ALTER TABLE public.payment_method_discounts 
DROP CONSTRAINT IF EXISTS payment_method_discounts_tenant_id_payment_method_key;

-- Create new unique constraint including provider
ALTER TABLE public.payment_method_discounts 
ADD CONSTRAINT payment_method_discounts_tenant_provider_method_key 
UNIQUE (tenant_id, provider, payment_method);
