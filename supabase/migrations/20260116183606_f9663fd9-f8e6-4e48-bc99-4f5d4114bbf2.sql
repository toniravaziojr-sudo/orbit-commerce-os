-- Add product scope fields to discounts table
ALTER TABLE public.discounts 
ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'specific_products', 'specific_categories')),
ADD COLUMN IF NOT EXISTS product_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS category_ids UUID[] DEFAULT '{}';