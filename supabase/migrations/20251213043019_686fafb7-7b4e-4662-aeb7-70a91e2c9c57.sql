-- Drop and recreate with simplest possible policy
DROP POLICY IF EXISTS "tenants_insert_policy" ON public.tenants;

-- Create the simplest possible insert policy
CREATE POLICY "tenants_insert_policy" 
ON public.tenants 
FOR INSERT 
WITH CHECK (true);