-- Add position column to product_categories for ordering within category
ALTER TABLE public.product_categories 
ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_product_categories_category_position 
ON public.product_categories (category_id, position);

-- Create index for product lookups
CREATE INDEX IF NOT EXISTS idx_product_categories_product 
ON public.product_categories (product_id);