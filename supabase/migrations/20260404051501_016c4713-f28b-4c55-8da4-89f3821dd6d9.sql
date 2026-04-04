CREATE OR REPLACE FUNCTION public.trg_recalc_customer_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id UUID;
  v_is_first_approved BOOLEAN;
BEGIN
  IF NEW.payment_status = 'approved' AND (OLD IS NULL OR OLD.payment_status IS DISTINCT FROM 'approved') THEN
    IF NEW.customer_email IS NOT NULL AND TRIM(NEW.customer_email) != '' THEN
      
      -- Check if customer exists
      SELECT id INTO v_customer_id
      FROM public.customers
      WHERE tenant_id = NEW.tenant_id
        AND LOWER(TRIM(email)) = LOWER(TRIM(NEW.customer_email))
        AND deleted_at IS NULL;

      -- Create customer if not exists (new flow: customer only created on payment approval)
      IF v_customer_id IS NULL THEN
        INSERT INTO public.customers (tenant_id, email, full_name, phone, cpf, status)
        VALUES (
          NEW.tenant_id,
          LOWER(TRIM(NEW.customer_email)),
          NEW.customer_name,
          NEW.customer_phone,
          NEW.customer_cpf,
          'active'
        )
        RETURNING id INTO v_customer_id;

        -- Ensure "Cliente" tag
        PERFORM public.ensure_customer_tag(NEW.tenant_id, v_customer_id, 'Cliente');
      END IF;

      -- Link customer_id to order if not set
      IF NEW.customer_id IS NULL AND v_customer_id IS NOT NULL THEN
        NEW.customer_id := v_customer_id;
      END IF;

      -- Check if this is the first approved order for this email
      SELECT NOT EXISTS (
        SELECT 1 FROM public.orders
        WHERE tenant_id = NEW.tenant_id
          AND LOWER(TRIM(customer_email)) = LOWER(TRIM(NEW.customer_email))
          AND payment_status = 'approved'
          AND id != NEW.id
          AND total > 0
      ) INTO v_is_first_approved;

      -- Update is_first_sale flag
      IF v_is_first_approved THEN
        NEW.is_first_sale := true;
      END IF;

      -- Recalculate metrics
      PERFORM public.recalc_customer_metrics(NEW.tenant_id, NEW.customer_email);

      -- Sync subscriber (does NOT create customer — already handled above)
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
    ELSE
      -- Customer without valid email: log auditable skip
      PERFORM public.log_marketing_sync_audit(
        NEW.tenant_id,
        NEW.customer_id,
        'order_approved',
        'skipped',
        'missing_email',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;