
CREATE OR REPLACE FUNCTION public.atomic_activate_prerender_version(
  p_tenant_id uuid,
  p_publish_version bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stale_count INTEGER;
  v_active_count INTEGER;
BEGIN
  -- Within a single transaction (guaranteed by PL/pgSQL):
  
  -- Step 1: Mark all currently active pages as stale
  UPDATE storefront_prerendered_pages
  SET status = 'stale'
  WHERE tenant_id = p_tenant_id
    AND status = 'active';
  GET DIAGNOSTICS v_stale_count = ROW_COUNT;
  
  -- Step 2: Activate all pending pages from this publish version
  UPDATE storefront_prerendered_pages
  SET status = 'active'
  WHERE tenant_id = p_tenant_id
    AND publish_version = p_publish_version
    AND status = 'pending';
  GET DIAGNOSTICS v_active_count = ROW_COUNT;
  
  -- Safety check: if Step 2 activated ZERO pages, rollback Step 1
  -- by re-activating the pages we just staled
  IF v_active_count = 0 AND v_stale_count > 0 THEN
    UPDATE storefront_prerendered_pages
    SET status = 'active'
    WHERE tenant_id = p_tenant_id
      AND status = 'stale'
      AND publish_version != p_publish_version;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No pending pages found for this version, rollback applied',
      'stale_rolled_back', v_stale_count
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'deactivated', v_stale_count,
    'activated', v_active_count
  );
END;
$$;
