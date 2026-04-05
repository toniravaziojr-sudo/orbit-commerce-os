
-- =====================================================
-- FIX 1: Rewrite BEFORE trigger to ONLY handle customer creation + linking
-- FIX 2: New AFTER trigger for metrics, tags, marketing, and corrected is_first_sale
-- =====================================================

-- 1) Rewrite the BEFORE trigger: only create/link customer and set is_first_sale
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
      
      -- Check if customer already exists in the base
      SELECT id INTO v_customer_id
      FROM public.customers
      WHERE tenant_id = NEW.tenant_id
        AND LOWER(TRIM(email)) = LOWER(TRIM(NEW.customer_email))
        AND deleted_at IS NULL;

      IF v_customer_id IS NOT NULL THEN
        v_customer_existed := true;
      ELSE
        -- Create customer (first approved order for unknown contact)
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

      -- Link customer_id to order if not set
      IF NEW.customer_id IS NULL AND v_customer_id IS NOT NULL THEN
        NEW.customer_id := v_customer_id;
      END IF;

      -- is_first_sale: true ONLY if customer did NOT exist before AND this is first approved order
      IF NOT v_customer_existed THEN
        -- Double-check: no other approved order exists for this email
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
        -- Customer already existed in the base → NOT a first sale
        NEW.is_first_sale := false;
      END IF;

    ELSE
      -- No valid email
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

-- 2) Create AFTER trigger function for metrics, tags, and marketing sync
CREATE OR REPLACE FUNCTION public.after_order_approved_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only fire when payment just became approved
  IF NEW.payment_status = 'approved' AND (OLD IS NULL OR OLD.payment_status IS DISTINCT FROM 'approved') THEN
    IF NEW.customer_email IS NOT NULL AND TRIM(NEW.customer_email) != '' AND NEW.customer_id IS NOT NULL THEN
      
      -- Ensure "Cliente" tag
      PERFORM public.ensure_customer_tag(NEW.tenant_id, NEW.customer_id, 'Cliente');

      -- Recalculate metrics (now the order IS committed with approved status)
      PERFORM public.recalc_customer_metrics(NEW.tenant_id, NEW.customer_email);

      -- Sync to email marketing
      PERFORM public.upsert_subscriber_only(
        NEW.tenant_id,
        NEW.customer_email,
        NEW.customer_name,
        NEW.customer_phone,
        NULL,
        'order',
        (SELECT l.id FROM public.email_marketing_lists l
         JOIN public.customer_tags ct ON l.tag_id = ct.id
         WHERE l.tenant_id = NEW.tenant_id AND ct.name = 'Cliente'
         LIMIT 1)
      );
    END IF;
  END IF;

  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$function$;

-- 3) Create the AFTER trigger (drop if exists to avoid duplicate)
DROP TRIGGER IF EXISTS trg_after_order_approved_sync ON public.orders;
CREATE TRIGGER trg_after_order_approved_sync
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'approved' AND OLD.payment_status IS DISTINCT FROM 'approved')
  EXECUTE FUNCTION public.after_order_approved_sync();

-- 4) Remove duplicate logic from auto_tag trigger (now handled by after_order_approved_sync)
DROP TRIGGER IF EXISTS trg_auto_tag_cliente_on_payment ON public.orders;
