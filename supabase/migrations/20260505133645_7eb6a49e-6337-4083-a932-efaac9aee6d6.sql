-- 1) Novas colunas de endereço principal em customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT;

-- 2) Função de enriquecimento
CREATE OR REPLACE FUNCTION public.enrich_customer_from_order(
  p_tenant_id   UUID,
  p_customer_id UUID,
  p_order_id    UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o RECORD;
BEGIN
  IF p_customer_id IS NULL OR p_order_id IS NULL OR p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    customer_name, customer_phone, customer_cpf, customer_birth_date,
    shipping_postal_code, shipping_street, shipping_number, shipping_complement,
    shipping_neighborhood, shipping_city, shipping_state
  INTO o
  FROM public.orders
  WHERE id = p_order_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.customers c
  SET
    -- Campos pessoais: sobrescreve com valor do pedido se não-vazio, senão preserva
    full_name  = COALESCE(NULLIF(TRIM(o.customer_name),  ''), c.full_name),
    phone      = COALESCE(NULLIF(TRIM(o.customer_phone), ''), c.phone),
    cpf        = COALESCE(NULLIF(TRIM(o.customer_cpf),   ''), c.cpf),
    birth_date = COALESCE(o.customer_birth_date,             c.birth_date),
    -- Endereço como bloco atômico: só toca se o pedido tem CEP
    address_postal_code  = CASE WHEN NULLIF(TRIM(o.shipping_postal_code), '') IS NOT NULL
                                THEN TRIM(o.shipping_postal_code) ELSE c.address_postal_code END,
    address_street       = CASE WHEN NULLIF(TRIM(o.shipping_postal_code), '') IS NOT NULL
                                THEN o.shipping_street       ELSE c.address_street       END,
    address_number       = CASE WHEN NULLIF(TRIM(o.shipping_postal_code), '') IS NOT NULL
                                THEN o.shipping_number       ELSE c.address_number       END,
    address_complement   = CASE WHEN NULLIF(TRIM(o.shipping_postal_code), '') IS NOT NULL
                                THEN o.shipping_complement   ELSE c.address_complement   END,
    address_neighborhood = CASE WHEN NULLIF(TRIM(o.shipping_postal_code), '') IS NOT NULL
                                THEN o.shipping_neighborhood ELSE c.address_neighborhood END,
    address_city         = CASE WHEN NULLIF(TRIM(o.shipping_postal_code), '') IS NOT NULL
                                THEN o.shipping_city         ELSE c.address_city         END,
    address_state        = CASE WHEN NULLIF(TRIM(o.shipping_postal_code), '') IS NOT NULL
                                THEN UPPER(TRIM(o.shipping_state)) ELSE c.address_state  END,
    updated_at = NOW()
  WHERE c.id = p_customer_id
    AND c.tenant_id = p_tenant_id;
END;
$function$;

-- 3) Estende o trigger after_order_approved_sync para chamar a nova função
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

      -- NEW: enriquece cadastro do cliente com dados deste pedido (não-bloqueante)
      BEGIN
        PERFORM public.enrich_customer_from_order(NEW.tenant_id, NEW.customer_id, NEW.id);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[after_order_approved_sync] enrich_customer_from_order falhou para pedido %: %', NEW.id, SQLERRM;
      END;

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

      -- Remove this subscriber from ALL OTHER system lists (not "Clientes")
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