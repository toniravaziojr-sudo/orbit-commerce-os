-- =====================================================
-- PLATFORM ADMINS TABLE
-- Stores platform-level administrators (super admins)
-- =====================================================
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  role text NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'admin', 'viewer')),
  permissions jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.platform_admins IS 'Platform-level administrators who can manage the entire SaaS platform';

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read this table (bootstrap with function)
CREATE POLICY "Platform admins can view platform_admins"
  ON public.platform_admins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND pa.is_active = true
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_platform_admins_updated_at
  BEFORE UPDATE ON public.platform_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SPECIAL TENANTS TABLE
-- Stores tenants that don't need subscriptions
-- =====================================================
CREATE TABLE public.special_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  reason text NOT NULL CHECK (reason IN ('founder', 'partner', 'test', 'promo', 'internal')),
  expires_at timestamptz, -- null = never expires
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- Add comment
COMMENT ON TABLE public.special_tenants IS 'Tenants with special access that do not require a paid subscription';

-- Enable RLS
ALTER TABLE public.special_tenants ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage special tenants
CREATE POLICY "Platform admins can manage special_tenants"
  ON public.special_tenants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND pa.is_active = true
    )
  );

-- =====================================================
-- UPDATE is_platform_admin() FUNCTION
-- Now queries the platform_admins table instead of hardcoded emails
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND is_active = true
  )
$$;

-- =====================================================
-- INSERT INITIAL DATA
-- =====================================================

-- Insert platform admin
INSERT INTO public.platform_admins (email, name, role)
VALUES ('toniravaziojr@gmail.com', 'Toni Ravazio Jr', 'super_admin');

-- Insert special tenant for Respeite o Homem (if exists)
INSERT INTO public.special_tenants (tenant_id, reason, notes)
SELECT id, 'founder', 'Empresa do fundador - acesso vitalício sem assinatura'
FROM public.tenants 
WHERE slug = 'respeite-o-homem'
ON CONFLICT (tenant_id) DO NOTHING;