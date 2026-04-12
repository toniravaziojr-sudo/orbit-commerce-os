
CREATE OR REPLACE FUNCTION public.after_order_approved_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_list_id UUID;
  v_cliente_tag_id UUID;
BEGIN
  -- Only fire when payment just became approved
  IF NEW.payment_status = 'approved' AND (OLD IS NULL OR OLD.payment_status IS DISTINCT FROM 'approved') THEN
    IF NEW.customer_email IS NOT NULL AND TRIM(NEW.customer_email) != '' AND NEW.customer_id IS NOT NULL THEN
      
      -- Ensure "Cliente" tag
      PERFORM public.ensure_customer_tag(NEW.tenant_id, NEW.customer_id, 'Cliente');

      -- Recalculate metrics
      PERFORM public.recalc_customer_metrics(NEW.tenant_id, NEW.customer_email);

      -- Get the "Cliente" list and tag IDs
      SELECT l.id, l.tag_id INTO v_cliente_list_id, v_cliente_tag_id
      FROM public.email_marketing_lists l
      JOIN public.customer_tags ct ON l.tag_id = ct.id
      WHERE l.tenant_id = NEW.tenant_id AND ct.name = 'Cliente'
      LIMIT 1;

      -- Sync to "Clientes" list
      PERFORM public.upsert_subscriber_only(
        NEW.tenant_id,
        NEW.customer_email,
        NEW.customer_name,
        NEW.customer_phone,
        NULL,
        'order',
        v_cliente_list_id
      );

      -- Remove this subscriber from ALL OTHER lists (not "Clientes")
      IF v_cliente_list_id IS NOT NULL THEN
        DELETE FROM public.email_marketing_list_members
        WHERE subscriber_id IN (
          SELECT s.id FROM public.email_marketing_subscribers s
          WHERE s.tenant_id = NEW.tenant_id
            AND LOWER(TRIM(s.email)) = LOWER(TRIM(NEW.customer_email))
        )
        AND list_id != v_cliente_list_id
        AND list_id IN (
          SELECT id FROM public.email_marketing_lists
          WHERE tenant_id = NEW.tenant_id AND is_system = true
        );
      END IF;

      -- Remove non-"Cliente" system tags from this customer
      IF v_cliente_tag_id IS NOT NULL THEN
        DELETE FROM public.customer_tag_assignments
        WHERE customer_id = NEW.customer_id
        AND tag_id IN (
          SELECT ct.id FROM public.customer_tags ct
          JOIN public.email_marketing_lists l ON l.tag_id = ct.id
          WHERE ct.tenant_id = NEW.tenant_id
            AND l.is_system = true
            AND ct.id != v_cliente_tag_id
        );
      END IF;

    END IF;
  END IF;

  RETURN NULL;
END;
$function$;
