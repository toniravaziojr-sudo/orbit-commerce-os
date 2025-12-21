
-- Create payment_events table for webhook idempotency and audit
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  provider TEXT NOT NULL DEFAULT 'pagarme',
  event_id TEXT NOT NULL,
  provider_payment_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_result TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_unique_event UNIQUE (provider, event_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_payment_events_provider_payment_id 
  ON public.payment_events(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_tenant_id 
  ON public.payment_events(tenant_id);

-- Enable RLS
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Only allow service role to access (via edge functions)
CREATE POLICY "Service role full access on payment_events"
  ON public.payment_events
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Add comment
COMMENT ON TABLE public.payment_events IS 'Audit log for payment webhook events with idempotency';
