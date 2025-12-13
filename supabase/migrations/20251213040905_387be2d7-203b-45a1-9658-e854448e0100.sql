-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can create tenants" ON public.tenants;

-- Create a permissive policy instead
CREATE POLICY "Users can create tenants" 
ON public.tenants 
FOR INSERT 
TO authenticated
WITH CHECK (true);