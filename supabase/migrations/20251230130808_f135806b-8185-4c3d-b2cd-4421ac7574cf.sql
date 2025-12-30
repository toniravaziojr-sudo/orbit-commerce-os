-- =============================================
-- BLOG POSTS TABLE + SYSTEM PAGES SEED
-- =============================================

-- 1. Create blog_posts table
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content JSONB,
  featured_image_url TEXT,
  featured_image_alt TEXT,
  seo_title TEXT,
  seo_description TEXT,
  seo_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  author_id UUID,
  tags TEXT[],
  read_time_minutes INTEGER,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public can read published posts only
CREATE POLICY "Public can read published blog posts"
  ON public.blog_posts
  FOR SELECT
  USING (status = 'published');

-- Tenant members can manage their own posts
CREATE POLICY "Tenant members can manage blog posts"
  ON public.blog_posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.tenant_id = blog_posts.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.tenant_id = blog_posts.tenant_id
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant_status ON public.blog_posts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant_slug ON public.blog_posts(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts(published_at DESC) WHERE status = 'published';

-- 2. Add is_system column to store_pages for system pages (rastreio, blog)
ALTER TABLE public.store_pages 
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- 3. Create unique index on (tenant_id, slug) for store_pages to support upsert
-- Drop conflicting index if exists and create new one
DROP INDEX IF EXISTS idx_store_pages_tenant_slug_unique;
CREATE UNIQUE INDEX idx_store_pages_tenant_slug_unique ON public.store_pages(tenant_id, slug);

-- 4. Create a function to seed system pages for a tenant
CREATE OR REPLACE FUNCTION public.initialize_system_pages(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tracking_content JSONB;
  v_blog_content JSONB;
BEGIN
  -- Default tracking page content (with TrackingLookup block)
  v_tracking_content := '{
    "id": "tracking-page-root",
    "type": "Page",
    "props": {},
    "children": [
      {
        "id": "tracking-header",
        "type": "Header",
        "props": {}
      },
      {
        "id": "tracking-section",
        "type": "Section",
        "props": {"paddingY": 48},
        "children": [
          {
            "id": "tracking-lookup",
            "type": "TrackingLookup",
            "props": {
              "title": "Rastrear Pedido",
              "description": "Acompanhe o status da sua entrega"
            }
          }
        ]
      },
      {
        "id": "tracking-footer",
        "type": "Footer",
        "props": {}
      }
    ]
  }'::JSONB;

  -- Default blog index page content (with BlogListing block)
  v_blog_content := '{
    "id": "blog-page-root",
    "type": "Page",
    "props": {},
    "children": [
      {
        "id": "blog-header",
        "type": "Header",
        "props": {}
      },
      {
        "id": "blog-section",
        "type": "Section",
        "props": {"paddingY": 48},
        "children": [
          {
            "id": "blog-listing",
            "type": "BlogListing",
            "props": {
              "title": "Blog",
              "description": "Novidades e dicas",
              "postsPerPage": 9
            }
          }
        ]
      },
      {
        "id": "blog-footer",
        "type": "Footer",
        "props": {}
      }
    ]
  }'::JSONB;

  -- Insert tracking page (system) - upsert
  INSERT INTO public.store_pages (
    tenant_id, 
    title, 
    slug, 
    type, 
    status, 
    content, 
    is_published, 
    is_system,
    seo_title,
    seo_description
  )
  VALUES (
    p_tenant_id,
    'Rastreio',
    'rastreio',
    'system',
    'published',
    v_tracking_content,
    true,
    true,
    'Rastrear Pedido',
    'Acompanhe o status da sua entrega'
  )
  ON CONFLICT (tenant_id, slug) DO UPDATE SET
    is_system = true,
    content = COALESCE(store_pages.content, EXCLUDED.content);

  -- Insert blog index page (system) - upsert
  INSERT INTO public.store_pages (
    tenant_id, 
    title, 
    slug, 
    type, 
    status, 
    content, 
    is_published, 
    is_system,
    seo_title,
    seo_description
  )
  VALUES (
    p_tenant_id,
    'Blog',
    'blog',
    'system',
    'published',
    v_blog_content,
    true,
    true,
    'Blog',
    'Novidades e dicas da nossa loja'
  )
  ON CONFLICT (tenant_id, slug) DO UPDATE SET
    is_system = true,
    content = COALESCE(store_pages.content, EXCLUDED.content);
END;
$$;

-- 5. Seed system pages for ALL existing tenants
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.initialize_system_pages(r.id);
  END LOOP;
END;
$$;

-- 6. Add trigger to auto-create system pages for new tenants
CREATE OR REPLACE FUNCTION public.create_system_pages_for_new_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.initialize_system_pages(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_system_pages ON public.tenants;
CREATE TRIGGER trigger_create_system_pages
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_system_pages_for_new_tenant();