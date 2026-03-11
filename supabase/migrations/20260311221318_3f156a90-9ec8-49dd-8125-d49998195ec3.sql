-- Storefront visit tracking (internal analytics)
CREATE TABLE public.storefront_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visitor_id text NOT NULL, -- anonymous session/cookie ID
  page_path text NOT NULL DEFAULT '/',
  page_type text, -- 'home', 'product', 'category', 'page', 'blog'
  referrer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for dashboard queries (tenant + date range)
CREATE INDEX idx_storefront_visits_tenant_date 
  ON public.storefront_visits (tenant_id, created_at DESC);

-- Index for unique visitor counting
CREATE INDEX idx_storefront_visits_tenant_visitor 
  ON public.storefront_visits (tenant_id, visitor_id, created_at);

-- Enable RLS
ALTER TABLE public.storefront_visits ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (tracking beacon from storefront)
CREATE POLICY "Allow anonymous inserts for tracking"
  ON public.storefront_visits FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to read their tenant's visits  
CREATE POLICY "Tenant users can read visits"
  ON public.storefront_visits FOR SELECT
  TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id)
  );

-- Auto-cleanup: partition by month or use a retention policy
-- For now, we'll handle cleanup via cron later