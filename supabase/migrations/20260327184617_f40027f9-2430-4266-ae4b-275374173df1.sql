
-- Phase 1A: Add retry/locking/snapshot columns to social_posts
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS attempt_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS lock_token uuid,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS payload_snapshot jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS normalization_result jsonb;

-- Add frozen_payload to media_calendar_items
ALTER TABLE media_calendar_items
  ADD COLUMN IF NOT EXISTS frozen_payload jsonb;

-- Index for worker query: retry-eligible posts
CREATE INDEX IF NOT EXISTS idx_social_posts_retry
  ON social_posts (status, next_retry_at, attempt_count)
  WHERE status = 'failed' AND attempt_count < 3;

-- Index for worker query: scheduled posts due
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_due
  ON social_posts (status, scheduled_at)
  WHERE status = 'scheduled';

-- Index for stale lock detection
CREATE INDEX IF NOT EXISTS idx_social_posts_processing_lock
  ON social_posts (processing_started_at)
  WHERE processing_started_at IS NOT NULL AND status = 'scheduled';
