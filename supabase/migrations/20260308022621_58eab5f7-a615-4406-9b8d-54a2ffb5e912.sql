-- Fix trigger that uses wrong enum value ('paid' instead of 'approved')
CREATE OR REPLACE FUNCTION public.auto_tag_cliente_on_payment_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id UUID;
  v_cliente_tag_id UUID;
BEGIN
  -- Fix: use 'approved' which is the correct payment_status enum value
  IF NEW.payment_status = 'approved' AND (OLD.payment_status IS NULL OR OLD.payment_status <> 'approved') THEN
    
    v_customer_id := NEW.customer_id;
    
    IF v_customer_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    SELECT id INTO v_cliente_tag_id
    FROM customer_tags
    WHERE tenant_id = NEW.tenant_id AND name = 'Cliente'
    LIMIT 1;
    
    IF v_cliente_tag_id IS NULL THEN
      INSERT INTO customer_tags (tenant_id, name, color, description)
      VALUES (NEW.tenant_id, 'Cliente', '#10B981', 'Clientes com pedido aprovado')
      RETURNING id INTO v_cliente_tag_id;
    END IF;
    
    DELETE FROM customer_tag_assignments
    WHERE customer_id = v_customer_id;
    
    INSERT INTO customer_tag_assignments (customer_id, tag_id)
    VALUES (v_customer_id, v_cliente_tag_id)
    ON CONFLICT (customer_id, tag_id) DO NOTHING;
    
    RAISE LOG '[auto_tag_cliente] Customer % tagged with Cliente tag % for order %', 
      v_customer_id, v_cliente_tag_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Now fix the stuck orders
UPDATE orders SET 
  payment_status = 'approved', 
  status = 'paid', 
  paid_at = pt.paid_at,
  updated_at = now()
FROM payment_transactions pt
WHERE pt.order_id = orders.id 
  AND pt.status = 'paid' 
  AND orders.payment_status = 'pending';