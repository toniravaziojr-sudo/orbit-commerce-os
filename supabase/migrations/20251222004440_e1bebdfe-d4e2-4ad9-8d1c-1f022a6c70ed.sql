-- Corrigir search_path nas funções criadas
CREATE OR REPLACE FUNCTION public.get_discount_usage(p_discount_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM public.discount_redemptions
  WHERE discount_id = p_discount_id
    AND status IN ('reserved', 'applied');
$$;

CREATE OR REPLACE FUNCTION public.get_discount_usage_by_customer(p_discount_id UUID, p_email TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM public.discount_redemptions
  WHERE discount_id = p_discount_id
    AND LOWER(customer_email) = LOWER(p_email)
    AND status IN ('reserved', 'applied');
$$;