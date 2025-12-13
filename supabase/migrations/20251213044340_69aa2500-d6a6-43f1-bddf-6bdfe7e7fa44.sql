-- Complete RLS reset
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update" ON public.tenants;

-- Re-enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create fresh policies
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

-- Force PostgREST reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';