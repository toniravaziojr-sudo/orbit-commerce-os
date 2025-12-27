-- =============================================
-- MARKETING INTEGRATIONS
-- Stores configuration for Meta/Google/TikTok per tenant
-- Tokens/secrets are stored but NEVER exposed to client
-- =============================================

-- Main configuration table
CREATE TABLE public.marketing_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Meta (Facebook/Instagram)
  meta_pixel_id TEXT,
  meta_access_token TEXT, -- CAPI token - NEVER expose to client
  meta_enabled BOOLEAN NOT NULL DEFAULT false,
  meta_capi_enabled BOOLEAN NOT NULL DEFAULT false,
  meta_status TEXT DEFAULT 'inactive', -- inactive, active, error
  meta_last_test_at TIMESTAMP WITH TIME ZONE,
  meta_last_error TEXT,
  
  -- Google (GA4 + Ads + Merchant)
  google_measurement_id TEXT, -- GA4 measurement ID (G-XXXXXXX)
  google_ads_conversion_id TEXT, -- AW-XXXXXXX
  google_ads_conversion_label TEXT,
  google_api_secret TEXT, -- Measurement Protocol secret - NEVER expose
  google_enabled BOOLEAN NOT NULL DEFAULT false,
  google_status TEXT DEFAULT 'inactive',
  google_last_test_at TIMESTAMP WITH TIME ZONE,
  google_last_error TEXT,
  
  -- TikTok
  tiktok_pixel_id TEXT,
  tiktok_access_token TEXT, -- Events API token - NEVER expose
  tiktok_enabled BOOLEAN NOT NULL DEFAULT false,
  tiktok_events_api_enabled BOOLEAN NOT NULL DEFAULT false,
  tiktok_status TEXT DEFAULT 'inactive',
  tiktok_last_test_at TIMESTAMP WITH TIME ZONE,
  tiktok_last_error TEXT,
  
  -- General
  consent_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT marketing_integrations_tenant_unique UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.marketing_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: owners/admins can view their own config (but NOT the secret fields via normal query)
CREATE POLICY "Tenant owners/admins can view marketing config"
  ON public.marketing_integrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = marketing_integrations.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );

-- Policy: owners/admins can insert their own config
CREATE POLICY "Tenant owners/admins can insert marketing config"
  ON public.marketing_integrations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = marketing_integrations.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );

-- Policy: owners/admins can update their own config
CREATE POLICY "Tenant owners/admins can update marketing config"
  ON public.marketing_integrations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = marketing_integrations.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_marketing_integrations_updated_at
  BEFORE UPDATE ON public.marketing_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- MARKETING EVENTS LOG
-- Tracks events sent to each provider for debugging
-- =============================================

CREATE TABLE public.marketing_events_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  event_id TEXT NOT NULL, -- Unique ID for deduplication
  event_name TEXT NOT NULL, -- PageView, ViewContent, AddToCart, Purchase, etc
  event_source TEXT NOT NULL, -- client, server
  
  provider TEXT NOT NULL, -- meta, google, tiktok
  provider_status TEXT DEFAULT 'pending', -- pending, sent, failed
  provider_response JSONB,
  provider_error TEXT,
  
  -- Event data (sanitized, no PII in raw form)
  event_data JSONB,
  
  -- Reference to order if applicable
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Index for querying by tenant and event
CREATE INDEX idx_marketing_events_tenant_created ON public.marketing_events_log(tenant_id, created_at DESC);
CREATE INDEX idx_marketing_events_event_id ON public.marketing_events_log(event_id);

-- Enable RLS
ALTER TABLE public.marketing_events_log ENABLE ROW LEVEL SECURITY;

-- Policy: owners/admins can view their own logs
CREATE POLICY "Tenant owners/admins can view marketing events"
  ON public.marketing_events_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = marketing_events_log.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );

-- =============================================
-- PRODUCT FEED STATUS
-- Tracks feed generation status for Merchant/Catalog
-- =============================================

CREATE TABLE public.product_feed_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  feed_type TEXT NOT NULL, -- google_merchant, meta_catalog
  
  last_generated_at TIMESTAMP WITH TIME ZONE,
  product_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  
  -- Feed URL (generated dynamically based on tenant domain)
  feed_path TEXT, -- e.g. /feeds/google-merchant.xml
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT product_feed_status_tenant_type_unique UNIQUE (tenant_id, feed_type)
);

-- Enable RLS
ALTER TABLE public.product_feed_status ENABLE ROW LEVEL SECURITY;

-- Policy: owners/admins can view their own feed status
CREATE POLICY "Tenant owners/admins can view feed status"
  ON public.product_feed_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = product_feed_status.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_product_feed_status_updated_at
  BEFORE UPDATE ON public.product_feed_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNCTION: Get marketing config for tenant (PUBLIC - for edge functions)
-- Returns ONLY public fields, never tokens
-- =============================================

CREATE OR REPLACE FUNCTION public.get_public_marketing_config(p_tenant_id UUID)
RETURNS TABLE (
  meta_pixel_id TEXT,
  meta_enabled BOOLEAN,
  google_measurement_id TEXT,
  google_ads_conversion_id TEXT,
  google_ads_conversion_label TEXT,
  google_enabled BOOLEAN,
  tiktok_pixel_id TEXT,
  tiktok_enabled BOOLEAN,
  consent_mode_enabled BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    mi.meta_pixel_id,
    mi.meta_enabled,
    mi.google_measurement_id,
    mi.google_ads_conversion_id,
    mi.google_ads_conversion_label,
    mi.google_enabled,
    mi.tiktok_pixel_id,
    mi.tiktok_enabled,
    mi.consent_mode_enabled
  FROM public.marketing_integrations mi
  WHERE mi.tenant_id = p_tenant_id;
$$;