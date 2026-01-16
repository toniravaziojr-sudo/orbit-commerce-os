-- Add INSERT policy for product_reviews allowing anonymous submissions
-- Reviews start as 'pending' and require admin approval

CREATE POLICY "Anyone can submit product reviews" ON public.product_reviews
FOR INSERT WITH CHECK (
  -- Anyone can insert reviews
  true
);

-- Note: Reviews are inserted with status='pending' by default (enforced in code)
-- Only approved reviews are visible (existing SELECT policy)
-- Admins can manage all reviews (existing ALL policy)