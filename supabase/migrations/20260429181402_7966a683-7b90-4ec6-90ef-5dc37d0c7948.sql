-- =========================================================
-- FASE 1: Fundação — versão final
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.shipping_provider_kind AS ENUM ('gateway','contract','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shipping_routing_reason AS ENUM (
    'customer_choice','tracking_inheritance','single_active',
    'manual_third_party','marketplace','imported','unresolved'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.shipping_providers
  ADD COLUMN IF NOT EXISTS provider_kind public.shipping_provider_kind NOT NULL DEFAULT 'contract',
  ADD COLUMN IF NOT EXISTS gateway_capabilities jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.shipping_providers
   SET provider_kind = 'gateway',
       gateway_capabilities = jsonb_build_object(
         'accepts_invoice_key', true,
         'accepts_dce', true,
         'supports_webhook_tracking', true,
         'supports_label_download', true,
         'panel_url', 'https://app.frenet.com.br/'
       )
 WHERE provider = 'frenet';

UPDATE public.shipping_providers
   SET provider_kind = 'contract'
 WHERE provider IN ('correios','loggi','jadlog','melhor_envio');

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS resolved_shipping_provider_id uuid
    REFERENCES public.shipping_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_shipping_provider_kind public.shipping_provider_kind,
  ADD COLUMN IF NOT EXISTS resolved_shipping_reason public.shipping_routing_reason;

CREATE INDEX IF NOT EXISTS idx_orders_resolved_shipping_kind
  ON public.orders(resolved_shipping_provider_kind)
  WHERE resolved_shipping_provider_kind IS NOT NULL;

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'fulfilled' AFTER 'invoice_authorized';

-- ===== gateway_sync_queue =====
CREATE TABLE IF NOT EXISTS public.gateway_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.shipping_providers(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('sync_order','attach_invoice','attach_dce','request_label','cancel')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed','skipped')),
  attempts int NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  external_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gateway_sync_queue_pending
  ON public.gateway_sync_queue(next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_gateway_sync_queue_tenant
  ON public.gateway_sync_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gateway_sync_queue_order
  ON public.gateway_sync_queue(order_id, action);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gateway_sync_queue_order_action_pending
  ON public.gateway_sync_queue(order_id, action)
  WHERE status IN ('pending','processing');

ALTER TABLE public.gateway_sync_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members view their gateway_sync_queue" ON public.gateway_sync_queue;
CREATE POLICY "Tenant members view their gateway_sync_queue"
  ON public.gateway_sync_queue FOR SELECT
  USING (
    tenant_id IN (SELECT p.current_tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage gateway_sync_queue" ON public.gateway_sync_queue;
CREATE POLICY "Admins manage gateway_sync_queue"
  ON public.gateway_sync_queue FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur
             WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','owner'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur
             WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','owner'))
  );

-- ===== fiscal_dce =====
CREATE TABLE IF NOT EXISTS public.fiscal_dce (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','queued','processing','authorized','rejected','cancelled')),
  numero text,
  serie text,
  chave text,
  pdf_url text,
  xml_url text,
  rejection_reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  authorized_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_dce_tenant ON public.fiscal_dce(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_dce_order ON public.fiscal_dce(order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_dce_status ON public.fiscal_dce(status);

ALTER TABLE public.fiscal_dce ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members view their DC-e" ON public.fiscal_dce;
CREATE POLICY "Tenant members view their DC-e"
  ON public.fiscal_dce FOR SELECT
  USING (
    tenant_id IN (SELECT p.current_tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant members insert DC-e" ON public.fiscal_dce;
CREATE POLICY "Tenant members insert DC-e"
  ON public.fiscal_dce FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT p.current_tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant members update DC-e" ON public.fiscal_dce;
CREATE POLICY "Tenant members update DC-e"
  ON public.fiscal_dce FOR UPDATE
  USING (
    tenant_id IN (SELECT p.current_tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant members delete draft DC-e" ON public.fiscal_dce;
CREATE POLICY "Tenant members delete draft DC-e"
  ON public.fiscal_dce FOR DELETE
  USING (
    status = 'draft'
    AND tenant_id IN (SELECT p.current_tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP TRIGGER IF EXISTS trg_fiscal_dce_updated_at ON public.fiscal_dce;
CREATE TRIGGER trg_fiscal_dce_updated_at
  BEFORE UPDATE ON public.fiscal_dce
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Função resolver =====
CREATE OR REPLACE FUNCTION public.resolve_order_shipping_provider(p_order_id uuid)
RETURNS TABLE (
  provider_id uuid,
  provider_kind public.shipping_provider_kind,
  reason public.shipping_routing_reason
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_carrier text;
  v_channel text;
  v_chosen RECORD;
  v_inherit RECORD;
  v_only RECORD;
  v_active_count int;
BEGIN
  SELECT o.tenant_id, lower(coalesce(o.shipping_carrier,'')), lower(coalesce(o.channel_source,''))
    INTO v_tenant_id, v_carrier, v_channel
    FROM public.orders o WHERE o.id = p_order_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF v_channel LIKE 'marketplace%' OR v_channel IN ('mercado_livre','shopee','amazon','magalu') THEN
    RETURN QUERY SELECT NULL::uuid, NULL::public.shipping_provider_kind, 'marketplace'::public.shipping_routing_reason;
    RETURN;
  END IF;

  IF v_carrier IN ('manual','third_party','frete_terceiros','terceiros') THEN
    RETURN QUERY SELECT NULL::uuid, 'manual'::public.shipping_provider_kind, 'manual_third_party'::public.shipping_routing_reason;
    RETURN;
  END IF;

  SELECT sp.id, sp.provider_kind, sp.supports_quote, sp.supports_tracking
    INTO v_chosen
    FROM public.shipping_providers sp
   WHERE sp.tenant_id = v_tenant_id
     AND sp.is_enabled = true
     AND lower(sp.provider) = v_carrier
   ORDER BY sp.supports_tracking DESC, sp.supports_quote DESC
   LIMIT 1;

  IF v_chosen.id IS NOT NULL THEN
    IF v_chosen.supports_tracking THEN
      RETURN QUERY SELECT v_chosen.id, v_chosen.provider_kind, 'customer_choice'::public.shipping_routing_reason;
      RETURN;
    END IF;

    SELECT sp.id, sp.provider_kind
      INTO v_inherit
      FROM public.shipping_providers sp
     WHERE sp.tenant_id = v_tenant_id
       AND sp.is_enabled = true
       AND sp.supports_tracking = true
     ORDER BY (sp.provider_kind = 'contract') DESC
     LIMIT 1;

    IF v_inherit.id IS NOT NULL THEN
      RETURN QUERY SELECT v_inherit.id, v_inherit.provider_kind, 'tracking_inheritance'::public.shipping_routing_reason;
      RETURN;
    END IF;

    RETURN QUERY SELECT v_chosen.id, v_chosen.provider_kind, 'single_active'::public.shipping_routing_reason;
    RETURN;
  END IF;

  SELECT count(*) INTO v_active_count
    FROM public.shipping_providers sp
   WHERE sp.tenant_id = v_tenant_id AND sp.is_enabled = true;

  IF v_active_count = 1 THEN
    SELECT sp.id, sp.provider_kind
      INTO v_only
      FROM public.shipping_providers sp
     WHERE sp.tenant_id = v_tenant_id AND sp.is_enabled = true
     LIMIT 1;
    RETURN QUERY SELECT v_only.id, v_only.provider_kind, 'single_active'::public.shipping_routing_reason;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::uuid, NULL::public.shipping_provider_kind, 'unresolved'::public.shipping_routing_reason;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_order_shipping_provider(uuid) TO authenticated, service_role;