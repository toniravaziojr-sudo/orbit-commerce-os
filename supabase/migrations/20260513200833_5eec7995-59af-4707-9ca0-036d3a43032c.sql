
-- =========================================================
-- LOTE 1.B — Hardening RLS multi-tenant fiscal
-- =========================================================

-- A) fiscal_settings: bloquear leitura de colunas sensíveis no client e restringir SELECT a owners/admins
REVOKE SELECT (certificado_pfx, certificado_senha, provider_token)
  ON public.fiscal_settings FROM anon, authenticated, PUBLIC;

DROP POLICY IF EXISTS "Users can view own tenant fiscal settings" ON public.fiscal_settings;
CREATE POLICY "Owners and admins view fiscal settings"
  ON public.fiscal_settings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), tenant_id, 'owner'::public.app_role)
    OR public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
  );

-- B) fiscal_invoices: trocar profiles.current_tenant_id por user_belongs_to_tenant
DROP POLICY IF EXISTS "Users can view own tenant invoices" ON public.fiscal_invoices;
DROP POLICY IF EXISTS "Users can insert own tenant invoices" ON public.fiscal_invoices;
DROP POLICY IF EXISTS "Users can update own tenant invoices" ON public.fiscal_invoices;
DROP POLICY IF EXISTS "Users can delete own tenant draft invoices" ON public.fiscal_invoices;

CREATE POLICY "Tenant members view invoices"
  ON public.fiscal_invoices FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Tenant members insert invoices"
  ON public.fiscal_invoices FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Tenant members update invoices"
  ON public.fiscal_invoices FOR UPDATE TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Owners and admins delete draft invoices"
  ON public.fiscal_invoices FOR DELETE TO authenticated
  USING (
    status = 'draft'
    AND (
      public.has_role(auth.uid(), tenant_id, 'owner'::public.app_role)
      OR public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
    )
  );

-- C) fiscal_invoice_items: isolar via parent fiscal_invoices com user_belongs_to_tenant
DROP POLICY IF EXISTS "Users can manage invoice items" ON public.fiscal_invoice_items;
DROP POLICY IF EXISTS "Users can view invoice items" ON public.fiscal_invoice_items;

CREATE POLICY "Tenant members view invoice items"
  ON public.fiscal_invoice_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fiscal_invoices fi
      WHERE fi.id = invoice_id
        AND public.user_belongs_to_tenant(auth.uid(), fi.tenant_id)
    )
  );
CREATE POLICY "Tenant members manage invoice items"
  ON public.fiscal_invoice_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fiscal_invoices fi
      WHERE fi.id = invoice_id
        AND public.user_belongs_to_tenant(auth.uid(), fi.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fiscal_invoices fi
      WHERE fi.id = invoice_id
        AND public.user_belongs_to_tenant(auth.uid(), fi.tenant_id)
    )
  );

-- D) fiscal_invoice_events
DROP POLICY IF EXISTS "Users can view own tenant invoice events" ON public.fiscal_invoice_events;
DROP POLICY IF EXISTS "Users can insert invoice events" ON public.fiscal_invoice_events;

CREATE POLICY "Tenant members view invoice events"
  ON public.fiscal_invoice_events FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Tenant members insert invoice events"
  ON public.fiscal_invoice_events FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- E) fiscal_dce
DROP POLICY IF EXISTS "Tenant members view their DC-e" ON public.fiscal_dce;
DROP POLICY IF EXISTS "Tenant members insert DC-e" ON public.fiscal_dce;
DROP POLICY IF EXISTS "Tenant members update DC-e" ON public.fiscal_dce;
DROP POLICY IF EXISTS "Tenant members delete draft DC-e" ON public.fiscal_dce;

CREATE POLICY "Tenant members view DC-e"
  ON public.fiscal_dce FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Tenant members insert DC-e"
  ON public.fiscal_dce FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Tenant members update DC-e"
  ON public.fiscal_dce FOR UPDATE TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Tenant members delete draft DC-e"
  ON public.fiscal_dce FOR DELETE TO authenticated
  USING (status = 'draft' AND public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- F) fiscal_products
DROP POLICY IF EXISTS "Users can manage own tenant fiscal products" ON public.fiscal_products;
DROP POLICY IF EXISTS "Users can view own tenant fiscal products" ON public.fiscal_products;

CREATE POLICY "Tenant members view fiscal products"
  ON public.fiscal_products FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Tenant members manage fiscal products"
  ON public.fiscal_products FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
