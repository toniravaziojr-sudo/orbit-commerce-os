-- =============================================
-- MIGRATION: Enforce case-insensitive unique slugs
-- Ensures slugs are always lowercase and unique per tenant
-- =============================================

-- 1. First, normalize any existing slugs to lowercase (safety measure)
UPDATE categories SET slug = lower(slug) WHERE slug != lower(slug);
UPDATE products SET slug = lower(slug) WHERE slug != lower(slug);
UPDATE store_pages SET slug = lower(slug) WHERE slug != lower(slug);
UPDATE tenants SET slug = lower(slug) WHERE slug != lower(slug);

-- 2. Create unique indexes on lower(slug) for case-insensitive uniqueness
-- (These will work even if data has mixed case in the future)

-- For categories: unique per tenant
DROP INDEX IF EXISTS idx_categories_slug_tenant;
DROP INDEX IF EXISTS idx_categories_slug_lower;
CREATE UNIQUE INDEX idx_categories_slug_lower ON categories (tenant_id, lower(slug));

-- For products: unique per tenant
DROP INDEX IF EXISTS idx_products_slug_lower;
CREATE UNIQUE INDEX idx_products_slug_lower ON products (tenant_id, lower(slug));

-- For store_pages: unique per tenant (already has unique constraint, add lower version)
DROP INDEX IF EXISTS idx_store_pages_slug_lower;
CREATE UNIQUE INDEX idx_store_pages_slug_lower ON store_pages (tenant_id, lower(slug));

-- For tenants: globally unique
DROP INDEX IF EXISTS idx_tenants_slug_lower;
CREATE UNIQUE INDEX idx_tenants_slug_lower ON tenants (lower(slug));

-- 3. Add check constraints to ensure slugs are always lowercase and valid format
-- Using a simple regex that allows: lowercase letters, numbers, single hyphens (not at start/end)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_format;
ALTER TABLE categories ADD CONSTRAINT categories_slug_format 
  CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' OR slug ~ '^[a-z0-9]$');

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_slug_format;
ALTER TABLE products ADD CONSTRAINT products_slug_format 
  CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' OR slug ~ '^[a-z0-9]$');

ALTER TABLE store_pages DROP CONSTRAINT IF EXISTS store_pages_slug_format;
ALTER TABLE store_pages ADD CONSTRAINT store_pages_slug_format 
  CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' OR slug ~ '^[a-z0-9]$');

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_slug_format;
ALTER TABLE tenants ADD CONSTRAINT tenants_slug_format 
  CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' OR slug ~ '^[a-z0-9]$');