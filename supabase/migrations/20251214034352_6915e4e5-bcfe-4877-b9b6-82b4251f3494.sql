-- Add page_overrides column to store_pages (institutional and landing pages)
ALTER TABLE public.store_pages 
ADD COLUMN IF NOT EXISTS page_overrides JSONB DEFAULT '{}'::jsonb;

-- Add page_overrides column to storefront_page_templates (home, category, product, cart, checkout templates)
ALTER TABLE public.storefront_page_templates 
ADD COLUMN IF NOT EXISTS page_overrides JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.store_pages.page_overrides IS 'Page-specific overrides for global settings (e.g., header.noticeEnabled)';
COMMENT ON COLUMN public.storefront_page_templates.page_overrides IS 'Template-specific overrides for global settings (e.g., header.noticeEnabled)';