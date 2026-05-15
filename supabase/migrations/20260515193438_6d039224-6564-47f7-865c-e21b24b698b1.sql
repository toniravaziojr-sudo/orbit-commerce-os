CREATE TABLE public.shipping_content_declarations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  order_id UUID NULL,
  fiscal_invoice_id UUID NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  dc_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued',
  reason TEXT NULL,
  responsibility_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by_user_id UUID NULL,
  sender_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_value_cents BIGINT NOT NULL DEFAULT 0,
  total_weight_grams INTEGER NULL,
  volumes_count INTEGER NOT NULL DEFAULT 1,
  emission_city TEXT NULL,
  pdf_url TEXT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scd_tenant ON public.shipping_content_declarations(tenant_id);
CREATE INDEX idx_scd_order ON public.shipping_content_declarations(order_id);
CREATE INDEX idx_scd_fiscal_invoice ON public.shipping_content_declarations(fiscal_invoice_id);
CREATE UNIQUE INDEX uniq_scd_tenant_dc_number ON public.shipping_content_declarations(tenant_id, dc_number);

CREATE TRIGGER trg_scd_updated_at
BEFORE UPDATE ON public.shipping_content_declarations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shipping_content_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view content declarations"
ON public.shipping_content_declarations
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  OR public.is_platform_admin_by_auth()
);

CREATE POLICY "Tenant operators can insert content declarations"
ON public.shipping_content_declarations
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('owner','admin','operator')
  )
);

CREATE POLICY "Tenant operators can update content declarations"
ON public.shipping_content_declarations
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('owner','admin','operator')
  )
);

CREATE POLICY "Service role full access content declarations"
ON public.shipping_content_declarations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP TABLE IF EXISTS public.fiscal_dce;
