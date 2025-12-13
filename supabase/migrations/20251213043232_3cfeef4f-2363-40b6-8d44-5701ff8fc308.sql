-- Drop all policies
DROP POLICY IF EXISTS "tenants_insert_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_select_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_policy" ON public.tenants;

-- Create policies for anon and authenticated roles explicitly
CREATE POLICY "tenants_insert_authenticated" 
ON public.tenants 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "tenants_select_authenticated" 
ON public.tenants 
FOR SELECT 
TO anon, authenticated
USING (true);

CREATE POLICY "tenants_update_authenticated" 
ON public.tenants 
FOR UPDATE 
TO anon, authenticated
USING (true);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';