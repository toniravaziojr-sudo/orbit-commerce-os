
-- Add new roas_scaling_threshold column
ALTER TABLE public.ads_autopilot_account_configs 
ADD COLUMN IF NOT EXISTS roas_scaling_threshold numeric;

-- Migrate existing data from roas_scale_up_threshold
UPDATE public.ads_autopilot_account_configs 
SET roas_scaling_threshold = roas_scale_up_threshold 
WHERE roas_scale_up_threshold IS NOT NULL AND roas_scaling_threshold IS NULL;

-- Drop obsolete columns
ALTER TABLE public.ads_autopilot_account_configs 
DROP COLUMN IF EXISTS roas_scale_up_threshold,
DROP COLUMN IF EXISTS roas_scale_down_threshold,
DROP COLUMN IF EXISTS budget_increase_pct,
DROP COLUMN IF EXISTS budget_decrease_pct;
