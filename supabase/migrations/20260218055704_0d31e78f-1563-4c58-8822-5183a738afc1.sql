
-- v5.11.0: Pipeline de Criativos e Integridade Operacional

-- 1A. Novas colunas em ads_creative_assets
ALTER TABLE ads_creative_assets
  ADD COLUMN IF NOT EXISTS funnel_stage TEXT CHECK (funnel_stage IN ('tof','mof','bof','test','leads')),
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS platform_adcreative_id TEXT,
  ADD COLUMN IF NOT EXISTS expected_image_hash TEXT,
  ADD COLUMN IF NOT EXISTS expected_video_id TEXT;

-- 1B. Novas colunas em ads_autopilot_sessions
ALTER TABLE ads_autopilot_sessions
  ADD COLUMN IF NOT EXISTS used_asset_ids JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS used_adcreative_ids JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS media_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS media_block_reason TEXT,
  ADD COLUMN IF NOT EXISTS strategy_run_id TEXT;
