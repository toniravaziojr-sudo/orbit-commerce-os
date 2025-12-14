-- =============================================
-- CLEANUP: Remove conflicting slug unique constraints
-- Keep only the correct namespace-scoped indexes
-- =============================================

-- Drop old store_pages constraint that conflicts with the new type-aware index
-- The new idx_store_pages_slug_type_lower allows same slug for different types (institutional vs landing)
ALTER TABLE public.store_pages DROP CONSTRAINT IF EXISTS store_pages_tenant_id_slug_key;

-- Add comment explaining the slug policy
COMMENT ON INDEX idx_store_pages_slug_type_lower IS 'Slug uniqueness per (tenant_id, type) - institutional and landing pages can share the same slug';