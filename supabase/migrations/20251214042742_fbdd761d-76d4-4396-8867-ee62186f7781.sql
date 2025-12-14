-- Add menu visibility fields to store_pages
ALTER TABLE public.store_pages 
ADD COLUMN IF NOT EXISTS show_in_menu boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS menu_label text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS menu_order integer DEFAULT 0;

-- Create index for menu queries
CREATE INDEX IF NOT EXISTS idx_store_pages_show_in_menu ON public.store_pages(tenant_id, show_in_menu) WHERE show_in_menu = true;

-- Add comment for clarity
COMMENT ON COLUMN public.store_pages.show_in_menu IS 'Whether this page should be available to add in menus';
COMMENT ON COLUMN public.store_pages.menu_label IS 'Custom label to use in menus (fallback to title if null)';
COMMENT ON COLUMN public.store_pages.menu_order IS 'Default order for this page in menu listings';