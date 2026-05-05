CREATE OR REPLACE FUNCTION public.trg_recalc_customer_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id UUID;
  v_customer_existed BOOLEAN := false;
BEGIN
  IF NEW.payment_status = 'approved' AND (OLD IS NULL OR OLD.payment_status IS DISTINCT FROM 'approved') THEN
    IF NEW.customer_email IS NOT NULL AND TRIM(NEW.customer_email) != '' THEN

      SELECT id INTO v_customer_id
      FROM public.customers
      WHERE tenant_id = NEW.tenant_id
        AND LOWER(TRIM(email)) = LOWER(TRIM(NEW.customer_email))
        AND deleted_at IS NULL;

      IF v_customer_id IS NOT NULL THEN
        v_customer_existed := true;
        -- Enriquecimento de campos pessoais é feito por enrich_customer_from_order
        -- (chamado por after_order_approved_sync). Não duplicar aqui.
      ELSE
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
        v_customer_existed := false;
      END IF;

      IF NEW.customer_id IS NULL AND v_customer_id IS NOT NULL THEN
        NEW.customer_id := v_customer_id;
      END IF;

      IF NOT v_customer_existed THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.orders
          WHERE tenant_id = NEW.tenant_id
            AND LOWER(TRIM(customer_email)) = LOWER(TRIM(NEW.customer_email))
            AND payment_status = 'approved'
            AND id != NEW.id
            AND total > 0
        ) THEN
          NEW.is_first_sale := true;
        ELSE
          NEW.is_first_sale := false;
        END IF;
      ELSE
        NEW.is_first_sale := false;
      END IF;

    ELSE
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