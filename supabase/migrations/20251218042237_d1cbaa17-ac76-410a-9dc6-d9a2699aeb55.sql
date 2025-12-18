-- Drop the problematic policy that references auth.users
DROP POLICY IF EXISTS "Customers can view their own order items" ON public.order_items;

-- Create a policy that allows viewing order items for any order
-- (since orders table already has public select, order_items should follow)
CREATE POLICY "Anyone can view order items for checkout" 
ON public.order_items 
FOR SELECT 
USING (true);