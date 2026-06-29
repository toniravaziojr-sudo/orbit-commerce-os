-- Onda 4: bloquear inscrição automática de emails sintéticos do Mercado Livre
-- no email_marketing_subscribers via tag_assignment.
-- Motivo: domínio @marketplace.local não é um e-mail real do cliente (LGPD + UX).

CREATE OR REPLACE FUNCTION public.sync_subscriber_on_tag_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer RECORD;
  v_list RECORD;
  v_subscriber_id UUID;
  v_email_lower TEXT;
BEGIN
  SELECT id, tenant_id, email, full_name, phone INTO v_customer
  FROM customers
  WHERE id = NEW.customer_id AND deleted_at IS NULL;

  IF v_customer.email IS NULL OR TRIM(v_customer.email) = '' THEN
    RETURN NEW;
  END IF;

  v_email_lower := LOWER(TRIM(v_customer.email));

  -- BLOQUEIO: emails sintéticos de marketplace (Mercado Livre etc.)
  -- não devem entrar em listas de e-mail marketing. São placeholders internos.
  IF v_email_lower LIKE '%@marketplace.local' THEN
    RETURN NEW;
  END IF;

  FOR v_list IN
    SELECT id FROM email_marketing_lists WHERE tag_id = NEW.tag_id
  LOOP
    INSERT INTO email_marketing_subscribers (
      tenant_id, email, name, phone, status, source, customer_id, created_from
    ) VALUES (
      v_customer.tenant_id,
      v_email_lower,
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

    IF v_subscriber_id IS NOT NULL THEN
      INSERT INTO email_marketing_list_members (tenant_id, list_id, subscriber_id)
      VALUES (v_customer.tenant_id, v_list.id, v_subscriber_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;