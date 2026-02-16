
-- Add ROAS-based budget scaling thresholds to per-account configs
ALTER TABLE public.ads_autopilot_account_configs
  ADD COLUMN IF NOT EXISTS roas_scale_up_threshold numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS roas_scale_down_threshold numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS budget_increase_pct integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS budget_decrease_pct integer DEFAULT 20;

-- roas_scale_up_threshold: When ROAS exceeds this, AI increases budget by budget_increase_pct%
-- roas_scale_down_threshold: When ROAS drops below this, AI decreases budget by budget_decrease_pct%
-- These work alongside existing min_roi_cold/min_roi_warm (which trigger pause)

COMMENT ON COLUMN public.ads_autopilot_account_configs.roas_scale_up_threshold IS 'ROAS threshold above which AI should increase budget';
COMMENT ON COLUMN public.ads_autopilot_account_configs.roas_scale_down_threshold IS 'ROAS threshold below which AI should decrease budget (but not pause)';
COMMENT ON COLUMN public.ads_autopilot_account_configs.budget_increase_pct IS 'Max budget increase percentage per cycle when scaling up';
COMMENT ON COLUMN public.ads_autopilot_account_configs.budget_decrease_pct IS 'Max budget decrease percentage per cycle when scaling down';
