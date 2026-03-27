
-- Phase 1B: Add granular statuses and traceability

-- 1. Add new statuses to media_item_status enum
ALTER TYPE public.media_item_status ADD VALUE IF NOT EXISTS 'partially_published';
ALTER TYPE public.media_item_status ADD VALUE IF NOT EXISTS 'partially_failed';
ALTER TYPE public.media_item_status ADD VALUE IF NOT EXISTS 'retry_pending';
ALTER TYPE public.media_item_status ADD VALUE IF NOT EXISTS 'superseded';
ALTER TYPE public.media_item_status ADD VALUE IF NOT EXISTS 'canceled';

-- 2. Add execution_log to social_posts for per-platform traceability
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS execution_log jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS warning_flags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.social_posts(id);
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

-- 3. Add aggregate_status to media_calendar_items (computed from children)
ALTER TABLE public.media_calendar_items ADD COLUMN IF NOT EXISTS platform_summary jsonb DEFAULT '{}'::jsonb;

-- 4. Create function to compute aggregate status from social_posts children
CREATE OR REPLACE FUNCTION public.compute_calendar_item_aggregate_status(p_calendar_item_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_published int;
  v_failed_permanent int;
  v_scheduled int;
  v_retry_pending int;
  v_publishing int;
  v_superseded int;
  v_canceled int;
  v_active int;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'published'),
    count(*) FILTER (WHERE status = 'failed' AND (last_error_code IS NULL OR last_error_code NOT IN ('retryable')) AND (next_retry_at IS NULL OR attempt_count >= 3)),
    count(*) FILTER (WHERE status = 'scheduled'),
    count(*) FILTER (WHERE status = 'failed' AND next_retry_at IS NOT NULL AND attempt_count < 3),
    count(*) FILTER (WHERE status = 'publishing'),
    count(*) FILTER (WHERE status = 'superseded'),
    count(*) FILTER (WHERE status = 'canceled')
  INTO v_total, v_published, v_failed_permanent, v_scheduled, v_retry_pending, v_publishing, v_superseded, v_canceled
  FROM public.social_posts
  WHERE calendar_item_id = p_calendar_item_id;

  -- Exclude superseded and canceled from active count
  v_active := v_total - v_superseded - v_canceled;

  IF v_active = 0 THEN
    IF v_superseded > 0 THEN RETURN 'superseded'; END IF;
    IF v_canceled > 0 THEN RETURN 'canceled'; END IF;
    RETURN NULL;
  END IF;

  -- All active published
  IF v_published = v_active THEN RETURN 'published'; END IF;

  -- Still processing
  IF v_scheduled > 0 OR v_publishing > 0 THEN RETURN 'scheduled'; END IF;
  IF v_retry_pending > 0 THEN RETURN 'retry_pending'; END IF;

  -- Mixed results
  IF v_published > 0 AND v_failed_permanent > 0 THEN RETURN 'partially_failed'; END IF;
  IF v_published > 0 AND (v_scheduled > 0 OR v_retry_pending > 0) THEN RETURN 'partially_published'; END IF;

  -- All failed
  IF v_failed_permanent > 0 AND v_published = 0 THEN RETURN 'failed'; END IF;

  RETURN 'scheduled';
END;
$$;

-- 5. Create trigger function to auto-update parent status
CREATE OR REPLACE FUNCTION public.sync_calendar_item_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_new_status text;
  v_summary jsonb;
BEGIN
  v_item_id := COALESCE(NEW.calendar_item_id, OLD.calendar_item_id);
  IF v_item_id IS NULL THEN RETURN NEW; END IF;

  v_new_status := public.compute_calendar_item_aggregate_status(v_item_id);
  IF v_new_status IS NULL THEN RETURN NEW; END IF;

  -- Build platform summary
  SELECT jsonb_object_agg(platform, jsonb_build_object(
    'status', status,
    'published_at', published_at,
    'error', last_error_message,
    'error_code', last_error_code,
    'attempts', attempt_count,
    'has_retry', CASE WHEN next_retry_at IS NOT NULL THEN true ELSE false END
  ))
  INTO v_summary
  FROM (
    SELECT DISTINCT ON (platform) platform, status, published_at, last_error_message, last_error_code, attempt_count, next_retry_at
    FROM public.social_posts
    WHERE calendar_item_id = v_item_id
      AND status NOT IN ('superseded', 'canceled')
    ORDER BY platform, created_at DESC
  ) sub;

  UPDATE public.media_calendar_items
  SET status = v_new_status::media_item_status,
      platform_summary = COALESCE(v_summary, '{}'::jsonb),
      published_at = CASE WHEN v_new_status = 'published' THEN now() ELSE published_at END
  WHERE id = v_item_id;

  RETURN NEW;
END;
$$;

-- 6. Create trigger on social_posts
DROP TRIGGER IF EXISTS trg_sync_calendar_item_status ON public.social_posts;
CREATE TRIGGER trg_sync_calendar_item_status
  AFTER INSERT OR UPDATE OF status, last_error_code, attempt_count, next_retry_at, published_at
  ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_calendar_item_status();
