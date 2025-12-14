
-- Add SEO fields to store_pages table
ALTER TABLE public.store_pages
ADD COLUMN IF NOT EXISTS meta_title TEXT,
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS meta_image_url TEXT,
ADD COLUMN IF NOT EXISTS no_index BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS canonical_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.store_pages.meta_title IS 'Custom SEO title for the page';
COMMENT ON COLUMN public.store_pages.meta_description IS 'Custom SEO meta description';
COMMENT ON COLUMN public.store_pages.meta_image_url IS 'Open Graph image URL';
COMMENT ON COLUMN public.store_pages.no_index IS 'If true, page will have noindex robots directive';
COMMENT ON COLUMN public.store_pages.canonical_url IS 'Custom canonical URL, defaults to current URL if empty';
