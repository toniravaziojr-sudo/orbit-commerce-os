-- Allow public/guest checkout to create orders
CREATE POLICY "Anyone can create orders for checkout" 
ON public.orders 
FOR INSERT 
WITH CHECK (true);

-- Allow public/guest checkout to create order items
CREATE POLICY "Anyone can create order items for checkout" 
ON public.order_items 
FOR INSERT 
WITH CHECK (true);