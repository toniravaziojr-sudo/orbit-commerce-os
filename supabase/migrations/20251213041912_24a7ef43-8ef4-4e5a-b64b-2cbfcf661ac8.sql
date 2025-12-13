-- Disable and re-enable RLS to refresh
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Also grant insert permission explicitly
GRANT INSERT ON public.tenants TO authenticated;
GRANT SELECT ON public.tenants TO authenticated;
GRANT UPDATE ON public.tenants TO authenticated;