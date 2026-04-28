-- Wave 3.4-C: Apply Tenant Identity Guard (Pattern 6) to 15 SECURITY DEFINER RPCs
-- exposed to authenticated users. Service-role calls bypass via auth.role() check.
-- Pattern: Per .lovable/memory/infrastructure/security/database-hardening-standard-v2

-- ============================================================
-- 1. atomic_activate_prerender_version
-- ============================================================
CREATE OR REPLACE FUNCTION public.atomic_activate_prerender_version(p_tenant_id uuid, p_publish_version bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stale_count INTEGER;
  v_active_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  UPDATE storefront_prerendered_pages
  SET status = 'stale'
  WHERE tenant_id = p_tenant_id AND status = 'active';
  GET DIAGNOSTICS v_stale_count = ROW_COUNT;

  UPDATE storefront_prerendered_pages
  SET status = 'active'
  WHERE tenant_id = p_tenant_id
    AND publish_version = p_publish_version
    AND status = 'pending';
  GET DIAGNOSTICS v_active_count = ROW_COUNT;

  IF v_active_count = 0 AND v_stale_count > 0 THEN
    UPDATE storefront_prerendered_pages
    SET status = 'active'
    WHERE tenant_id = p_tenant_id
      AND status = 'stale'
      AND publish_version != p_publish_version;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No pending pages found for this version, rollback applied',
      'stale_rolled_back', v_stale_count
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deactivated', v_stale_count,
    'activated', v_active_count
  );
END;
$function$;

