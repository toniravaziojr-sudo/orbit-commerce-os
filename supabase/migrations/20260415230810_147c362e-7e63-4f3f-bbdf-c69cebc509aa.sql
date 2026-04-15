
-- Add sales_mode_enabled to ai_support_config
ALTER TABLE public.ai_support_config
ADD COLUMN IF NOT EXISTS sales_mode_enabled BOOLEAN DEFAULT false;

-- Create whatsapp_carts table
CREATE TABLE public.whatsapp_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  coupon_code TEXT,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'abandoned')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by conversation
CREATE INDEX idx_whatsapp_carts_conversation ON public.whatsapp_carts(conversation_id);
CREATE INDEX idx_whatsapp_carts_tenant_status ON public.whatsapp_carts(tenant_id, status);

-- Enable RLS
ALTER TABLE public.whatsapp_carts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant members can view carts"
ON public.whatsapp_carts FOR SELECT
TO authenticated
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can create carts"
ON public.whatsapp_carts FOR INSERT
TO authenticated
WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can update carts"
ON public.whatsapp_carts FOR UPDATE
TO authenticated
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can delete carts"
ON public.whatsapp_carts FOR DELETE
TO authenticated
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Service role full access for edge functions
CREATE POLICY "Service role full access on whatsapp_carts"
ON public.whatsapp_carts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_whatsapp_carts_updated_at
BEFORE UPDATE ON public.whatsapp_carts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
