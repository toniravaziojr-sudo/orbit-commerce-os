UPDATE storefront_prerendered_pages 
SET status = 'active'
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
AND status = 'stale';