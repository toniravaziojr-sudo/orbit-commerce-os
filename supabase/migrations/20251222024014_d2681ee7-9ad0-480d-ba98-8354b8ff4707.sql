-- Add auto_apply_first_purchase column to discounts table
ALTER TABLE public.discounts 
ADD COLUMN IF NOT EXISTS auto_apply_first_purchase BOOLEAN NOT NULL DEFAULT false;

-- Add index for auto_apply queries
CREATE INDEX IF NOT EXISTS idx_discounts_auto_apply 
ON public.discounts (tenant_id, is_active, auto_apply_first_purchase) 
WHERE auto_apply_first_purchase = true AND is_active = true;

-- Comment for documentation
COMMENT ON COLUMN public.discounts.auto_apply_first_purchase IS 
'When true, this discount is automatically applied for first-time customers (no previous paid/non-cancelled orders)';