-- ============================================================
-- 2. check_module_access
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_module_access(p_tenant_id uuid, p_module_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant RECORD;
  v_plan_key TEXT;
  v_pma RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT type, plan, is_special INTO v_tenant FROM tenants WHERE id = p_tenant_id;

  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('has_access', false, 'access_level', 'none', 'blocked_features', '[]'::jsonb, 'allowed_features', '[]'::jsonb, 'plan_key', 'unknown', 'requires_upgrade', true);
  END IF;

  IF v_tenant.type = 'platform' THEN
    RETURN jsonb_build_object('has_access', true, 'access_level', 'full', 'blocked_features', '[]'::jsonb, 'allowed_features', '[]'::jsonb, 'plan_key', 'platform', 'requires_upgrade', false);
  END IF;

  IF v_tenant.is_special = true OR v_tenant.plan = 'unlimited' THEN
    RETURN jsonb_build_object('has_access', true, 'access_level', 'full', 'blocked_features', '[]'::jsonb, 'allowed_features', '[]'::jsonb, 'plan_key', COALESCE(v_tenant.plan::text, 'unlimited'), 'requires_upgrade', false);
  END IF;

  SELECT ts.plan_key INTO v_plan_key FROM tenant_subscriptions ts WHERE ts.tenant_id = p_tenant_id LIMIT 1;
  IF v_plan_key IS NULL THEN
    v_plan_key := COALESCE(v_tenant.plan::text, 'basico');
  END IF;

  SELECT * INTO v_pma FROM plan_module_access pma WHERE pma.plan_key = v_plan_key AND pma.module_key = p_module_key LIMIT 1;

  IF v_pma IS NULL THEN
    RETURN jsonb_build_object('has_access', true, 'access_level', 'full', 'blocked_features', '[]'::jsonb, 'allowed_features', '[]'::jsonb, 'plan_key', v_plan_key, 'requires_upgrade', false);
  END IF;

  RETURN jsonb_build_object(
    'has_access', v_pma.access_level IN ('full', 'partial'),
    'access_level', v_pma.access_level,
    'blocked_features', COALESCE(v_pma.blocked_features, '[]'::jsonb),
    'allowed_features', COALESCE(v_pma.allowed_features, '[]'::jsonb),
    'plan_key', v_plan_key,
    'requires_upgrade', v_pma.access_level = 'none'
  );
END;
$function$;

-- ============================================================
-- 3. check_tenant_order_limit
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_tenant_order_limit(p_tenant_id uuid)
 RETURNS TABLE(is_over_limit boolean, current_count integer, order_limit integer, plan_key text, hard_enforcement_enabled boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year_month TEXT;
  v_hard_enforcement BOOLEAN;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  v_year_month := public.get_current_year_month();

  SELECT is_enabled INTO v_hard_enforcement
  FROM public.billing_feature_flags
  WHERE flag_key = 'hard_order_limit_enforcement';

  RETURN QUERY
  SELECT
    COALESCE(tmu.over_limit, false) AS is_over_limit,
    COALESCE(tmu.orders_count, 0)::INTEGER AS current_count,
    p.order_limit,
    ts.plan_key,
    COALESCE(v_hard_enforcement, false) AS hard_enforcement_enabled
  FROM public.tenant_subscriptions ts
  JOIN public.plans p ON p.plan_key = ts.plan_key
  LEFT JOIN public.tenant_monthly_usage tmu ON tmu.tenant_id = ts.tenant_id AND tmu.year_month = v_year_month
  WHERE ts.tenant_id = p_tenant_id;
END;
$function$;

-- ============================================================
-- 4. ensure_customer_tag
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_customer_tag(p_tenant_id uuid, p_customer_id uuid, p_tag_name text DEFAULT 'Cliente'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tag_id UUID;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_tag_id FROM customer_tags WHERE tenant_id = p_tenant_id AND name = p_tag_name LIMIT 1;

  IF v_tag_id IS NULL THEN
    INSERT INTO customer_tags (tenant_id, name, color, description)
    VALUES (p_tenant_id, p_tag_name, '#10B981', 'Clientes com pedido aprovado')
    RETURNING id INTO v_tag_id;
  END IF;

  INSERT INTO customer_tag_assignments (customer_id, tag_id)
  VALUES (p_customer_id, v_tag_id)
  ON CONFLICT (customer_id, tag_id) DO NOTHING;
END;
$function$;

-- ============================================================
-- 5. ensure_default_email_marketing_lists
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_default_email_marketing_lists(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tag_id UUID;
  v_defaults JSONB := '[
    {"tag_name": "Cliente",            "tag_color": "#10B981", "tag_desc": "Clientes com pedido aprovado",            "list_name": "Clientes"},
    {"tag_name": "Newsletter PopUp",   "tag_color": "#06b6d4", "tag_desc": "Leads capturados via popup newsletter",   "list_name": "Newsletter PopUp"},
    {"tag_name": "Cliente Potencial",  "tag_color": "#f97316", "tag_desc": "Clientes que abandonaram o checkout",     "list_name": "Clientes Potenciais"}
  ]';
  v_item JSONB;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_defaults)
  LOOP
    INSERT INTO public.customer_tags (tenant_id, name, color, description)
    VALUES (p_tenant_id, v_item->>'tag_name', v_item->>'tag_color', v_item->>'tag_desc')
    ON CONFLICT (tenant_id, name) DO NOTHING;

    SELECT id INTO v_tag_id FROM public.customer_tags
    WHERE tenant_id = p_tenant_id AND name = v_item->>'tag_name';

    IF v_tag_id IS NOT NULL THEN
      INSERT INTO public.email_marketing_lists (tenant_id, name, tag_id, is_system)
      VALUES (p_tenant_id, v_item->>'list_name', v_tag_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

-- ============================================================
-- 6. get_relevant_tenant_learning (sql -> plpgsql)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_relevant_tenant_learning(p_tenant_id uuid, p_query_text text, p_ai_agent text DEFAULT 'support'::text, p_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, learning_type text, pattern_text text, response_text text, success_score numeric, evidence_count integer, similarity real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    tlm.id,
    tlm.learning_type,
    tlm.pattern_text,
    tlm.response_text,
    tlm.success_score,
    tlm.evidence_count,
    ts_rank(
      to_tsvector('portuguese', tlm.pattern_normalized),
      plainto_tsquery('portuguese', LOWER(COALESCE(p_query_text, '')))
    ) AS similarity
  FROM public.tenant_learning_memory tlm
  WHERE tlm.tenant_id = p_tenant_id
    AND tlm.ai_agent = p_ai_agent
    AND tlm.status = 'active'
    AND to_tsvector('portuguese', tlm.pattern_normalized)
        @@ plainto_tsquery('portuguese', LOWER(COALESCE(p_query_text, '')))
  ORDER BY similarity DESC, tlm.success_score DESC
  LIMIT p_limit;
END;
$function$;

-- ============================================================
-- 7. get_tenant_module_access
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tenant_module_access(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant RECORD;
  v_plan_key TEXT;
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT type, plan, is_special INTO v_tenant FROM tenants WHERE id = p_tenant_id;

  IF v_tenant IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF v_tenant.type = 'platform' OR v_tenant.is_special = true OR v_tenant.plan = 'unlimited' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT ts.plan_key INTO v_plan_key FROM tenant_subscriptions ts WHERE ts.tenant_id = p_tenant_id LIMIT 1;
  v_plan_key := COALESCE(v_plan_key, v_tenant.plan::text, 'basico');

  SELECT jsonb_agg(
    jsonb_build_object(
      'module_key', pma.module_key,
      'access_level', pma.access_level,
      'blocked_features', COALESCE(pma.blocked_features, '[]'::jsonb),
      'allowed_features', COALESCE(pma.allowed_features, '[]'::jsonb),
      'notes', pma.notes
    )
  ) INTO v_result
  FROM plan_module_access pma WHERE pma.plan_key = v_plan_key;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

-- ============================================================
-- 8. get_whatsapp_config_for_tenant (sql -> plpgsql)
-- Note: existing fn already enforces user_roles check internally; we add canonical guard.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_whatsapp_config_for_tenant(p_tenant_id uuid)
 RETURNS TABLE(id uuid, tenant_id uuid, provider text, instance_id text, connection_status text, phone_number text, qr_code text, qr_expires_at timestamp with time zone, last_connected_at timestamp with time zone, last_error text, is_enabled boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    wc.id, wc.tenant_id, wc.provider, wc.instance_id, wc.connection_status,
    wc.phone_number, wc.qr_code, wc.qr_expires_at, wc.last_connected_at,
    wc.last_error, wc.is_enabled, wc.created_at, wc.updated_at
  FROM public.whatsapp_configs wc
  WHERE wc.tenant_id = p_tenant_id
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND ur.role IN ('owner', 'admin')
    );
END;
$function$;

-- ============================================================
-- 9. initialize_default_page_template
-- ============================================================
CREATE OR REPLACE FUNCTION public.initialize_default_page_template(p_tenant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_template_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_template_id FROM public.page_templates
  WHERE tenant_id = p_tenant_id AND is_default = true LIMIT 1;

  IF v_template_id IS NULL THEN
    INSERT INTO public.page_templates (tenant_id, name, slug, description, content, is_default, is_system)
    VALUES (
      p_tenant_id, 'Modelo Padrão', 'padrao',
      'Template padrão para páginas institucionais com Header, área de conteúdo e Footer.',
      '{"id":"root","type":"Page","props":{},"children":[{"id":"header-slot","type":"Header","props":{"menuId":"","showSearch":true,"showCart":true,"sticky":true}},{"id":"content-slot","type":"Section","props":{"paddingY":0,"paddingX":0,"fullWidth":true},"children":[{"id":"content-container","type":"Container","props":{"maxWidth":"md","centered":true},"children":[{"id":"page-content","type":"PageContent","props":{}}]}]},{"id":"footer-slot","type":"Footer","props":{"menuId":"","showSocial":true}}]}'::jsonb,
      true, true
    ) RETURNING id INTO v_template_id;
  END IF;

  RETURN v_template_id;
END;
$function$;

-- ============================================================
-- 10. initialize_storefront_templates
-- ============================================================
CREATE OR REPLACE FUNCTION public.initialize_storefront_templates(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_page_types text[] := ARRAY['home', 'category', 'product', 'cart', 'checkout', 'thank_you', 'account', 'account_orders', 'account_order_detail', 'institutional', 'blog', 'tracking'];
  v_type text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  FOREACH v_type IN ARRAY v_page_types
  LOOP
    INSERT INTO public.storefront_page_templates (tenant_id, page_type)
    VALUES (p_tenant_id, v_type)
    ON CONFLICT (tenant_id, page_type) DO NOTHING;
  END LOOP;
END;
$function$;

-- ============================================================
-- 11. initialize_system_pages
-- ============================================================
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
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  v_tracking_content := '{"id":"tracking-page-root","type":"Page","props":{},"children":[{"id":"tracking-header","type":"Header","props":{}},{"id":"tracking-section","type":"Section","props":{"paddingY":0,"paddingX":0,"fullWidth":true},"children":[{"id":"tracking-lookup","type":"TrackingLookup","props":{"title":"Rastrear Pedido","description":"Acompanhe o status da sua entrega"}}]},{"id":"tracking-footer","type":"Footer","props":{}}]}'::JSONB;

  v_blog_content := '{"id":"blog-page-root","type":"Page","props":{},"children":[{"id":"blog-header","type":"Header","props":{}},{"id":"blog-section","type":"Section","props":{"paddingY":0,"paddingX":0,"fullWidth":true},"children":[{"id":"blog-listing","type":"BlogListing","props":{"title":"Blog","description":"Novidades e dicas","postsPerPage":9}}]},{"id":"blog-footer","type":"Footer","props":{}}]}'::JSONB;

  INSERT INTO public.store_pages (tenant_id, title, slug, type, status, content, is_published, is_system, seo_title, seo_description)
  VALUES (p_tenant_id, 'Rastreio', 'rastreio', 'system', 'published', v_tracking_content, true, true, 'Rastrear Pedido', 'Acompanhe o status da sua entrega')
  ON CONFLICT (tenant_id, slug) DO UPDATE SET is_system = true, content = COALESCE(store_pages.content, EXCLUDED.content);

  INSERT INTO public.store_pages (tenant_id, title, slug, type, status, content, is_published, is_system, seo_title, seo_description)
  VALUES (p_tenant_id, 'Blog', 'blog', 'system', 'published', v_blog_content, true, true, 'Blog', 'Novidades e dicas da nossa loja')
  ON CONFLICT (tenant_id, slug) DO UPDATE SET is_system = true, content = COALESCE(store_pages.content, EXCLUDED.content);
END;
$function$;

-- ============================================================
-- 12. recalc_customer_metrics
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_customer_metrics(p_tenant_id uuid, p_customer_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_orders INTEGER;
  v_total_spent NUMERIC;
  v_avg_ticket NUMERIC;
  v_first_order TIMESTAMPTZ;
  v_last_order TIMESTAMPTZ;
  v_tier TEXT;
  v_p50 NUMERIC;
  v_p75 NUMERIC;
  v_p90 NUMERIC;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(total), 0),
    CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total) / COUNT(*), 0) ELSE 0 END,
    MIN(created_at),
    MAX(created_at)
  INTO v_total_orders, v_total_spent, v_avg_ticket, v_first_order, v_last_order
  FROM public.orders
  WHERE tenant_id = p_tenant_id
    AND LOWER(TRIM(customer_email)) = LOWER(TRIM(p_customer_email))
    AND payment_status = 'approved'
    AND total > 0;

  SELECT
    COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY COALESCE(total_spent, 0)), 0),
    COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY COALESCE(total_spent, 0)), 0),
    COALESCE(percentile_cont(0.90) WITHIN GROUP (ORDER BY COALESCE(total_spent, 0)), 0)
  INTO v_p50, v_p75, v_p90
  FROM public.customers
  WHERE tenant_id = p_tenant_id AND COALESCE(total_spent, 0) > 0 AND deleted_at IS NULL;

  IF v_p50 = 0 AND v_p75 = 0 AND v_p90 = 0 THEN
    v_tier := 'bronze';
  ELSE
    v_tier := CASE
      WHEN v_total_spent >= v_p90 THEN 'platinum'
      WHEN v_total_spent >= v_p75 THEN 'gold'
      WHEN v_total_spent >= v_p50 THEN 'silver'
      ELSE 'bronze'
    END;
  END IF;

  UPDATE public.customers
  SET total_orders = v_total_orders,
      total_spent = v_total_spent,
      average_ticket = v_avg_ticket,
      first_order_at = v_first_order,
      last_order_at = v_last_order,
      loyalty_tier = v_tier,
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND LOWER(TRIM(email)) = LOWER(TRIM(p_customer_email))
    AND deleted_at IS NULL;
END;
$function$;

-- ============================================================
-- 13. record_notification_usage
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_notification_usage(p_tenant_id uuid, p_channel text, p_count integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year_month TEXT;
  v_plan_key TEXT;
  v_included INTEGER;
  v_current_count INTEGER;
  v_extra_price INTEGER;
  v_extra_cents INTEGER := 0;
  v_is_extra BOOLEAN := false;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  v_year_month := get_current_year_month();

  SELECT ts.plan_key INTO v_plan_key FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id AND ts.status = 'active';
  IF v_plan_key IS NULL THEN v_plan_key := 'basico'; END IF;

  IF p_channel = 'email' THEN
    SELECT pl.included_email_notifications, pl.extra_email_price_cents
    INTO v_included, v_extra_price
    FROM plan_limits pl WHERE pl.plan_key = v_plan_key;

    SELECT COALESCE(email_notifications_count, 0) INTO v_current_count
    FROM tenant_monthly_usage WHERE tenant_id = p_tenant_id AND year_month = v_year_month;

  ELSIF p_channel = 'whatsapp' THEN
    SELECT pl.included_whatsapp_notifications, pl.extra_whatsapp_price_cents
    INTO v_included, v_extra_price
    FROM plan_limits pl WHERE pl.plan_key = v_plan_key;

    SELECT COALESCE(whatsapp_notifications_count, 0) INTO v_current_count
    FROM tenant_monthly_usage WHERE tenant_id = p_tenant_id AND year_month = v_year_month;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Canal inválido');
  END IF;

  v_included := COALESCE(v_included, 0);
  v_extra_price := COALESCE(v_extra_price, 5);
  v_current_count := COALESCE(v_current_count, 0);

  IF v_current_count + p_count > v_included THEN
    v_is_extra := true;
    v_extra_cents := GREATEST(0, (v_current_count + p_count - v_included)) * v_extra_price;
  END IF;

  IF p_channel = 'email' THEN
    INSERT INTO tenant_monthly_usage (tenant_id, year_month, email_notifications_count, extra_email_cents)
    VALUES (p_tenant_id, v_year_month, p_count, v_extra_cents)
    ON CONFLICT (tenant_id, year_month) DO UPDATE SET
      email_notifications_count = tenant_monthly_usage.email_notifications_count + p_count,
      extra_email_cents = tenant_monthly_usage.extra_email_cents + v_extra_cents,
      updated_at = now();
  ELSIF p_channel = 'whatsapp' THEN
    INSERT INTO tenant_monthly_usage (tenant_id, year_month, whatsapp_notifications_count, extra_whatsapp_cents)
    VALUES (p_tenant_id, v_year_month, p_count, v_extra_cents)
    ON CONFLICT (tenant_id, year_month) DO UPDATE SET
      whatsapp_notifications_count = tenant_monthly_usage.whatsapp_notifications_count + p_count,
      extra_whatsapp_cents = tenant_monthly_usage.extra_whatsapp_cents + v_extra_cents,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object('success', true, 'channel', p_channel, 'count', p_count, 'is_extra', v_is_extra, 'extra_cents', v_extra_cents);
END;
$function$;

-- ============================================================
-- 14. search_knowledge_base (sql -> plpgsql)
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_knowledge_base(p_tenant_id uuid, p_query_embedding extensions.vector, p_top_k integer DEFAULT 5, p_threshold double precision DEFAULT 0.7)
 RETURNS TABLE(chunk_id uuid, doc_id uuid, doc_title text, doc_type text, doc_priority integer, chunk_text text, similarity double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.doc_id,
    d.title AS doc_title,
    d.doc_type,
    d.priority AS doc_priority,
    c.chunk_text,
    1 - (c.embedding <=> p_query_embedding) AS similarity
  FROM knowledge_base_chunks c
  JOIN knowledge_base_docs d ON d.id = c.doc_id
  WHERE c.tenant_id = p_tenant_id
    AND c.is_active = true
    AND d.status = 'active'
    AND (d.valid_until IS NULL OR d.valid_until > now())
    AND 1 - (c.embedding <=> p_query_embedding) >= p_threshold
  ORDER BY d.priority ASC, similarity DESC
  LIMIT p_top_k;
END;
$function$;

-- ============================================================
-- 15. search_products_fuzzy (sql -> plpgsql)
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_products_fuzzy(p_tenant_id uuid, p_query text, p_limit integer DEFAULT 20, p_exclude_kits boolean DEFAULT true)
 RETURNS TABLE(id uuid, name text, sku text, price numeric, compare_at_price numeric, stock_quantity integer, status text, product_format text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.sku, p.price, p.compare_at_price,
    p.stock_quantity, p.status, p.product_format, p.created_at
  FROM public.products p
  WHERE p.tenant_id = p_tenant_id
    AND p.deleted_at IS NULL
    AND (
      extensions.unaccent(lower(p.name)) LIKE '%' || extensions.unaccent(lower(p_query)) || '%'
      OR p.sku ILIKE '%' || p_query || '%'
    )
    AND (NOT p_exclude_kits OR p.product_format IS DISTINCT FROM 'with_composition')
  ORDER BY p.name
  LIMIT p_limit;
END;
$function$;