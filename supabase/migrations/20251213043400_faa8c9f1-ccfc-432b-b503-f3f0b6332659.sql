-- Drop the overly permissive policies
DROP POLICY IF EXISTS "tenants_select_authenticated" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_authenticated" ON public.tenants;

-- Create proper SELECT policy - users can only see tenants they belong to
CREATE POLICY "tenants_select_policy" 
ON public.tenants 
FOR SELECT 
TO authenticated
USING (user_belongs_to_tenant(auth.uid(), id));

-- Create proper UPDATE policy - only owners and admins can update
CREATE POLICY "tenants_update_policy" 
ON public.tenants 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), id, 'owner'::app_role) OR has_role(auth.uid(), id, 'admin'::app_role));

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';