CREATE OR REPLACE FUNCTION public.calc_seo_health(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prod_total int; v_prod_ok int;
  v_cat_total int;  v_cat_ok int;
  v_pg_total int;   v_pg_ok int;
  v_lp_total int;   v_lp_ok int;
  v_bp_total int;   v_bp_ok int;
  v_lp_noindex int;
  v_found record;
  v_score numeric := 0;
  v_factors jsonb := '[]'::jsonb;
  v_pending jsonb := '[]'::jsonb;
  v_dup_titles int := 0;

  -- pesos (soma = 100)
  w_products    numeric := 30;
  w_categories  numeric := 15;
  w_pages       numeric := 15;
  w_landing     numeric := 10;
  w_blog        numeric := 10;
  w_foundation  numeric := 20;

  f_score numeric := 0;
BEGIN
  -- Guarda de tenant (defesa em profundidade além da RLS das views)
  IF p_tenant_id IS NULL OR NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'access denied for tenant %', p_tenant_id
      USING ERRCODE = '42501';
  END IF;

  -- Contagens por entidade
  SELECT count(*), count(*) FILTER (WHERE has_title AND has_description)
    INTO v_prod_total, v_prod_ok
    FROM v_seo_coverage_products WHERE tenant_id = p_tenant_id;

  SELECT count(*), count(*) FILTER (WHERE has_title AND has_description)
    INTO v_cat_total, v_cat_ok
    FROM v_seo_coverage_categories WHERE tenant_id = p_tenant_id;

  SELECT count(*), count(*) FILTER (WHERE has_title AND has_description)
    INTO v_pg_total, v_pg_ok
    FROM v_seo_coverage_storefront_pages WHERE tenant_id = p_tenant_id;

  SELECT count(*), count(*) FILTER (WHERE has_title AND has_description AND NOT no_index)
    INTO v_lp_total, v_lp_ok
    FROM v_seo_coverage_landing_pages WHERE tenant_id = p_tenant_id;

  SELECT count(*) FILTER (WHERE no_index)
    INTO v_lp_noindex
    FROM v_seo_coverage_landing_pages WHERE tenant_id = p_tenant_id;

  SELECT count(*), count(*) FILTER (WHERE has_title AND has_description)
    INTO v_bp_total, v_bp_ok
    FROM v_seo_coverage_blog_posts WHERE tenant_id = p_tenant_id;

  SELECT * INTO v_found
    FROM v_seo_store_foundation WHERE tenant_id = p_tenant_id;

  -- Score por fator
  IF v_prod_total > 0 THEN
    f_score := (v_prod_ok::numeric / v_prod_total) * w_products;
  ELSE f_score := w_products; END IF;
  v_score := v_score + f_score;
  v_factors := v_factors || jsonb_build_object('key','products','weight',w_products,'score',round(f_score,2),'total',v_prod_total,'ok',v_prod_ok);

  IF v_cat_total > 0 THEN
    f_score := (v_cat_ok::numeric / v_cat_total) * w_categories;
  ELSE f_score := w_categories; END IF;
  v_score := v_score + f_score;
  v_factors := v_factors || jsonb_build_object('key','categories','weight',w_categories,'score',round(f_score,2),'total',v_cat_total,'ok',v_cat_ok);

  IF v_pg_total > 0 THEN
    f_score := (v_pg_ok::numeric / v_pg_total) * w_pages;
  ELSE f_score := w_pages; END IF;
  v_score := v_score + f_score;
  v_factors := v_factors || jsonb_build_object('key','storefront_pages','weight',w_pages,'score',round(f_score,2),'total',v_pg_total,'ok',v_pg_ok);

  IF v_lp_total > 0 THEN
    f_score := (v_lp_ok::numeric / v_lp_total) * w_landing;
  ELSE f_score := w_landing; END IF;
  v_score := v_score + f_score;
  v_factors := v_factors || jsonb_build_object('key','landing_pages','weight',w_landing,'score',round(f_score,2),'total',v_lp_total,'ok',v_lp_ok,'noindex_informational',v_lp_noindex);

  IF v_bp_total > 0 THEN
    f_score := (v_bp_ok::numeric / v_bp_total) * w_blog;
  ELSE f_score := w_blog; END IF;
  v_score := v_score + f_score;
  v_factors := v_factors || jsonb_build_object('key','blog_posts','weight',w_blog,'score',round(f_score,2),'total',v_bp_total,'ok',v_bp_ok);

  -- Fundação técnica (5 sinais, peso 20) — 2.A rev-a: corrigido has_primary_verified_domain -> has_verified_primary_domain
  IF v_found IS NULL THEN
    f_score := 0;
  ELSE
    f_score := w_foundation * (
      (CASE WHEN v_found.has_favicon THEN 1 ELSE 0 END) +
      (CASE WHEN v_found.has_default_seo_title THEN 1 ELSE 0 END) +
      (CASE WHEN v_found.has_default_seo_description THEN 1 ELSE 0 END) +
      (CASE WHEN v_found.has_verified_primary_domain THEN 1 ELSE 0 END) +
      (CASE WHEN v_found.has_active_ssl THEN 1 ELSE 0 END)
    )::numeric / 5;
  END IF;
  v_score := v_score + f_score;
  v_factors := v_factors || jsonb_build_object(
    'key','foundation','weight',w_foundation,'score',round(f_score,2),
    'signals', jsonb_build_object(
      'favicon', COALESCE(v_found.has_favicon,false),
      'default_seo_title', COALESCE(v_found.has_default_seo_title,false),
      'default_seo_description', COALESCE(v_found.has_default_seo_description,false),
      'primary_verified_domain', COALESCE(v_found.has_verified_primary_domain,false),
      'active_ssl', COALESCE(v_found.has_active_ssl,false)
    )
  );

  -- Pendências acionáveis (contagens agregadas — detalhes ficam para 2.B)
  IF v_prod_total - v_prod_ok > 0 THEN
    v_pending := v_pending || jsonb_build_object('key','products_missing_seo','count', v_prod_total - v_prod_ok);
  END IF;
  IF v_cat_total - v_cat_ok > 0 THEN
    v_pending := v_pending || jsonb_build_object('key','categories_missing_seo','count', v_cat_total - v_cat_ok);
  END IF;
  IF v_pg_total - v_pg_ok > 0 THEN
    v_pending := v_pending || jsonb_build_object('key','pages_missing_seo','count', v_pg_total - v_pg_ok);
  END IF;
  IF v_lp_total - v_lp_ok > 0 THEN
    v_pending := v_pending || jsonb_build_object('key','landing_pages_missing_seo','count', v_lp_total - v_lp_ok);
  END IF;
  IF v_bp_total - v_bp_ok > 0 THEN
    v_pending := v_pending || jsonb_build_object('key','blog_posts_missing_seo','count', v_bp_total - v_bp_ok);
  END IF;
  IF v_dup_titles > 0 THEN
    v_pending := v_pending || jsonb_build_object('key','duplicate_titles','count', v_dup_titles);
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'score', LEAST(100, GREATEST(0, round(v_score)))::int,
    'factors', v_factors,
    'counts', jsonb_build_object(
      'products',   jsonb_build_object('total',v_prod_total,'ok',v_prod_ok),
      'categories', jsonb_build_object('total',v_cat_total,'ok',v_cat_ok),
      'storefront_pages', jsonb_build_object('total',v_pg_total,'ok',v_pg_ok),
      'landing_pages',    jsonb_build_object('total',v_lp_total,'ok',v_lp_ok,'noindex_informational',v_lp_noindex),
      'blog_posts', jsonb_build_object('total',v_bp_total,'ok',v_bp_ok)
    ),
    'pending', v_pending,
    'computed_at', now()
  );
END;
$function$;