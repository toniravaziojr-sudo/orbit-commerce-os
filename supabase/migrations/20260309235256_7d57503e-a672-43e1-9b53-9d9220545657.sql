
UPDATE storefront_prerendered_pages 
SET status = 'stale' 
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'respeite-o-homem')
  AND page_type = 'category';
