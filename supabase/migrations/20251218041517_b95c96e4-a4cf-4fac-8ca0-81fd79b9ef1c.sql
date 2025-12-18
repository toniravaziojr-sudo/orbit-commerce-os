-- Allow edge function to insert payment transactions (via service role, but backup policy)
CREATE POLICY "Anyone can create payment transactions for checkout" 
ON public.payment_transactions 
FOR INSERT 
WITH CHECK (true);

-- Allow public to read payment_providers (for checking if methods enabled)
CREATE POLICY "Anyone can read enabled payment providers" 
ON public.payment_providers 
FOR SELECT 
USING (is_enabled = true);

-- Allow public to read enabled payment methods
CREATE POLICY "Anyone can read enabled payment methods" 
ON public.payment_methods 
FOR SELECT 
USING (is_enabled = true);