-- Fix RLS policies for system_email_templates to use platform_admins table instead of hardcoded email
DROP POLICY IF EXISTS "Only platform admin can view system email templates" ON public.system_email_templates;
DROP POLICY IF EXISTS "Only platform admin can update system email templates" ON public.system_email_templates;
DROP POLICY IF EXISTS "Only platform admin can insert system email templates" ON public.system_email_templates;

-- SELECT policy: platform admins can view templates
CREATE POLICY "platform_admin_select_system_email_templates"
ON public.system_email_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.email = (
      SELECT email FROM profiles WHERE id = auth.uid()
    )
    AND pa.is_active = true
  )
);

-- UPDATE policy: platform admins can update templates
CREATE POLICY "platform_admin_update_system_email_templates"
ON public.system_email_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.email = (
      SELECT email FROM profiles WHERE id = auth.uid()
    )
    AND pa.is_active = true
  )
);

-- INSERT policy: platform admins can insert templates
CREATE POLICY "platform_admin_insert_system_email_templates"
ON public.system_email_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.email = (
      SELECT email FROM profiles WHERE id = auth.uid()
    )
    AND pa.is_active = true
  )
);