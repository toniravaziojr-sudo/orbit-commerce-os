
-- ============================================================
-- WAVE 4.1 — Hardening de superfície de ataque (EXECUTE grants)
-- Revoga EXECUTE de PUBLIC/anon/authenticated em ~95 funções
-- SECURITY DEFINER, mantendo só os callers legítimos.
-- ============================================================

-- ============================================================
-- TRAVA FUTURA: novas funções não nascem expostas
-- ============================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- ============================================================
-- BLOCO 1 — TRIGGER FUNCTIONS (27): revogar tudo
-- Triggers executam no contexto do banco; EXECUTE grant é irrelevante.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.after_order_approved_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_same_tenant_commercial_payload() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_same_tenant_context_tree() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_same_tenant_pain_map() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_sync_list_on_create() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_tag_cliente_on_payment_approved() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_system_pages_for_new_tenant() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_fiscal_draft() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_conversation_assignment_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_fiscal_alert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_whatsapp_cart_to_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_business_context_stale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_business_context_stale_from_category() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_tenant_context_stale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.propagate_email_conversion_to_attribution() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_calendar_item_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_kb_chunk_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_product_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_subscriber_on_tag_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_catalog_change_enqueue_regen() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_customer_on_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ai_signal_capture_on_resolve() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ensure_default_email_marketing_lists() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversation_counters() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.whatsapp_configs_track_migration() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.whatsapp_inbound_set_default_status() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- BLOCO 2 — RPCs CHAMADAS PELO FRONT LOGADO (22)
-- Mantém EXECUTE para 'authenticated', revoga de anon e PUBLIC
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.check_credit_balance(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_module_access(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_tenant_order_limit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_credits(uuid, uuid, integer, text, text, text, text, jsonb, numeric, uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_unique_visitors(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_tenant_for_user(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_cron_jobs_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_payment_divergences(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_queue_health() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_resilience_kpis() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_system_health_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_tenant_module_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_top_slow_queries(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_whatsapp_config_for_tenant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_whatsapp_incidents(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_whatsapp_orphan_inbound(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.initialize_default_page_template(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.initialize_storefront_templates(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reserve_credits(uuid, integer, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_whatsapp_incident(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_customer_order_stats(uuid) FROM PUBLIC, anon;

-- ============================================================
-- BLOCO 3 — EXCEÇÃO PÚBLICA INTENCIONAL
-- get_public_marketing_config: usado pelo storefront público (anon)
-- Mantém anon E authenticated. Documentado como exceção.
-- ============================================================
-- get_public_marketing_config(uuid) — não revogar; é API pública por design

-- ============================================================
-- BLOCO 4 — EDGE-ONLY / SERVICE_ROLE-ONLY (60+)
-- Revogar tudo de PUBLIC/anon/authenticated. Edge usa service_role
-- (que tem grant via role hierarchy do postgres owner).
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.atomic_activate_prerender_version(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_system_health_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_prerender_cache_health() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_google_oauth_states() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_meta_oauth_states() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_tiktok_oauth_states() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_youtube_oauth_states() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_calendar_item_aggregate_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_customer_tag(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_default_email_marketing_lists(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ai_memories(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_list_contacts_by_tag(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_recent_conversation_summaries(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_relevant_tenant_learning(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_blog_view_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_system_pages(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_signal_relevant(uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_youtube_available_for_tenant(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_marketing_sync_audit(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_learning_used(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_signal_capture_failed(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_existing_templates_to_sets() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_learning_candidate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_customer_metrics(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reclaim_stale_snapshot_leases() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revive_transient_failed_captures() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.supersede_meta_grant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_list_subscribers_from_tag(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_import_job_batch(uuid, integer, integer, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_import_job_module(uuid, text, integer, integer, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_import_job_module(uuid, text, integer, integer, integer, integer, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_meta_grant_token(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_subscriber_only(uuid, text, text, text, date, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_billing_checkout_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_invitation_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_order_retry_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_review_token(text) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- BLOCO 5 — RLS HELPERS (B): NÃO TOCAR
-- belongs_to_tenant, get_current_tenant_id, has_role, 
-- is_owner_of_member_tenant, is_platform_admin_by_auth, 
-- is_tenant_owner, user_belongs_to_tenant, user_has_tenant_access, 
-- get_auth_user_email — usados em USING/CHECK de RLS policies.
-- Manter EXECUTE para anon e authenticated por necessidade técnica
-- (Postgres precisa avaliar a policy no role do caller).
-- Documentadas como exceção intencional.
-- ============================================================

-- Comentário final: re-rodar Supabase Linter após esta migration
-- esperado: queda de ~186 alertas para ~20 (apenas exceções B + 1 pública).
