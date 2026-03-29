
-- 1. Fix auto_tag_cliente: remove o DELETE destrutivo de todas as tags
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
  IF NEW.payment_status = 'approved' AND (OLD.payment_status IS NULL OR OLD.payment_status <> 'approved') THEN
    
    v_customer_id := NEW.customer_id;
    
    IF v_customer_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Buscar ou criar tag "Cliente"
    SELECT id INTO v_cliente_tag_id
    FROM customer_tags
    WHERE tenant_id = NEW.tenant_id AND name = 'Cliente'
    LIMIT 1;
    
    IF v_cliente_tag_id IS NULL THEN
      INSERT INTO customer_tags (tenant_id, name, color, description)
      VALUES (NEW.tenant_id, 'Cliente', '#10B981', 'Clientes com pedido aprovado')
      RETURNING id INTO v_cliente_tag_id;
    END IF;
    
    -- SÓ adicionar a tag Cliente, SEM deletar as outras tags
    INSERT INTO customer_tag_assignments (customer_id, tag_id)
    VALUES (v_customer_id, v_cliente_tag_id)
    ON CONFLICT (customer_id, tag_id) DO NOTHING;
    
    RAISE LOG '[auto_tag_cliente] Customer % tagged with Cliente tag % for order %', 
      v_customer_id, v_cliente_tag_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Fix sync_subscriber_on_tag_assignment: adicionar à email_marketing_list_members (dedup por email)
CREATE OR REPLACE FUNCTION public.sync_subscriber_on_tag_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_customer RECORD;
  v_list RECORD;
  v_subscriber_id UUID;
BEGIN
  -- Buscar dados do customer
  SELECT id, tenant_id, email, full_name, phone INTO v_customer
  FROM customers
  WHERE id = NEW.customer_id AND deleted_at IS NULL;
  
  IF v_customer.email IS NULL OR TRIM(v_customer.email) = '' THEN
    RETURN NEW;
  END IF;
  
  -- Para cada lista vinculada a esta tag
  FOR v_list IN 
    SELECT id FROM email_marketing_lists WHERE tag_id = NEW.tag_id
  LOOP
    -- Upsert subscriber (deduplicação por email no tenant)
    INSERT INTO email_marketing_subscribers (
      tenant_id, email, name, phone, status, source, customer_id, created_from
    ) VALUES (
      v_customer.tenant_id,
      LOWER(TRIM(v_customer.email)),
      v_customer.full_name,
      v_customer.phone,
      'active',
      'tag_assignment',
      v_customer.id,
      'tag_assignment'
    )
    ON CONFLICT (tenant_id, email) DO UPDATE SET
      customer_id = COALESCE(email_marketing_subscribers.customer_id, v_customer.id),
      name = COALESCE(NULLIF(v_customer.full_name, ''), email_marketing_subscribers.name),
      phone = COALESCE(v_customer.phone, email_marketing_subscribers.phone),
      status = 'active',
      updated_at = now()
    RETURNING id INTO v_subscriber_id;
    
    -- Adicionar à lista (deduplicação por list_id + subscriber_id)
    IF v_subscriber_id IS NOT NULL THEN
      INSERT INTO email_marketing_list_members (tenant_id, list_id, subscriber_id)
      VALUES (v_customer.tenant_id, v_list.id, v_subscriber_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Fix sync_list_subscribers_from_tag: também inserir em list_members
CREATE OR REPLACE FUNCTION public.sync_list_subscribers_from_tag(p_list_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tag_id UUID;
  v_tenant_id UUID;
  v_inserted INT := 0;
  v_sub RECORD;
BEGIN
  -- Buscar dados da lista
  SELECT tag_id, tenant_id INTO v_tag_id, v_tenant_id
  FROM email_marketing_lists
  WHERE id = p_list_id;
  
  IF v_tag_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Lista não encontrada ou sem tag');
  END IF;
  
  -- Upsert subscribers
  FOR v_sub IN
    INSERT INTO email_marketing_subscribers (
      tenant_id, email, name, phone, status, source, customer_id, created_from
    )
    SELECT 
      v_tenant_id,
      LOWER(TRIM(c.email)),
      c.full_name,
      c.phone,
      'active',
      'tag_sync:' || p_list_id::text,
      c.id,
      'tag_sync'
    FROM customers c
    INNER JOIN customer_tag_assignments cta ON cta.customer_id = c.id
    WHERE cta.tag_id = v_tag_id
      AND c.tenant_id = v_tenant_id
      AND c.deleted_at IS NULL
      AND c.email IS NOT NULL
      AND TRIM(c.email) <> ''
    ON CONFLICT (tenant_id, email) DO UPDATE SET
      customer_id = COALESCE(email_marketing_subscribers.customer_id, EXCLUDED.customer_id),
      name = COALESCE(NULLIF(EXCLUDED.name, ''), email_marketing_subscribers.name),
      phone = COALESCE(EXCLUDED.phone, email_marketing_subscribers.phone),
      updated_at = now()
    RETURNING id, tenant_id
  LOOP
    -- Adicionar à lista
    INSERT INTO email_marketing_list_members (tenant_id, list_id, subscriber_id)
    VALUES (v_sub.tenant_id, p_list_id, v_sub.id)
    ON CONFLICT DO NOTHING;
    
    v_inserted := v_inserted + 1;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'synced', v_inserted
  );
END;
$function$;
