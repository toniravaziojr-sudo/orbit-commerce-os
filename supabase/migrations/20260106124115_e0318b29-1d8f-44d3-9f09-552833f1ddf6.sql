-- Seed marketing_integrations for Comando Central tenant
INSERT INTO public.marketing_integrations (
  tenant_id,
  meta_enabled,
  google_enabled,
  tiktok_enabled,
  consent_mode_enabled
)
VALUES (
  'cc000000-0000-0000-0000-000000000001',
  false,
  false,
  false,
  false
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Fix fiscal_settings RLS policies (buggy subquery)
DROP POLICY IF EXISTS "Users can view own tenant fiscal settings" ON public.fiscal_settings;
DROP POLICY IF EXISTS "Users can insert own tenant fiscal settings" ON public.fiscal_settings;
DROP POLICY IF EXISTS "Users can update own tenant fiscal settings" ON public.fiscal_settings;

-- Recreate with correct logic using existing helper functions
CREATE POLICY "Users can view own tenant fiscal settings" 
ON public.fiscal_settings FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can insert own tenant fiscal settings" 
ON public.fiscal_settings FOR INSERT
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR 
  has_role(auth.uid(), tenant_id, 'admin')
);

CREATE POLICY "Users can update own tenant fiscal settings" 
ON public.fiscal_settings FOR UPDATE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR 
  has_role(auth.uid(), tenant_id, 'admin')
);