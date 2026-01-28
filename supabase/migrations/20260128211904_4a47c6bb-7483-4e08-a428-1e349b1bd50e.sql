-- ================================================
-- YOUTUBE PRODUCTION ROLLOUT MIGRATION
-- ================================================

-- Feature flag for YouTube global rollout
INSERT INTO public.billing_feature_flags (flag_key, is_enabled, description, metadata)
VALUES (
  'youtube_enabled_for_all_tenants',
  false,
  'Habilita YouTube para todos os tenants. Enquanto false, apenas tenant admin tem acesso. Deve ser true apenas após OAuth estar verificado pelo Google.',
  '{"rollout_status": "testing", "notes": "OAuth Consent Screen em Testing mode - apenas test users cadastrados no Google Cloud Console podem autorizar"}'::jsonb
)
ON CONFLICT (flag_key) DO UPDATE SET
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Add oauth_error_code column to youtube_connections for better error tracking
ALTER TABLE public.youtube_connections
ADD COLUMN IF NOT EXISTS oauth_error_code TEXT,
ADD COLUMN IF NOT EXISTS oauth_error_details JSONB;

-- Add comment explaining oauth_error_code values
COMMENT ON COLUMN public.youtube_connections.oauth_error_code IS 
'OAuth error codes: access_denied (user cancelled), testing_mode_restriction (not a test user), unverified_app_cap (user limit reached), consent_required, token_refresh_failed';

-- Function to check if YouTube is available for a tenant
-- Uses user_roles to find owner and check if owner is platform admin
CREATE OR REPLACE FUNCTION public.is_youtube_available_for_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Platform admins always have access
    public.is_platform_admin()
    OR
    -- Check if global flag is enabled
    EXISTS (
      SELECT 1 FROM public.billing_feature_flags 
      WHERE flag_key = 'youtube_enabled_for_all_tenants' AND is_enabled = true
    )
    OR
    -- Check if tenant owner is a platform admin
    EXISTS (
      SELECT 1 
      FROM public.user_roles ur
      JOIN auth.users au ON au.id = ur.user_id
      JOIN public.platform_admins pa ON LOWER(pa.email) = LOWER(au.email)
      WHERE ur.tenant_id = p_tenant_id 
        AND ur.role = 'owner'
        AND pa.is_active = true
    )
$$;

-- Add better tracking for scheduled videos
ALTER TABLE public.youtube_uploads
ADD COLUMN IF NOT EXISTS scheduled_publish_at_utc TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_publish_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS publish_status TEXT DEFAULT 'pending';

-- Comment for publish_status
COMMENT ON COLUMN public.youtube_uploads.publish_status IS 
'Upload publish lifecycle: pending, scheduled, processing_youtube, published, failed_invalid_date, failed_quota';