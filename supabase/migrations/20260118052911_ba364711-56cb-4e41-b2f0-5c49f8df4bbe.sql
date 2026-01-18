-- Add media column to product_reviews table
ALTER TABLE public.product_reviews 
ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}';

-- Create storage bucket for review media (public for displaying in storefront)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-media', 
  'review-media', 
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for review-media bucket
-- Anyone can view review media (public bucket)
CREATE POLICY "Public read access for review media" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'review-media');

-- Anyone can upload review media (customers submitting reviews)
CREATE POLICY "Anyone can upload review media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'review-media');

-- Authenticated users can delete review media
CREATE POLICY "Authenticated users can delete review media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'review-media' AND auth.role() = 'authenticated');