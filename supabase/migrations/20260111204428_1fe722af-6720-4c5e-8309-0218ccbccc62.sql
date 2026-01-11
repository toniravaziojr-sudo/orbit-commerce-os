-- ============================================
-- Migration: import_items UNIQUE constraint (tenant_id, module, external_id)
-- Purpose: Ensure idempotency for category imports
-- ============================================

-- Step 1: Remove duplicate records (keep most recent by created_at DESC, id DESC)
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, module, external_id 
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.import_items
  WHERE external_id IS NOT NULL
)
DELETE FROM public.import_items
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Add UNIQUE constraint for idempotent upserts
ALTER TABLE public.import_items 
ADD CONSTRAINT import_items_tenant_module_external_unique 
UNIQUE (tenant_id, module, external_id);

-- Step 3: Add index for internal_id lookups (used in tenant-clear-data)
CREATE INDEX IF NOT EXISTS idx_import_items_internal 
ON public.import_items (tenant_id, module, internal_id);

-- Step 4: Add index for job_id lookups (improve query performance)
CREATE INDEX IF NOT EXISTS idx_import_items_job 
ON public.import_items (job_id);

-- ============================================
-- RPC: update_import_job_module
-- Purpose: Atomically update progress/stats for a specific module
-- Security: ONLY service_role can execute (Edge Functions)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_import_job_module(
  p_job_id UUID,
  p_module TEXT,
  p_current INTEGER,
  p_total INTEGER,
  p_imported INTEGER DEFAULT 0,
  p_updated INTEGER DEFAULT 0,
  p_skipped INTEGER DEFAULT 0,
  p_failed INTEGER DEFAULT 0,
  p_errors JSONB DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  module_progress JSONB;
  module_stats JSONB;
BEGIN
  -- Build module-specific progress object
  module_progress := jsonb_build_object(
    'current', p_current,
    'total', p_total,
    'last_updated', NOW()
  );
  
  -- Build module-specific stats object
  module_stats := jsonb_build_object(
    'imported', p_imported,
    'updated', p_updated,
    'skipped', p_skipped,
    'failed', p_failed
  );

  -- ATOMIC UPDATE (no prior SELECT) - prevents race conditions
  UPDATE import_jobs
  SET
    progress = COALESCE(progress, '{}'::jsonb) || 
               jsonb_build_object(p_module, module_progress),
    stats = COALESCE(stats, '{}'::jsonb) || 
            jsonb_build_object(p_module, module_stats),
    errors = CASE 
      WHEN jsonb_array_length(p_errors) > 0 
      THEN COALESCE(errors, '[]'::jsonb) || p_errors
      ELSE errors
    END,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;

-- CRITICAL: Only service_role can call this (Edge Functions use service role)
-- Do NOT grant to authenticated - prevents multi-tenant bypass
REVOKE ALL ON FUNCTION public.update_import_job_module FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_import_job_module FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_import_job_module TO service_role;