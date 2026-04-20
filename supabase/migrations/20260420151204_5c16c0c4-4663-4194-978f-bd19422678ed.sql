
-- WhatsApp Health Incidents — defesas anti-regressão
CREATE TABLE IF NOT EXISTS public.whatsapp_health_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_type text NOT NULL CHECK (incident_type IN (
    'orphan_messages',
    'webhook_subscription_lost',
    'token_invalid',
    'inbound_silent_too_long'
  )),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title text NOT NULL,
  detail text,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_incidents_tenant_status
  ON public.whatsapp_health_incidents(tenant_id, status, detected_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wa_incidents_open_per_type
  ON public.whatsapp_health_incidents(tenant_id, incident_type)
  WHERE status = 'open';

ALTER TABLE public.whatsapp_health_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can read incidents" ON public.whatsapp_health_incidents;
CREATE POLICY "Tenant members can read incidents"
  ON public.whatsapp_health_incidents FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant members can ack incidents" ON public.whatsapp_health_incidents;
CREATE POLICY "Tenant members can ack incidents"
  ON public.whatsapp_health_incidents FOR UPDATE
  USING (user_belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Service role full access incidents" ON public.whatsapp_health_incidents;
CREATE POLICY "Service role full access incidents"
  ON public.whatsapp_health_incidents FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins read all incidents" ON public.whatsapp_health_incidents;
CREATE POLICY "Platform admins read all incidents"
  ON public.whatsapp_health_incidents FOR SELECT
  USING (is_platform_admin());

DROP TRIGGER IF EXISTS trg_wa_incidents_updated_at ON public.whatsapp_health_incidents;
CREATE TRIGGER trg_wa_incidents_updated_at
  BEFORE UPDATE ON public.whatsapp_health_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
