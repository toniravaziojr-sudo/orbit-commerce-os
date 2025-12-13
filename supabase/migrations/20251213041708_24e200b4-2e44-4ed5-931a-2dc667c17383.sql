-- Drop ALL policies on tenants table
DROP POLICY IF EXISTS "Users can create tenants" ON public.tenants;
DROP POLICY IF EXISTS "Owners and admins can update tenant" ON public.tenants;
DROP POLICY IF EXISTS "Users can view tenants they belong to" ON public.tenants;

-- Create fresh policies with explicit permissive setting
CREATE POLICY "allow_insert_for_authenticated" 
ON public.tenants 
AS PERMISSIVE
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "allow_select_for_users" 
ON public.tenants 
AS PERMISSIVE
FOR SELECT 
TO authenticated
USING (user_belongs_to_tenant(auth.uid(), id));

CREATE POLICY "allow_update_for_owners_admins" 
ON public.tenants 
AS PERMISSIVE
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), id, 'owner'::app_role) OR has_role(auth.uid(), id, 'admin'::app_role));