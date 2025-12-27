-- =============================================
-- ORDER ATTRIBUTION TABLE
-- Tracks the source of each conversion/sale
-- =============================================

-- Create order_attribution table
CREATE TABLE public.order_attribution (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  
  -- UTM Parameters
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  
  -- Click IDs from ad platforms
  gclid TEXT,           -- Google Ads click ID
  fbclid TEXT,          -- Facebook/Instagram click ID
  ttclid TEXT,          -- TikTok click ID
  msclkid TEXT,         -- Microsoft Ads click ID
  
  -- Referrer info
  referrer_url TEXT,
  referrer_domain TEXT,
  
  -- Landing page
  landing_page TEXT,
  
  -- Derived attribution source (computed)
  attribution_source TEXT,  -- 'google_ads', 'facebook', 'instagram', 'tiktok', 'google_organic', 'direct', 'referral', 'email', etc.
  attribution_medium TEXT,  -- 'cpc', 'organic', 'social', 'referral', 'email', 'direct'
  
  -- Session info
  session_id TEXT,
  first_touch_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint
  CONSTRAINT order_attribution_order_unique UNIQUE (order_id)
);

-- Create indexes
CREATE INDEX idx_order_attribution_tenant ON public.order_attribution(tenant_id);
CREATE INDEX idx_order_attribution_source ON public.order_attribution(tenant_id, attribution_source);
CREATE INDEX idx_order_attribution_created ON public.order_attribution(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.order_attribution ENABLE ROW LEVEL SECURITY;

-- RLS Policies - tenant members can read their own data
CREATE POLICY "Tenant members can view attribution" 
ON public.order_attribution 
FOR SELECT 
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Service role can insert/update (via edge functions)
CREATE POLICY "Service role can manage attribution" 
ON public.order_attribution 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Anon can insert (for checkout flow)
CREATE POLICY "Anon can insert attribution" 
ON public.order_attribution 
FOR INSERT 
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_order_attribution_updated_at
BEFORE UPDATE ON public.order_attribution
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add attribution_data column to checkout_sessions if not exists
ALTER TABLE public.checkout_sessions 
ADD COLUMN IF NOT EXISTS attribution_data JSONB;