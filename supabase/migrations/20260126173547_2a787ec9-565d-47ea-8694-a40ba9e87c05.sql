-- Table for review tokens
-- Stores secure tokens for product review requests sent via notifications
CREATE TABLE public.review_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email TEXT,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_review_tokens_tenant ON public.review_tokens(tenant_id);
CREATE INDEX idx_review_tokens_order ON public.review_tokens(order_id);
CREATE INDEX idx_review_tokens_token ON public.review_tokens(token);
CREATE INDEX idx_review_tokens_expires ON public.review_tokens(expires_at) WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE public.review_tokens ENABLE ROW LEVEL SECURITY;

-- Policies: tokens are created by system (edge functions with service role)
-- Public can validate tokens for the review page
CREATE POLICY "Anyone can validate review tokens"
ON public.review_tokens FOR SELECT
USING (true);

-- Only service role can insert/update tokens (handled by edge functions)
-- No user-facing insert/update policies needed

-- Function to generate review token for an order
CREATE OR REPLACE FUNCTION public.generate_review_token(p_tenant_id uuid, p_order_id uuid, p_customer_id uuid DEFAULT NULL, p_customer_email text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token TEXT;
  v_existing TEXT;
BEGIN
  -- Check if token already exists for this order
  SELECT token INTO v_existing
  FROM public.review_tokens
  WHERE tenant_id = p_tenant_id 
    AND order_id = p_order_id 
    AND expires_at > now()
    AND used_at IS NULL;
  
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;
  
  -- Generate new secure token
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  
  -- Insert token
  INSERT INTO public.review_tokens (tenant_id, order_id, customer_id, customer_email, token)
  VALUES (p_tenant_id, p_order_id, p_customer_id, p_customer_email, v_token);
  
  RETURN v_token;
END;
$function$;

-- Function to validate and get review token details
CREATE OR REPLACE FUNCTION public.validate_review_token(p_token text)
RETURNS TABLE(
  token_id uuid,
  tenant_id uuid,
  order_id uuid,
  customer_id uuid,
  customer_email text,
  is_valid boolean,
  store_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    rt.id AS token_id,
    rt.tenant_id,
    rt.order_id,
    rt.customer_id,
    rt.customer_email,
    (rt.expires_at > now() AND rt.used_at IS NULL) AS is_valid,
    COALESCE(t.custom_domain, t.slug || '.comandocentral.com.br') AS store_url
  FROM public.review_tokens rt
  JOIN public.tenants t ON t.id = rt.tenant_id
  WHERE rt.token = p_token;
END;
$function$;