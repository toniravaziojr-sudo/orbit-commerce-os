-- Webhook events table
CREATE TABLE public.tiktok_shop_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_id text,
  shop_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiktok_webhook_events_tenant ON public.tiktok_shop_webhook_events(tenant_id);
CREATE INDEX idx_tiktok_webhook_events_status ON public.tiktok_shop_webhook_events(status);
CREATE INDEX idx_tiktok_webhook_events_event_id ON public.tiktok_shop_webhook_events(event_id);

ALTER TABLE public.tiktok_shop_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view webhook events"
  ON public.tiktok_shop_webhook_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id = tiktok_shop_webhook_events.tenant_id
  ));

-- Add stock_quantity to tiktok_shop_products
ALTER TABLE public.tiktok_shop_products
  ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_synced_at timestamptz;