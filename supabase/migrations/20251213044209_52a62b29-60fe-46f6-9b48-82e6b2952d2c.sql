-- Drop all existing policies
DROP POLICY IF EXISTS "tenants_insert_authenticated" ON public.tenants;
DROP POLICY IF EXISTS "tenants_select_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_policy" ON public.tenants;

-- Recreate all policies with anon, authenticated
CREATE POLICY "tenants_insert" 
ON public.tenants 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "tenants_select" 
ON public.tenants 
FOR SELECT 
TO anon, authenticated
USING (user_belongs_to_tenant(auth.uid(), id));

CREATE POLICY "tenants_update" 
ON public.tenants 
FOR UPDATE 
TO anon, authenticated
USING (has_role(auth.uid(), id, 'owner'::app_role) OR has_role(auth.uid(), id, 'admin'::app_role));

NOTIFY pgrst, 'reload schema';