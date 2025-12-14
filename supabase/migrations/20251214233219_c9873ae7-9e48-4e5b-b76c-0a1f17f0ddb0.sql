-- =============================================
-- SLUG POLICY MIGRATION - Fix store_pages uniqueness by (tenant_id, type, slug)
-- =============================================

-- Drop the old constraint that was only (tenant_id, slug)
DROP INDEX IF EXISTS idx_store_pages_slug_lower;

-- Create new unique index that includes type in the uniqueness
-- This allows same slug in different types (institutional vs landing_page)
CREATE UNIQUE INDEX idx_store_pages_slug_type_lower 
ON public.store_pages (tenant_id, type, lower(slug));

-- Verify other indexes are correct (these should already exist from previous migration)
-- products: unique per (tenant_id, slug) - already correct
-- categories: unique per (tenant_id, slug) - already correct
-- tenants: unique global - already correct

-- Add comment documenting the slug policy
COMMENT ON INDEX idx_store_pages_slug_type_lower IS 'Slug uniqueness per tenant and page type - allows same slug in institutional vs landing_page';
COMMENT ON INDEX idx_products_slug_lower IS 'Slug uniqueness per tenant for products';
COMMENT ON INDEX idx_categories_slug_lower IS 'Slug uniqueness per tenant for categories';
COMMENT ON INDEX idx_tenants_slug_lower IS 'Global slug uniqueness for tenants';