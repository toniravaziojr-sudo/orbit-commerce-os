
-- ============================================
-- SECURITY REMEDIATION v3.1 — Msg 1: Phase 0 + Phase 1A
-- ============================================

-- =====================
-- PHASE 0A: Rate Limit Infrastructure (shared state)
-- =====================

CREATE TABLE IF NOT EXISTS public.rate_limit_entries (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

-- No RLS needed - only accessed via SECURITY DEFINER function
ALTER TABLE public.rate_limit_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit_entries (window_start);

-- Atomic rate limit check with cleanup
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_window_seconds INT DEFAULT 60,
  p_max_requests INT DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  -- Calculate window start (aligned to window boundary)
  v_window_start := to_timestamp(
    floor(EXTRACT(EPOCH FROM now()) / p_window_seconds) * p_window_seconds
  );

  -- Cleanup old entries (older than 2x window)
  DELETE FROM public.rate_limit_entries
  WHERE window_start < now() - (p_window_seconds * 2) * interval '1 second';

  -- Upsert current request
  INSERT INTO public.rate_limit_entries (key, window_start, request_count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE
  SET request_count = rate_limit_entries.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

-- Restrict: only service role / other SECURITY DEFINER functions can call
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM authenticated;

-- =====================
-- PHASE 0B: get_security_flag() with restricted EXECUTE
-- =====================

CREATE OR REPLACE FUNCTION public.get_security_flag(p_flag_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_enabled FROM public.billing_feature_flags WHERE flag_key = p_flag_key),
    false
  );
$$;

-- Restrict: not callable from frontend
REVOKE EXECUTE ON FUNCTION public.get_security_flag(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_security_flag(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_security_flag(TEXT) FROM authenticated;

-- =====================
-- PHASE 1A: Fix search_path on SECURITY DEFINER functions
-- =====================

-- FIX 1: sync_product_rating (CRITICAL - SECURITY DEFINER without search_path)
CREATE OR REPLACE FUNCTION public.sync_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_product_id uuid;
  new_avg numeric;
  new_count int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_product_id := OLD.product_id;
  ELSE
    target_product_id := NEW.product_id;
  END IF;

  SELECT 
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
    COALESCE(COUNT(*), 0)
  INTO new_avg, new_count
  FROM public.product_reviews
  WHERE product_id = target_product_id
    AND status = 'approved';

  UPDATE public.products
  SET avg_rating = new_avg, review_count = new_count
  WHERE id = target_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- FIX 2: migrate_existing_templates_to_sets (SECURITY DEFINER without search_path)
CREATE OR REPLACE FUNCTION public.migrate_existing_templates_to_sets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    tenant_record RECORD;
    new_template_id UUID;
    existing_content JSONB;
BEGIN
    FOR tenant_record IN 
        SELECT ss.tenant_id, ss.id as settings_id, ss.is_published
        FROM public.store_settings ss
        WHERE NOT EXISTS (
            SELECT 1 FROM public.storefront_template_sets sts 
            WHERE sts.tenant_id = ss.tenant_id
        )
    LOOP
        SELECT jsonb_build_object(
            'home', (SELECT content FROM public.store_page_versions spv 
                     JOIN public.storefront_page_templates spt ON spv.tenant_id = spt.tenant_id 
                     AND spv.page_type = spt.page_type
                     WHERE spt.tenant_id = tenant_record.tenant_id 
                     AND spt.page_type = 'home'
                     ORDER BY spv.version DESC LIMIT 1)
        ) INTO existing_content;
        
        IF existing_content IS NULL OR existing_content->>'home' IS NULL THEN
            existing_content := '{}'::jsonb;
        END IF;
        
        INSERT INTO public.storefront_template_sets (
            tenant_id, name, base_preset, draft_content, published_content, is_published
        ) VALUES (
            tenant_record.tenant_id, 'Template Padrão', 'cosmetics',
            existing_content,
            CASE WHEN tenant_record.is_published THEN existing_content ELSE NULL END,
            tenant_record.is_published
        ) RETURNING id INTO new_template_id;
        
        UPDATE public.store_settings 
        SET published_template_id = new_template_id
        WHERE tenant_id = tenant_record.tenant_id;
    END LOOP;
END;
$function$;

-- FIX 3: Non-SECURITY DEFINER trigger functions (good practice)
CREATE OR REPLACE FUNCTION public.update_product_components_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_storefront_template_sets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_youtube_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_video_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_newsletter_popup_configs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;
