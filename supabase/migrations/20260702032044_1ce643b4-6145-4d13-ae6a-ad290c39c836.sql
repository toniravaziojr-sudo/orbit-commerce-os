DROP VIEW IF EXISTS public.v_seo_coverage_products         CASCADE;
DROP VIEW IF EXISTS public.v_seo_coverage_categories       CASCADE;
DROP VIEW IF EXISTS public.v_seo_coverage_storefront_pages CASCADE;
DROP VIEW IF EXISTS public.v_seo_coverage_landing_pages    CASCADE;
DROP VIEW IF EXISTS public.v_seo_coverage_blog_posts       CASCADE;
DROP VIEW IF EXISTS public.v_seo_store_foundation          CASCADE;

CREATE VIEW public.v_seo_coverage_products
WITH (security_invoker = true) AS
SELECT p.tenant_id, p.id, p.slug, p.seo_title, p.seo_description,
  (p.seo_title IS NOT NULL AND length(btrim(p.seo_title)) > 0) AS has_title,
  (p.seo_description IS NOT NULL AND length(btrim(p.seo_description)) > 0) AS has_description,
  length(COALESCE(p.seo_title, ''::text)) AS title_len,
  length(COALESCE(p.seo_description, ''::text)) AS description_len
FROM public.products p
WHERE p.status = 'active' AND p.deleted_at IS NULL
  AND public.user_has_tenant_access(p.tenant_id);

CREATE VIEW public.v_seo_coverage_categories
WITH (security_invoker = true) AS
SELECT c.tenant_id, c.id, c.slug, c.seo_title, c.seo_description,
  (c.seo_title IS NOT NULL AND length(btrim(c.seo_title)) > 0) AS has_title,
  (c.seo_description IS NOT NULL AND length(btrim(c.seo_description)) > 0) AS has_description,
  length(COALESCE(c.seo_title, ''::text)) AS title_len,
  length(COALESCE(c.seo_description, ''::text)) AS description_len
FROM public.categories c
WHERE c.is_active = true
  AND public.user_has_tenant_access(c.tenant_id);

CREATE VIEW public.v_seo_coverage_storefront_pages
WITH (security_invoker = true) AS
SELECT sp.tenant_id, sp.id, sp.slug, sp.type,
  COALESCE(sp.meta_title, sp.seo_title) AS effective_title,
  COALESCE(sp.meta_description, sp.seo_description) AS effective_description,
  (COALESCE(sp.meta_title, sp.seo_title) IS NOT NULL AND length(btrim(COALESCE(sp.meta_title, sp.seo_title))) > 0) AS has_title,
  (COALESCE(sp.meta_description, sp.seo_description) IS NOT NULL AND length(btrim(COALESCE(sp.meta_description, sp.seo_description))) > 0) AS has_description,
  length(COALESCE(COALESCE(sp.meta_title, sp.seo_title), ''::text)) AS title_len,
  length(COALESCE(COALESCE(sp.meta_description, sp.seo_description), ''::text)) AS description_len
FROM public.store_pages sp
WHERE sp.is_published = true
  AND COALESCE(sp.no_index, false) = false
  AND COALESCE(sp.type, '') <> 'landing_page'
  AND public.user_has_tenant_access(sp.tenant_id);

CREATE VIEW public.v_seo_coverage_landing_pages
WITH (security_invoker = true) AS
SELECT sp.tenant_id, sp.id, sp.slug,
  COALESCE(sp.meta_title, sp.seo_title) AS effective_title,
  COALESCE(sp.meta_description, sp.seo_description) AS effective_description,
  (COALESCE(sp.meta_title, sp.seo_title) IS NOT NULL AND length(btrim(COALESCE(sp.meta_title, sp.seo_title))) > 0) AS has_title,
  (COALESCE(sp.meta_description, sp.seo_description) IS NOT NULL AND length(btrim(COALESCE(sp.meta_description, sp.seo_description))) > 0) AS has_description,
  length(COALESCE(COALESCE(sp.meta_title, sp.seo_title), ''::text)) AS title_len,
  length(COALESCE(COALESCE(sp.meta_description, sp.seo_description), ''::text)) AS description_len,
  COALESCE(sp.no_index, false) AS no_index
