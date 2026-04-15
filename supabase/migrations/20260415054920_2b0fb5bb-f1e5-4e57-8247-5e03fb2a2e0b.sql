
-- Add tracking metrics to campaigns
ALTER TABLE public.email_marketing_campaigns
  ADD COLUMN IF NOT EXISTS sent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_value_cents bigint NOT NULL DEFAULT 0;

-- Add campaign_id to email_events if not exists
ALTER TABLE public.email_events
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.email_marketing_campaigns(id);

-- Tracking tokens table
CREATE TABLE IF NOT EXISTS public.email_tracking_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  campaign_id uuid NOT NULL REFERENCES public.email_marketing_campaigns(id),
  subscriber_id uuid NOT NULL REFERENCES public.email_marketing_subscribers(id),
  token text NOT NULL UNIQUE,
  opened_at timestamptz,
  clicked_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_tokens_token ON public.email_tracking_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_tracking_tokens_campaign ON public.email_tracking_tokens(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_tokens_subscriber ON public.email_tracking_tokens(subscriber_id);

ALTER TABLE public.email_tracking_tokens ENABLE ROW LEVEL SECURITY;

-- Public read/write for tracking (edge function uses service role, but pixel/redirect need public access)
CREATE POLICY "Service can manage tracking tokens"
  ON public.email_tracking_tokens FOR ALL
  USING (true) WITH CHECK (true);

-- Conversions table
CREATE TABLE IF NOT EXISTS public.email_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  campaign_id uuid NOT NULL REFERENCES public.email_marketing_campaigns(id),
  subscriber_id uuid REFERENCES public.email_marketing_subscribers(id),
  order_id uuid REFERENCES public.orders(id),
  value_cents bigint NOT NULL DEFAULT 0,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_conversions_campaign ON public.email_conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_conversions_order ON public.email_conversions(order_id);

ALTER TABLE public.email_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view conversions"
  ON public.email_conversions FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service can insert conversions"
  ON public.email_conversions FOR INSERT
  WITH CHECK (true);
