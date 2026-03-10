
UPDATE storefront_prerendered_pages 
SET status = 'stale' 
WHERE page_type = 'category';
