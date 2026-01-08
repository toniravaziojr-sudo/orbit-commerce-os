-- Create function to update import job batch progress
CREATE OR REPLACE FUNCTION public.update_import_job_batch(
  p_job_id UUID,
  p_batch_processed INTEGER,
  p_batch_imported INTEGER,
  p_batch_failed INTEGER,
  p_batch_skipped INTEGER,
  p_errors JSONB DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_progress JSONB;
  current_stats JSONB;
BEGIN
  -- Get current values
  SELECT progress, stats INTO current_progress, current_stats
  FROM import_jobs
  WHERE id = p_job_id;

  -- Update with accumulated values
  UPDATE import_jobs
  SET
    progress = COALESCE(current_progress, '{}'::jsonb) || jsonb_build_object(
      'processed', COALESCE((current_progress->>'processed')::integer, 0) + p_batch_processed,
      'last_batch_at', NOW()
    ),
    stats = COALESCE(current_stats, '{}'::jsonb) || jsonb_build_object(
      'imported', COALESCE((current_stats->>'imported')::integer, 0) + p_batch_imported,
      'failed', COALESCE((current_stats->>'failed')::integer, 0) + p_batch_failed,
      'skipped', COALESCE((current_stats->>'skipped')::integer, 0) + p_batch_skipped
    ),
    errors = CASE 
      WHEN jsonb_array_length(p_errors) > 0 
      THEN COALESCE(errors, '[]'::jsonb) || p_errors
      ELSE errors
    END,
    status = 'processing'
  WHERE id = p_job_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_import_job_batch TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_import_job_batch TO service_role;