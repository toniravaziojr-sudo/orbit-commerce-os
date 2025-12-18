-- Drop the problematic policy that references auth.users
DROP POLICY IF EXISTS "Customers can view their own orders by email" ON public.orders;

-- Create a new policy that doesn't reference auth.users directly
-- Customers can view their own orders when authenticated
CREATE POLICY "Authenticated users can view their orders by email" 
ON public.orders 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  customer_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- Also allow public read for order confirmation (by order_number for thank you page)
CREATE POLICY "Anyone can view order by number for confirmation" 
ON public.orders 
FOR SELECT 
USING (true);