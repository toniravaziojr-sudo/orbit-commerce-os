-- Allow public/guest checkout to create customers
CREATE POLICY "Anyone can create customers for checkout" 
ON public.customers 
FOR INSERT 
WITH CHECK (true);

-- Allow public/guest checkout to update customers (for returning customers)
CREATE POLICY "Anyone can update customers for checkout" 
ON public.customers 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Allow public/guest checkout to read customers by email (to check if exists)
CREATE POLICY "Anyone can read customers by email for checkout" 
ON public.customers 
FOR SELECT 
USING (true);