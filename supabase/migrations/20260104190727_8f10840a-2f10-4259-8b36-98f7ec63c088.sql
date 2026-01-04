-- Add visibility toggle columns to storefront_global_layout
ALTER TABLE public.storefront_global_layout 
ADD COLUMN IF NOT EXISTS header_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS footer_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_footer_1 boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_footer_2 boolean NOT NULL DEFAULT true;