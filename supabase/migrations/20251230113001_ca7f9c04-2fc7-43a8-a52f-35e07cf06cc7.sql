-- Add unique index for upsert deduplication on media_library
CREATE UNIQUE INDEX IF NOT EXISTS media_library_tenant_file_url_idx 
ON media_library (tenant_id, file_url);

-- Add index for efficient queries by variant
CREATE INDEX IF NOT EXISTS media_library_tenant_variant_idx 
ON media_library (tenant_id, variant);