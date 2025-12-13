-- Drop all existing INSERT policies for tenants
DROP POLICY IF EXISTS "Users can create tenants" ON public.tenants;

-- Create a properly permissive policy for INSERT
CREATE POLICY "Users can create tenants" 
ON public.tenants 
FOR INSERT 
TO authenticated
WITH CHECK (true);