-- F-Onda1-B: Padronizar RLS de system_email_templates para usar is_platform_admin()
-- Motivo: policies atuais cruzam platform_admins.email com profiles.email via subselect,
-- criando dependência indireta da RLS de profiles. is_platform_admin() é SECURITY DEFINER,
-- consulta auth.users.email diretamente e é o gate canônico já usado pelo frontend.

DROP POLICY IF EXISTS "platform_admin_select_system_email_templates" ON public.system_email_templates;
DROP POLICY IF EXISTS "platform_admin_update_system_email_templates" ON public.system_email_templates;
DROP POLICY IF EXISTS "platform_admin_insert_system_email_templates" ON public.system_email_templates;

CREATE POLICY "platform_admin_select_system_email_templates"
ON public.system_email_templates
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY "platform_admin_insert_system_email_templates"
ON public.system_email_templates
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY "platform_admin_update_system_email_templates"
ON public.system_email_templates
FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

COMMENT ON TABLE public.system_email_templates IS
  'Templates de email da plataforma. RLS canônica via public.is_platform_admin() — Onda 1 / Saneamento Plataforma Admin.';