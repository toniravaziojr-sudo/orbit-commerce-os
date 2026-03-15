
-- Add retry_token to orders for secure card retry on declined payments
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS retry_token TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS retry_token_expires_at TIMESTAMPTZ;

-- Index for fast lookup by retry_token
CREATE INDEX IF NOT EXISTS idx_orders_retry_token ON public.orders (retry_token) WHERE retry_token IS NOT NULL;

-- Function to generate retry token for declined orders
CREATE OR REPLACE FUNCTION public.generate_order_retry_token(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Generate a secure random token
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  
  -- Save token with 24h expiry
  UPDATE public.orders
  SET 
    retry_token = v_token,
    retry_token_expires_at = now() + interval '24 hours'
  WHERE id = p_order_id;
  
  RETURN v_token;
END;
$$;

-- Function to validate retry token and return order data for server-side retry
CREATE OR REPLACE FUNCTION public.validate_order_retry_token(p_token text)
RETURNS TABLE(
  order_id uuid,
  tenant_id uuid,
  order_number text,
  total numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_cpf text,
  shipping_street text,
  shipping_number text,
  shipping_complement text,
  shipping_neighborhood text,
  shipping_city text,
  shipping_state text,
  shipping_postal_code text,
  installments integer,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id AS order_id,
    o.tenant_id,
    o.order_number,
    o.total,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.customer_cpf,
    o.shipping_street,
    o.shipping_number,
    o.shipping_complement,
    o.shipping_neighborhood,
    o.shipping_city,
    o.shipping_state,
    o.shipping_postal_code,
    o.installments,
    (o.retry_token_expires_at > now() AND o.payment_status != 'approved') AS is_valid
  FROM public.orders o
  WHERE o.retry_token = p_token;
END;
$$;
