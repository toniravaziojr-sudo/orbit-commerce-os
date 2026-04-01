
-- 1. Create upsert_subscriber_only (for leads/forms — NEVER creates customer)
CREATE OR REPLACE FUNCTION public.upsert_subscriber_only(
  p_tenant_id uuid,
  p_email text,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_list_id uuid DEFAULT NULL
)
RETURNS TABLE(subscriber_id uuid, is_new_subscriber boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subscriber_id UUID;
  v_is_new BOOLEAN := false;
  v_normalized_email TEXT;
  v_customer_id UUID;
  v_tag_id UUID;
BEGIN
  v_normalized_email := LOWER(TRIM(p_email));

  -- Find or create subscriber
  SELECT s.id INTO v_subscriber_id
  FROM email_marketing_subscribers s
  WHERE s.tenant_id = p_tenant_id AND s.email = v_normalized_email;

  IF v_subscriber_id IS NULL THEN
    INSERT INTO email_marketing_subscribers (
      tenant_id, email, name, phone, source, created_from, status
    ) VALUES (
      p_tenant_id, v_normalized_email, p_name, p_phone, p_source, p_source, 'active'
    ) RETURNING email_marketing_subscribers.id INTO v_subscriber_id;
    v_is_new := true;
  ELSE
    UPDATE email_marketing_subscribers s2
    SET
      name = COALESCE(p_name, s2.name),
      phone = COALESCE(p_phone, s2.phone),
      birth_date = COALESCE(p_birth_date, s2.birth_date),
      updated_at = now()
    WHERE s2.id = v_subscriber_id;
  END IF;

  -- Link to existing customer if one exists (but NEVER create one)
  SELECT c.id INTO v_customer_id
  FROM customers c
  WHERE c.tenant_id = p_tenant_id AND c.email = v_normalized_email AND c.deleted_at IS NULL;

  IF v_customer_id IS NOT NULL THEN
    UPDATE email_marketing_subscribers s3
    SET customer_id = v_customer_id
    WHERE s3.id = v_subscriber_id AND s3.customer_id IS NULL;
  END IF;

  -- Add to list if specified
  IF p_list_id IS NOT NULL THEN
    INSERT INTO email_marketing_list_members (tenant_id, list_id, subscriber_id)
    VALUES (p_tenant_id, p_list_id, v_subscriber_id)
    ON CONFLICT DO NOTHING;

    -- If customer exists and list has tag, assign tag to customer
    IF v_customer_id IS NOT NULL THEN
      SELECT l.tag_id INTO v_tag_id
      FROM email_marketing_lists l
      WHERE l.id = p_list_id;

      IF v_tag_id IS NOT NULL THEN
        INSERT INTO customer_tag_assignments (customer_id, tag_id)
        VALUES (v_customer_id, v_tag_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT v_subscriber_id, v_is_new;
END;
$$;

-- 2. Refactor trg_recalc_customer_on_order: metrics + subscriber only, NO customer creation, NO tag assignment
CREATE OR REPLACE FUNCTION public.trg_recalc_customer_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.payment_status = 'approved' AND (OLD IS NULL OR OLD.payment_status IS DISTINCT FROM 'approved') THEN
    -- Recalculate metrics (uses customer_email)
    IF NEW.customer_email IS NOT NULL AND TRIM(NEW.customer_email) != '' THEN
      PERFORM public.recalc_customer_metrics(NEW.tenant_id, NEW.customer_email);

      -- Sync subscriber only (does NOT create customer)
      PERFORM public.upsert_subscriber_only(
        NEW.tenant_id,
        NEW.customer_email,
        NEW.customer_name,
        NEW.customer_phone,
        NULL,
        'order',
        (SELECT l.id FROM public.email_marketing_lists l
         JOIN public.customer_tags t ON l.tag_id = t.id
         WHERE l.tenant_id = NEW.tenant_id AND t.name = 'Cliente'
         LIMIT 1)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Drop trigger_update_customer_first_order (redundant, inflates metrics)
DROP TRIGGER IF EXISTS trigger_update_customer_first_order ON public.orders;
DROP FUNCTION IF EXISTS public.update_customer_first_order();

-- 4. Create ensure_customer_tag helper (for importer/manual creation)
CREATE OR REPLACE FUNCTION public.ensure_customer_tag(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_tag_name text DEFAULT 'Cliente'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tag_id UUID;
BEGIN
  -- Find or create the tag
  SELECT id INTO v_tag_id
  FROM customer_tags
  WHERE tenant_id = p_tenant_id AND name = p_tag_name
  LIMIT 1;

  IF v_tag_id IS NULL THEN
    INSERT INTO customer_tags (tenant_id, name, color, description)
    VALUES (p_tenant_id, p_tag_name, '#10B981', 'Clientes com pedido aprovado')
    RETURNING id INTO v_tag_id;
  END IF;

  INSERT INTO customer_tag_assignments (customer_id, tag_id)
  VALUES (p_customer_id, v_tag_id)
  ON CONFLICT (customer_id, tag_id) DO NOTHING;
END;
$$;
