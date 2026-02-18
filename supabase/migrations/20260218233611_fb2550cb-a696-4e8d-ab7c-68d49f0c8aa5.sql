
-- Add per-account lock columns for anti-concurrency (v5.12.4)
ALTER TABLE public.ads_autopilot_account_configs
  ADD COLUMN IF NOT EXISTS lock_session_id TEXT,
  ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;
