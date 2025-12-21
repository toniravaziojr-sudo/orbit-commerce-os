
-- Add next_order_number column to tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS next_order_number INTEGER NOT NULL DEFAULT 1000;

-- Set next_order_number for "Respeite o Homem" to 5000
UPDATE public.tenants 
SET next_order_number = 5000 
WHERE id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';

-- Replace the order number generation function
CREATE OR REPLACE FUNCTION public.generate_order_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_number INTEGER;
BEGIN
  -- Atomically get and increment the next_order_number
  UPDATE public.tenants
  SET next_order_number = next_order_number + 1
  WHERE id = p_tenant_id
  RETURNING next_order_number - 1 INTO v_number;
  
  -- If tenant not found, return a fallback
  IF v_number IS NULL THEN
    RETURN '#' || EXTRACT(EPOCH FROM NOW())::INTEGER;
  END IF;
  
  -- Return order number in format #XXXX
  RETURN '#' || v_number::TEXT;
END;
$function$;
