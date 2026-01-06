-- =============================================
-- PHASE 1: Add Meta WhatsApp columns to whatsapp_configs
-- =============================================

-- Add Meta-specific columns to existing whatsapp_configs table
ALTER TABLE public.whatsapp_configs 
ADD COLUMN IF NOT EXISTS waba_id TEXT,
ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS business_id TEXT,
ADD COLUMN IF NOT EXISTS access_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS display_phone_number TEXT,
ADD COLUMN IF NOT EXISTS verified_name TEXT;

-- Create index for phone_number_id lookup (used for inbound routing)
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_phone_number_id 
ON public.whatsapp_configs(phone_number_id) 
WHERE phone_number_id IS NOT NULL;

-- =============================================
-- PHASE 2: Create whatsapp_inbound_messages table
-- =============================================

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta',
  external_message_id TEXT,
  from_phone TEXT NOT NULL,
  to_phone TEXT,
  message_type TEXT DEFAULT 'text',
  message_content TEXT,
  media_url TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  raw_payload JSONB,
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  conversation_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_tenant_id 
ON public.whatsapp_inbound_messages(tenant_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_from_phone 
ON public.whatsapp_inbound_messages(from_phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_timestamp 
ON public.whatsapp_inbound_messages(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_external_id 
ON public.whatsapp_inbound_messages(external_message_id) 
WHERE external_message_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_inbound_messages
-- Tenant members can read their own messages
CREATE POLICY "Tenant members can read their inbound messages"
ON public.whatsapp_inbound_messages
FOR SELECT
USING (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- Platform admins can read all messages (for debugging)
CREATE POLICY "Platform admins can read all inbound messages"
ON public.whatsapp_inbound_messages
FOR SELECT
USING (
  public.is_platform_admin()
);

-- Service role can insert (edge functions)
CREATE POLICY "Service role can insert inbound messages"
ON public.whatsapp_inbound_messages
FOR INSERT
WITH CHECK (true);

-- =============================================
-- PHASE 3: Create meta_whatsapp_onboarding_states table
-- For CSRF protection during OAuth flow
-- =============================================

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_onboarding_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  state_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for state token lookup
CREATE INDEX IF NOT EXISTS idx_meta_onboarding_state_token 
ON public.meta_whatsapp_onboarding_states(state_token);

-- Enable RLS
ALTER TABLE public.meta_whatsapp_onboarding_states ENABLE ROW LEVEL SECURITY;

-- Only service role can manage (edge functions handle this)
CREATE POLICY "Service role manages onboarding states"
ON public.meta_whatsapp_onboarding_states
FOR ALL
USING (true)
WITH CHECK (true);