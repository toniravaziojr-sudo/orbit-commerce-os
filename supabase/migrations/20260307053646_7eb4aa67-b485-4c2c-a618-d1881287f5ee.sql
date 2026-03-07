-- =============================================
-- STOREFRONT PRE-RENDERED PAGES
-- Stores HTML output generated server-side from
-- the same published_content JSON used by the builder.
-- Edge Function serves this directly for fast TTFB.
-- =============================================

CREATE TABLE public.storefront_prerendered_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  path text NOT NULL,
  page_type text NOT NULL DEFAULT 'home',
  html_content text NOT NULL,
  css_content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  entity_id uuid,
  publish_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  error_message text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_prerendered_pages_tenant_path_key UNIQUE (tenant_id, path)
);

CREATE INDEX idx_prerendered_pages_tenant_status 
  ON public.storefront_prerendered_pages(tenant_id, status);
CREATE INDEX idx_prerendered_pages_tenant_type 
  ON public.storefront_prerendered_pages(tenant_id, page_type);
CREATE INDEX idx_prerendered_pages_entity 
  ON public.storefront_prerendered_pages(tenant_id, entity_id) 
  WHERE entity_id IS NOT NULL;

ALTER TABLE public.storefront_prerendered_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant prerendered pages"
  ON public.storefront_prerendered_pages
  FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER update_prerendered_pages_updated_at
  BEFORE UPDATE ON public.storefront_prerendered_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Pre-render job queue for tracking async generation
CREATE TABLE public.storefront_prerender_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  trigger_type text NOT NULL DEFAULT 'publish',
  total_pages integer NOT NULL DEFAULT 0,
  processed_pages integer NOT NULL DEFAULT 0,
  failed_pages integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prerender_jobs_tenant_status 
  ON public.storefront_prerender_jobs(tenant_id, status);

ALTER TABLE public.storefront_prerender_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant prerender jobs"
  ON public.storefront_prerender_jobs
  FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER update_prerender_jobs_updated_at
  BEFORE UPDATE ON public.storefront_prerender_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();