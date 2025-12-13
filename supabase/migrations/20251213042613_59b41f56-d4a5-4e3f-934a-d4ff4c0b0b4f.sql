-- Re-enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "allow_insert_for_authenticated" ON public.tenants;
DROP POLICY IF EXISTS "allow_select_for_users" ON public.tenants;
DROP POLICY IF EXISTS "allow_update_for_owners_admins" ON public.tenants;

-- Create policies using auth.role() check instead of TO authenticated
CREATE POLICY "tenants_insert_policy" 
ON public.tenants 
AS PERMISSIVE
FOR INSERT 
TO public
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "tenants_select_policy" 
ON public.tenants 
AS PERMISSIVE
FOR SELECT 
TO public
USING (auth.role() = 'authenticated' AND user_belongs_to_tenant(auth.uid(), id));

CREATE POLICY "tenants_update_policy" 
ON public.tenants 
AS PERMISSIVE
FOR UPDATE 
TO public
USING (auth.role() = 'authenticated' AND (has_role(auth.uid(), id, 'owner'::app_role) OR has_role(auth.uid(), id, 'admin'::app_role)));