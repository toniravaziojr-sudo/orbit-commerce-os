-- Drop existing policies
DROP POLICY IF EXISTS "tenants_insert_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_select_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_policy" ON public.tenants;

-- Create policies using auth.uid() IS NOT NULL check
CREATE POLICY "tenants_insert_policy" 
ON public.tenants 
AS PERMISSIVE
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tenants_select_policy" 
ON public.tenants 
AS PERMISSIVE
FOR SELECT 
USING (auth.uid() IS NOT NULL AND user_belongs_to_tenant(auth.uid(), id));

CREATE POLICY "tenants_update_policy" 
ON public.tenants 
AS PERMISSIVE
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), id, 'owner'::app_role) OR has_role(auth.uid(), id, 'admin'::app_role)));