FROM public.store_pages sp
WHERE sp.is_published = true
  AND COALESCE(sp.type, '') = 'landing_page'
  AND public.user_has_tenant_access(sp.tenant_id);

CREATE VIEW public.v_seo_coverage_blog_posts
WITH (security_invoker = true) AS
SELECT bp.tenant_id, bp.id, bp.slug, bp.seo_title, bp.seo_description,
  (bp.seo_title IS NOT NULL AND length(btrim(bp.seo_title)) > 0) AS has_title,
  (bp.seo_description IS NOT NULL AND length(btrim(bp.seo_description)) > 0) AS has_description,
  length(COALESCE(bp.seo_title, ''::text)) AS title_len,
  length(COALESCE(bp.seo_description, ''::text)) AS description_len
FROM public.blog_posts bp
WHERE bp.status = 'published'
  AND public.user_has_tenant_access(bp.tenant_id);

CREATE VIEW public.v_seo_store_foundation
WITH (security_invoker = true) AS
SELECT ss.tenant_id,
  (ss.favicon_url IS NOT NULL AND length(btrim(ss.favicon_url)) > 0) AS has_favicon,
  (ss.logo_url IS NOT NULL AND length(btrim(ss.logo_url)) > 0) AS has_logo,
  (ss.seo_title IS NOT NULL AND length(btrim(ss.seo_title)) > 0) AS has_default_seo_title,
  (ss.seo_description IS NOT NULL AND length(btrim(ss.seo_description)) > 0) AS has_default_seo_description,
  EXISTS (
    SELECT 1 FROM public.tenant_domains td
    WHERE td.tenant_id = ss.tenant_id AND td.is_primary = true AND td.verified_at IS NOT NULL
  ) AS has_verified_primary_domain,
  EXISTS (
    SELECT 1 FROM public.tenant_domains td
    WHERE td.tenant_id = ss.tenant_id AND td.ssl_status = 'active'
  ) AS has_active_ssl
FROM public.store_settings ss
WHERE public.user_has_tenant_access(ss.tenant_id);

REVOKE ALL ON public.v_seo_coverage_products         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_seo_coverage_categories       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_seo_coverage_storefront_pages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_seo_coverage_landing_pages    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_seo_coverage_blog_posts       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_seo_store_foundation          FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.v_seo_coverage_products         TO authenticated, service_role;
GRANT SELECT ON public.v_seo_coverage_categories       TO authenticated, service_role;
GRANT SELECT ON public.v_seo_coverage_storefront_pages TO authenticated, service_role;
GRANT SELECT ON public.v_seo_coverage_landing_pages    TO authenticated, service_role;
GRANT SELECT ON public.v_seo_coverage_blog_posts       TO authenticated, service_role;
GRANT SELECT ON public.v_seo_store_foundation          TO authenticated, service_role;

COMMENT ON VIEW public.v_seo_coverage_products IS 'Central de SEO (Onda 2.A). security_invoker + guarda user_has_tenant_access. Sem anon.';
COMMENT ON VIEW public.v_seo_coverage_categories IS 'Central de SEO (Onda 2.A). security_invoker + guarda user_has_tenant_access. Sem anon.';
COMMENT ON VIEW public.v_seo_coverage_storefront_pages IS 'Central de SEO (Onda 2.A). security_invoker + guarda user_has_tenant_access. Sem anon.';
COMMENT ON VIEW public.v_seo_coverage_landing_pages IS 'Central de SEO (Onda 2.A). security_invoker + guarda user_has_tenant_access. Sem anon.';
COMMENT ON VIEW public.v_seo_coverage_blog_posts IS 'Central de SEO (Onda 2.A). security_invoker + guarda user_has_tenant_access. Sem anon.';
COMMENT ON VIEW public.v_seo_store_foundation IS 'Central de SEO (Onda 2.A). security_invoker + guarda user_has_tenant_access. Sem anon.';
