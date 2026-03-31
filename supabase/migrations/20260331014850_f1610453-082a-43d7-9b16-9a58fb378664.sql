-- Phase 6: Add discovered_assets to tenant_meta_auth_grants
-- This column stores the raw assets discovered during OAuth (what Meta returned)
-- Separate from tenant_meta_integrations.selected_assets (what the user chose)

ALTER TABLE public.tenant_meta_auth_grants
ADD COLUMN discovered_assets JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenant_meta_auth_grants.discovered_assets IS 'Raw assets discovered during OAuth callback (businesses, pages, ad_accounts, etc). NOT the user-selected assets — those live in tenant_meta_integrations.selected_assets.';