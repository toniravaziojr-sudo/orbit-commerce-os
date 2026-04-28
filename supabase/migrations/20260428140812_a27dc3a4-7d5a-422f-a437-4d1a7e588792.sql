-- Onda 4.2 - Migration 2: Fix Category A - Service-role policies wrongly assigned to public role
-- These policies say "Service role only" but were granted to PUBLIC role,
-- allowing anon and authenticated to bypass intended restrictions.
-- Fix: drop and recreate with TO service_role explicit.

-- 1. ads_autopilot_artifacts
DROP POLICY IF EXISTS "Service role full access on artifacts" ON public.ads_autopilot_artifacts;
CREATE POLICY "Service role full access on artifacts" ON public.ads_autopilot_artifacts
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. billing_events
DROP POLICY IF EXISTS "Service role can insert billing events" ON public.billing_events;
CREATE POLICY "Service role can insert billing events" ON public.billing_events
  AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);

-- 3. core_audit_log
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.core_audit_log;
CREATE POLICY "Service role can insert audit logs" ON public.core_audit_log
  AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);

-- 4. email_conversions
DROP POLICY IF EXISTS "Service can insert conversions" ON public.email_conversions;
CREATE POLICY "Service can insert conversions" ON public.email_conversions
  AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);

-- 5. email_tracking_tokens
DROP POLICY IF EXISTS "Service can manage tracking tokens" ON public.email_tracking_tokens;
CREATE POLICY "Service can manage tracking tokens" ON public.email_tracking_tokens
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. google_ad_ads
DROP POLICY IF EXISTS "Service role full access" ON public.google_ad_ads;
CREATE POLICY "Service role full access" ON public.google_ad_ads
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. google_ad_assets
DROP POLICY IF EXISTS "Service role full access" ON public.google_ad_assets;
CREATE POLICY "Service role full access" ON public.google_ad_assets
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. google_ad_groups
DROP POLICY IF EXISTS "Service role full access" ON public.google_ad_groups;
CREATE POLICY "Service role full access" ON public.google_ad_groups
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. google_ad_keywords
DROP POLICY IF EXISTS "Service role full access" ON public.google_ad_keywords;
CREATE POLICY "Service role full access" ON public.google_ad_keywords
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10. google_business_posts
DROP POLICY IF EXISTS "Service role can manage business posts" ON public.google_business_posts;
CREATE POLICY "Service role can manage business posts" ON public.google_business_posts
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 11. google_business_reviews
DROP POLICY IF EXISTS "Service role can manage business reviews" ON public.google_business_reviews;
CREATE POLICY "Service role can manage business reviews" ON public.google_business_reviews
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12. google_search_console_data
DROP POLICY IF EXISTS "Service role can manage search console data" ON public.google_search_console_data;
CREATE POLICY "Service role can manage search console data" ON public.google_search_console_data
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 13. meta_ad_ads
DROP POLICY IF EXISTS "Service role full access on meta_ad_ads" ON public.meta_ad_ads;
CREATE POLICY "Service role full access on meta_ad_ads" ON public.meta_ad_ads
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 14. meta_ad_adsets
DROP POLICY IF EXISTS "Service role full access on meta_ad_adsets" ON public.meta_ad_adsets;
CREATE POLICY "Service role full access on meta_ad_adsets" ON public.meta_ad_adsets
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 15. meta_whatsapp_onboarding_states
DROP POLICY IF EXISTS "Service role manages onboarding states" ON public.meta_whatsapp_onboarding_states;
CREATE POLICY "Service role manages onboarding states" ON public.meta_whatsapp_onboarding_states
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 16. tiktok_shop_returns
DROP POLICY IF EXISTS "Service role full access to returns" ON public.tiktok_shop_returns;
CREATE POLICY "Service role full access to returns" ON public.tiktok_shop_returns
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 17. whatsapp_inbound_messages
DROP POLICY IF EXISTS "Service role can insert inbound messages" ON public.whatsapp_inbound_messages;
CREATE POLICY "Service role can insert inbound messages" ON public.whatsapp_inbound_messages
  AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
