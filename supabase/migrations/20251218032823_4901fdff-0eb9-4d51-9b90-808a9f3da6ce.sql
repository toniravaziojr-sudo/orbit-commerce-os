-- Allow public/anonymous users to read orders by their email
-- This enables "Minha Conta" to show orders for logged-in customers

CREATE POLICY "Customers can view their own orders by email"
ON public.orders
FOR SELECT
USING (
  customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Also allow reading order_items for orders they can access
CREATE POLICY "Customers can view their own order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND o.customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);