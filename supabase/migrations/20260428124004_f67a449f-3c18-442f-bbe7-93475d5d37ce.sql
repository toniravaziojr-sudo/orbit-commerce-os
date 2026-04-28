-- Onda 3.4-D: Tenant Identity Guard Pattern 6

CREATE OR REPLACE FUNCTION public.add_credits(p_tenant_id uuid, p_credits integer, p_bonus integer, p_idempotency_key text, p_description text DEFAULT 'Compra de créditos'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  v_total := p_credits + p_bonus;
  IF EXISTS (SELECT 1 FROM credit_ledger WHERE idempotency_key = p_idempotency_key) THEN
    SELECT balance_credits INTO v_new_balance FROM credit_wallet WHERE tenant_id = p_tenant_id;
    RETURN v_new_balance;
  END IF;
  INSERT INTO credit_wallet (tenant_id, balance_credits, lifetime_purchased)
  VALUES (p_tenant_id, v_total, p_credits)
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance_credits = credit_wallet.balance_credits + v_total,
    lifetime_purchased = credit_wallet.lifetime_purchased + p_credits,
    updated_at = now()
  RETURNING balance_credits INTO v_new_balance;
  INSERT INTO credit_ledger (tenant_id, transaction_type, credits_delta, idempotency_key, description)
  VALUES (p_tenant_id, 'purchase', p_credits, p_idempotency_key, p_description);
  IF p_bonus > 0 THEN
    INSERT INTO credit_ledger (tenant_id, transaction_type, credits_delta, idempotency_key, description)
    VALUES (p_tenant_id, 'bonus', p_bonus, p_idempotency_key || '_bonus', 'Bônus de compra');
  END IF;
  RETURN v_new_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_ai_regeneration(p_tenant_id uuid, p_scope ai_regen_scope, p_reason ai_regen_reason, p_product_id uuid DEFAULT NULL::uuid, p_debounce_seconds integer DEFAULT 300, p_priority integer DEFAULT 50)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_new_id uuid;
  v_scheduled_for timestamptz;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  v_scheduled_for := now() + (p_debounce_seconds || ' seconds')::interval;
  UPDATE public.ai_snapshot_regen_queue
  SET scheduled_for = v_scheduled_for, reason = p_reason,
      priority = GREATEST(priority, p_priority), updated_at = now()
  WHERE tenant_id = p_tenant_id AND scope = p_scope AND status = 'pending'
    AND COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_product_id, '00000000-0000-0000-0000-000000000000'::uuid)
  RETURNING id INTO v_existing_id;
  IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;
  INSERT INTO public.ai_snapshot_regen_queue (tenant_id, scope, reason, product_id, scheduled_for, priority)
  VALUES (p_tenant_id, p_scope, p_reason, p_product_id, v_scheduled_for, p_priority)
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_number(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_number INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  UPDATE public.tenants SET next_order_number = next_order_number + 1
  WHERE id = p_tenant_id RETURNING next_order_number - 1 INTO v_number;
  IF v_number IS NULL THEN RETURN '#' || EXTRACT(EPOCH FROM NOW())::INTEGER; END IF;
  RETURN '#' || v_number::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_review_token(p_tenant_id uuid, p_order_id uuid, p_customer_id uuid DEFAULT NULL::uuid, p_customer_email text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token TEXT;
  v_existing TEXT;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  SELECT token INTO v_existing FROM public.review_tokens
  WHERE tenant_id = p_tenant_id AND order_id = p_order_id AND expires_at > now() AND used_at IS NULL;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.review_tokens (tenant_id, order_id, customer_id, customer_email, token)
  VALUES (p_tenant_id, p_order_id, p_customer_id, p_customer_email, v_token);
  RETURN v_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_tenant_invoice(p_tenant_id uuid, p_year_month text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_id UUID; v_plan_key TEXT; v_monthly_fee INTEGER; v_fee_bps INTEGER;
  v_gmv BIGINT; v_ai_usage INTEGER; v_addons_total INTEGER; v_variable_fee INTEGER;
  v_extra_email INTEGER; v_extra_whatsapp INTEGER; v_extra_support INTEGER;
  v_total_extras INTEGER; v_total INTEGER; v_line_items JSONB;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  SELECT ts.plan_key, bp.price_monthly_cents, pl.sales_fee_bps INTO v_plan_key, v_monthly_fee, v_fee_bps
  FROM tenant_subscriptions ts JOIN billing_plans bp ON bp.plan_key = ts.plan_key
  LEFT JOIN plan_limits pl ON pl.plan_key = ts.plan_key WHERE ts.tenant_id = p_tenant_id;
  IF v_plan_key IS NULL THEN v_plan_key := 'basico'; v_monthly_fee := 0; v_fee_bps := 250; END IF;
  SELECT COALESCE(gmv_cents,0), COALESCE(ai_usage_cents,0), COALESCE(extra_email_cents,0),
    COALESCE(extra_whatsapp_cents,0), COALESCE(extra_support_cents,0)
  INTO v_gmv, v_ai_usage, v_extra_email, v_extra_whatsapp, v_extra_support
  FROM tenant_monthly_usage WHERE tenant_id = p_tenant_id AND year_month = p_year_month;
  v_gmv := COALESCE(v_gmv,0); v_ai_usage := COALESCE(v_ai_usage,0);
  v_extra_email := COALESCE(v_extra_email,0); v_extra_whatsapp := COALESCE(v_extra_whatsapp,0);
  v_extra_support := COALESCE(v_extra_support,0);
  v_fee_bps := COALESCE(v_fee_bps,0); v_variable_fee := (v_gmv * v_fee_bps / 10000)::INTEGER;
  v_total_extras := v_extra_email + v_extra_whatsapp + v_extra_support;
  SELECT COALESCE(SUM(price_cents),0) INTO v_addons_total FROM tenant_addons WHERE tenant_id = p_tenant_id AND status='pending';
  v_total := v_monthly_fee + v_variable_fee + v_ai_usage + v_total_extras + COALESCE(v_addons_total,0);
  v_line_items := jsonb_build_array();
  IF v_monthly_fee > 0 THEN v_line_items := v_line_items || jsonb_build_array(jsonb_build_object('type','base_fee','description','Mensalidade '||v_plan_key,'amount_cents',v_monthly_fee)); END IF;
  IF v_variable_fee > 0 THEN v_line_items := v_line_items || jsonb_build_array(jsonb_build_object('type','variable_fee','description','Taxa sobre vendas ('||(v_fee_bps::DECIMAL/100)||'%)','amount_cents',v_variable_fee)); END IF;
  IF v_ai_usage > 0 THEN v_line_items := v_line_items || jsonb_build_array(jsonb_build_object('type','ai_usage','description','Consumo de IA','amount_cents',v_ai_usage)); END IF;
  IF v_extra_email > 0 THEN v_line_items := v_line_items || jsonb_build_array(jsonb_build_object('type','extra_email','description','Emails excedentes','amount_cents',v_extra_email)); END IF;
  IF v_extra_whatsapp > 0 THEN v_line_items := v_line_items || jsonb_build_array(jsonb_build_object('type','extra_whatsapp','description','WhatsApp excedentes','amount_cents',v_extra_whatsapp)); END IF;
  IF v_extra_support > 0 THEN v_line_items := v_line_items || jsonb_build_array(jsonb_build_object('type','extra_support','description','Atendimentos excedentes','amount_cents',v_extra_support)); END IF;
  IF v_addons_total > 0 THEN v_line_items := v_line_items || jsonb_build_array(jsonb_build_object('type','addons','description','Add-ons','amount_cents',v_addons_total)); END IF;
  INSERT INTO tenant_invoices (tenant_id, year_month, base_fee_cents, variable_fee_cents, ai_fee_cents, addons_cents, total_cents, status, line_items, due_date)
  VALUES (p_tenant_id, p_year_month, v_monthly_fee, v_variable_fee, v_ai_usage + v_total_extras, COALESCE(v_addons_total,0), v_total, 'open', v_line_items,
    (TO_DATE(p_year_month||'-01','YYYY-MM-DD') + INTERVAL '1 month' + INTERVAL '5 days')::DATE)
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    base_fee_cents = EXCLUDED.base_fee_cents, variable_fee_cents = EXCLUDED.variable_fee_cents,
    ai_fee_cents = EXCLUDED.ai_fee_cents, addons_cents = EXCLUDED.addons_cents,
    total_cents = EXCLUDED.total_cents, line_items = EXCLUDED.line_items,
    status = CASE WHEN tenant_invoices.status='paid' THEN 'paid' ELSE 'open' END, updated_at = now()
  RETURNING id INTO v_invoice_id;
  RETURN v_invoice_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token(p_tenant_id uuid, p_subscriber_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_token TEXT;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.email_unsubscribe_tokens (tenant_id, subscriber_id, token)
  VALUES (p_tenant_id, p_subscriber_id, v_token) ON CONFLICT DO NOTHING;
  RETURN v_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hydrate_whatsapp_token_from_active_grant(p_tenant_id uuid, p_encryption_key text)
 RETURNS TABLE(updated_config_id uuid, token_present boolean, grant_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_grant_id uuid; v_token_expires_at timestamptz; v_access_token text; v_config_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  SELECT id, token_expires_at INTO v_grant_id, v_token_expires_at
  FROM tenant_meta_auth_grants WHERE tenant_id = p_tenant_id AND status = 'active'
  ORDER BY granted_at DESC LIMIT 1;
  IF v_grant_id IS NULL THEN RETURN QUERY SELECT NULL::uuid, false, NULL::uuid; RETURN; END IF;
  SELECT access_token INTO v_access_token FROM public.get_meta_grant_token(v_grant_id, p_encryption_key);
  IF v_access_token IS NULL OR v_access_token = '' THEN
    RETURN QUERY SELECT NULL::uuid, false, v_grant_id; RETURN;
  END IF;
  UPDATE whatsapp_configs SET access_token = v_access_token, token_expires_at = v_token_expires_at,
    last_error = NULL, updated_at = now()
  WHERE tenant_id = p_tenant_id AND provider = 'meta' RETURNING id INTO v_config_id;
  RETURN QUERY SELECT v_config_id, (v_config_id IS NOT NULL), v_grant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_ai_metrics(p_tenant_id uuid, p_messages integer DEFAULT 0, p_images integer DEFAULT 0, p_audio_count integer DEFAULT 0, p_audio_seconds integer DEFAULT 0, p_handoffs integer DEFAULT 0, p_no_evidence integer DEFAULT 0, p_embedding_tokens integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_year_month TEXT;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  v_year_month := get_current_year_month();
  INSERT INTO tenant_monthly_usage (tenant_id, year_month, ai_messages_count, ai_image_analysis_count,
    ai_audio_transcription_count, ai_audio_duration_seconds, ai_handoff_count, ai_no_evidence_count, ai_embedding_tokens)
  VALUES (p_tenant_id, v_year_month, p_messages, p_images, p_audio_count, p_audio_seconds, p_handoffs, p_no_evidence, p_embedding_tokens)
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    ai_messages_count = tenant_monthly_usage.ai_messages_count + p_messages,
    ai_image_analysis_count = tenant_monthly_usage.ai_image_analysis_count + p_images,
    ai_audio_transcription_count = tenant_monthly_usage.ai_audio_transcription_count + p_audio_count,
    ai_audio_duration_seconds = tenant_monthly_usage.ai_audio_duration_seconds + p_audio_seconds,
    ai_handoff_count = tenant_monthly_usage.ai_handoff_count + p_handoffs,
    ai_no_evidence_count = tenant_monthly_usage.ai_no_evidence_count + p_no_evidence,
    ai_embedding_tokens = tenant_monthly_usage.ai_embedding_tokens + p_embedding_tokens,
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_creative_usage(p_tenant_id uuid, p_cost_cents integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_year_month TEXT;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  v_year_month := get_current_year_month();
  INSERT INTO tenant_monthly_usage (tenant_id, year_month, ai_usage_cents)
  VALUES (p_tenant_id, v_year_month, p_cost_cents)
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    ai_usage_cents = tenant_monthly_usage.ai_usage_cents + p_cost_cents, updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_tenant_order_usage(p_tenant_id uuid, p_order_total_cents bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_year_month TEXT; v_plan_key TEXT; v_order_limit INTEGER; v_current_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  v_year_month := public.get_current_year_month();
  INSERT INTO public.tenant_monthly_usage (tenant_id, year_month, orders_count, gmv_cents)
  VALUES (p_tenant_id, v_year_month, 1, p_order_total_cents)
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    orders_count = tenant_monthly_usage.orders_count + 1,
    gmv_cents = tenant_monthly_usage.gmv_cents + p_order_total_cents, updated_at = now();
  SELECT ts.plan_key, p.order_limit, tmu.orders_count INTO v_plan_key, v_order_limit, v_current_count
  FROM public.tenant_subscriptions ts JOIN public.plans p ON p.plan_key = ts.plan_key
  LEFT JOIN public.tenant_monthly_usage tmu ON tmu.tenant_id = ts.tenant_id AND tmu.year_month = v_year_month
  WHERE ts.tenant_id = p_tenant_id;
  IF v_order_limit IS NOT NULL AND v_current_count > v_order_limit THEN
    UPDATE public.tenant_monthly_usage SET over_limit = true
    WHERE tenant_id = p_tenant_id AND year_month = v_year_month;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_ai_usage(p_tenant_id uuid, p_usage_cents integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_year_month TEXT;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  v_year_month := public.get_current_year_month();
  INSERT INTO public.tenant_monthly_usage (tenant_id, year_month, ai_usage_cents)
  VALUES (p_tenant_id, v_year_month, p_usage_cents)
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    ai_usage_cents = tenant_monthly_usage.ai_usage_cents + p_usage_cents, updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.supersede_meta_grant(p_tenant_id uuid, p_new_grant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  UPDATE public.tenant_meta_auth_grants
  SET status = 'superseded', superseded_at = now(), superseded_by = p_new_grant_id, updated_at = now()
  WHERE tenant_id = p_tenant_id AND status = 'active' AND id != p_new_grant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.tenant_meta_integrations SET auth_grant_id = p_new_grant_id, updated_at = now()
  WHERE tenant_id = p_tenant_id AND auth_grant_id IN (
    SELECT id FROM public.tenant_meta_auth_grants
    WHERE tenant_id = p_tenant_id AND status = 'superseded' AND superseded_by = p_new_grant_id);
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_subscriber_only(p_tenant_id uuid, p_email text, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_source text DEFAULT 'manual'::text, p_list_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(subscriber_id uuid, is_new_subscriber boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_subscriber_id UUID; v_is_new BOOLEAN := false; v_normalized_email TEXT; v_customer_id UUID; v_tag_id UUID;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  v_normalized_email := LOWER(TRIM(p_email));
  SELECT s.id INTO v_subscriber_id FROM email_marketing_subscribers s
  WHERE s.tenant_id = p_tenant_id AND s.email = v_normalized_email;
  IF v_subscriber_id IS NULL THEN
    INSERT INTO email_marketing_subscribers (tenant_id, email, name, phone, source, created_from, status)
    VALUES (p_tenant_id, v_normalized_email, p_name, p_phone, p_source, p_source, 'active')
    RETURNING email_marketing_subscribers.id INTO v_subscriber_id;
    v_is_new := true;
  ELSE
    UPDATE email_marketing_subscribers s2 SET
      name = COALESCE(p_name, s2.name), phone = COALESCE(p_phone, s2.phone),
      birth_date = COALESCE(p_birth_date, s2.birth_date), updated_at = now()
    WHERE s2.id = v_subscriber_id;
  END IF;
  SELECT c.id INTO v_customer_id FROM customers c
  WHERE c.tenant_id = p_tenant_id AND c.email = v_normalized_email AND c.deleted_at IS NULL;
  IF v_customer_id IS NOT NULL THEN
    UPDATE email_marketing_subscribers s3 SET customer_id = v_customer_id
    WHERE s3.id = v_subscriber_id AND s3.customer_id IS NULL;
  END IF;
  IF p_list_id IS NOT NULL THEN
    INSERT INTO email_marketing_list_members (tenant_id, list_id, subscriber_id)
    VALUES (p_tenant_id, p_list_id, v_subscriber_id) ON CONFLICT DO NOTHING;
    IF v_customer_id IS NOT NULL THEN
      SELECT l.tag_id INTO v_tag_id FROM email_marketing_lists l WHERE l.id = p_list_id;
      IF v_tag_id IS NOT NULL THEN
        INSERT INTO customer_tag_assignments (customer_id, tag_id)
        VALUES (v_customer_id, v_tag_id) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN QUERY SELECT v_subscriber_id, v_is_new;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_ai_memories(uuid, uuid, text, integer);
CREATE OR REPLACE FUNCTION public.get_ai_memories(p_tenant_id uuid, p_user_id uuid, p_ai_agent text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, category text, content text, importance integer, scope text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT m.id, m.category, m.content, m.importance,
    CASE WHEN m.user_id IS NULL THEN 'tenant' ELSE 'user' END AS scope, m.created_at
  FROM public.ai_memories m
  WHERE m.tenant_id = p_tenant_id
    AND (m.user_id IS NULL OR m.user_id = p_user_id)
    AND (m.ai_agent = p_ai_agent OR m.ai_agent = 'all')
    AND (m.expires_at IS NULL OR m.expires_at > now())
  ORDER BY m.importance DESC, m.created_at DESC LIMIT p_limit;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_recent_conversation_summaries(uuid, uuid, text, integer);
CREATE OR REPLACE FUNCTION public.get_recent_conversation_summaries(p_tenant_id uuid, p_user_id uuid, p_ai_agent text, p_limit integer DEFAULT 5)
 RETURNS TABLE(summary text, key_topics text[], key_decisions jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT s.summary, s.key_topics, s.key_decisions, s.created_at
  FROM public.ai_conversation_summaries s
  WHERE s.tenant_id = p_tenant_id AND s.user_id = p_user_id AND s.ai_agent = p_ai_agent
  ORDER BY s.created_at DESC LIMIT p_limit;
END;
$function$;