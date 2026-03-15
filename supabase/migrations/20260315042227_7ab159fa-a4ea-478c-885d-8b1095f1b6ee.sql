
-- =============================================
-- SELECTIVE MIGRATION: Fix legacy Section props around Banners
-- Criteria: Only update Sections with legacy inherited values
-- Legacy pattern: paddingY IN (32, 48), paddingX IN (0, 16), fullWidth absent or false
-- Only when Section has a Banner child
-- =============================================

-- Helper function to recursively fix Section nodes wrapping Banners
CREATE OR REPLACE FUNCTION pg_temp.fix_legacy_section_props(node jsonb) RETURNS jsonb AS $$
DECLARE
  children jsonb;
  child jsonb;
  new_children jsonb := '[]'::jsonb;
  has_banner boolean := false;
  i int;
  props jsonb;
  padding_y int;
  padding_x int;
  full_width boolean;
BEGIN
  IF node IS NULL OR node = 'null'::jsonb THEN RETURN node; END IF;
  
  children := node->'children';
  IF children IS NULL OR jsonb_typeof(children) != 'array' OR jsonb_array_length(children) = 0 THEN
    RETURN node;
  END IF;
  
  -- Check if this is a Section node
  IF node->>'type' = 'Section' THEN
    -- Check if any direct child is a Banner
    FOR i IN 0..jsonb_array_length(children)-1 LOOP
      IF children->i->>'type' IN ('Banner', 'HeroBanner') THEN
        has_banner := true;
        EXIT;
      END IF;
    END LOOP;
    
    IF has_banner THEN
      props := COALESCE(node->'props', '{}'::jsonb);
      padding_y := COALESCE((props->>'paddingY')::int, 32);
      padding_x := COALESCE((props->>'paddingX')::int, 16);
      full_width := COALESCE((props->>'fullWidth')::boolean, false);
      
      -- Only fix if values match legacy defaults (not user-customized)
      IF padding_y IN (32, 48) AND padding_x IN (0, 16) AND NOT full_width THEN
        props := props || '{"paddingY": 0, "paddingX": 0, "fullWidth": true}'::jsonb;
        node := jsonb_set(node, '{props}', props);
      END IF;
    END IF;
  END IF;
  
  -- Recurse into all children regardless
  FOR i IN 0..jsonb_array_length(children)-1 LOOP
    child := pg_temp.fix_legacy_section_props(children->i);
    new_children := new_children || jsonb_build_array(child);
  END LOOP;
  
  node := jsonb_set(node, '{children}', new_children);
  RETURN node;
END;
$$ LANGUAGE plpgsql;

-- Fix store_pages (content + draft_content)
UPDATE public.store_pages
SET 
  content = pg_temp.fix_legacy_section_props(content),
  draft_content = CASE 
    WHEN draft_content IS NOT NULL THEN pg_temp.fix_legacy_section_props(draft_content)
    ELSE draft_content
  END
WHERE 
  (content::text LIKE '%"Banner"%' OR content::text LIKE '%"HeroBanner"%'
   OR draft_content::text LIKE '%"Banner"%' OR draft_content::text LIKE '%"HeroBanner"%');

-- Fix storefront_template_sets (draft_content + published_content)
UPDATE public.storefront_template_sets
SET
  draft_content = CASE
    WHEN draft_content IS NOT NULL THEN (
      SELECT jsonb_object_agg(
        key,
        pg_temp.fix_legacy_section_props(value)
      )
      FROM jsonb_each(draft_content)
    )
    ELSE draft_content
  END,
  published_content = CASE
    WHEN published_content IS NOT NULL THEN (
      SELECT jsonb_object_agg(
        key,
        pg_temp.fix_legacy_section_props(value)
      )
      FROM jsonb_each(published_content)
    )
    ELSE published_content
  END
WHERE
  (draft_content::text LIKE '%"Banner"%' OR draft_content::text LIKE '%"HeroBanner"%'
   OR published_content::text LIKE '%"Banner"%' OR published_content::text LIKE '%"HeroBanner"%');

-- Also fix the initialize_system_pages function for future tenants
-- (system pages don't have banners, but normalize the Section defaults)
CREATE OR REPLACE FUNCTION public.initialize_system_pages(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tracking_content JSONB;
  v_blog_content JSONB;
BEGIN
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
        "props": {"paddingY": 0, "paddingX": 0, "fullWidth": true},
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
        "props": {"paddingY": 0, "paddingX": 0, "fullWidth": true},
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

  INSERT INTO public.store_pages (
    tenant_id, title, slug, type, status, content, is_published, is_system, seo_title, seo_description
  )
  VALUES (
    p_tenant_id, 'Rastreio', 'rastreio', 'system', 'published',
    v_tracking_content, true, true, 'Rastrear Pedido', 'Acompanhe o status da sua entrega'
  )
  ON CONFLICT (tenant_id, slug) DO UPDATE SET
    is_system = true,
    content = COALESCE(store_pages.content, EXCLUDED.content);

  INSERT INTO public.store_pages (
    tenant_id, title, slug, type, status, content, is_published, is_system, seo_title, seo_description
  )
  VALUES (
    p_tenant_id, 'Blog', 'blog', 'system', 'published',
    v_blog_content, true, true, 'Blog', 'Novidades e dicas da nossa loja'
  )
  ON CONFLICT (tenant_id, slug) DO UPDATE SET
    is_system = true,
    content = COALESCE(store_pages.content, EXCLUDED.content);
END;
$function$;

-- Also update the default page template function
CREATE OR REPLACE FUNCTION public.initialize_default_page_template(p_tenant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_template_id uuid;
BEGIN
  SELECT id INTO v_template_id
  FROM public.page_templates
  WHERE tenant_id = p_tenant_id AND is_default = true
  LIMIT 1;
  
  IF v_template_id IS NULL THEN
    INSERT INTO public.page_templates (
      tenant_id, name, slug, description, content, is_default, is_system
    ) VALUES (
      p_tenant_id,
      'Modelo Padrão',
      'padrao',
      'Template padrão para páginas institucionais com Header, área de conteúdo e Footer.',
      '{"id":"root","type":"Page","props":{},"children":[{"id":"header-slot","type":"Header","props":{"menuId":"","showSearch":true,"showCart":true,"sticky":true}},{"id":"content-slot","type":"Section","props":{"paddingY":0,"paddingX":0,"fullWidth":true},"children":[{"id":"content-container","type":"Container","props":{"maxWidth":"md","centered":true},"children":[{"id":"page-content","type":"PageContent","props":{}}]}]},{"id":"footer-slot","type":"Footer","props":{"menuId":"","showSocial":true}}]}'::jsonb,
      true,
      true
    ) RETURNING id INTO v_template_id;
  END IF;
  
  RETURN v_template_id;
END;
$function$;
