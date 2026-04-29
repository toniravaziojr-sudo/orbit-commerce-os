CREATE OR REPLACE FUNCTION public.resolve_order_shipping_provider(p_order_id uuid)
RETURNS TABLE (
  provider_id uuid,
  provider_kind public.shipping_provider_kind,
  reason public.shipping_routing_reason
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_carrier text;
  v_marketplace text;
  v_chosen RECORD;
  v_inherit RECORD;
  v_only RECORD;
  v_active_count int;
BEGIN
  SELECT o.tenant_id,
         lower(coalesce(o.shipping_carrier,'')),
         lower(coalesce(o.marketplace_source, o.source_platform, ''))
    INTO v_tenant_id, v_carrier, v_marketplace
    FROM public.orders o WHERE o.id = p_order_id;

  IF v_tenant_id IS NULL THEN RETURN; END IF;

  IF v_marketplace <> '' AND v_marketplace NOT IN ('storefront','checkout','manual','link','admin') THEN
    RETURN QUERY SELECT NULL::uuid, NULL::public.shipping_provider_kind, 'marketplace'::public.shipping_routing_reason;
    RETURN;
  END IF;

  IF v_carrier IN ('manual','third_party','frete_terceiros','terceiros') THEN
    RETURN QUERY SELECT NULL::uuid, 'manual'::public.shipping_provider_kind, 'manual_third_party'::public.shipping_routing_reason;
    RETURN;
  END IF;

  SELECT sp.id, sp.provider_kind, sp.supports_quote, sp.supports_tracking
    INTO v_chosen
    FROM public.shipping_providers sp
   WHERE sp.tenant_id = v_tenant_id
     AND sp.is_enabled = true
     AND lower(sp.provider) = v_carrier
   ORDER BY sp.supports_tracking DESC, sp.supports_quote DESC
   LIMIT 1;

  IF v_chosen.id IS NOT NULL THEN
    IF v_chosen.supports_tracking THEN
      RETURN QUERY SELECT v_chosen.id, v_chosen.provider_kind, 'customer_choice'::public.shipping_routing_reason;
      RETURN;
    END IF;

    SELECT sp.id, sp.provider_kind
      INTO v_inherit
      FROM public.shipping_providers sp
     WHERE sp.tenant_id = v_tenant_id
       AND sp.is_enabled = true
       AND sp.supports_tracking = true
     ORDER BY (sp.provider_kind = 'contract') DESC
     LIMIT 1;

    IF v_inherit.id IS NOT NULL THEN
      RETURN QUERY SELECT v_inherit.id, v_inherit.provider_kind, 'tracking_inheritance'::public.shipping_routing_reason;
      RETURN;
    END IF;

    RETURN QUERY SELECT v_chosen.id, v_chosen.provider_kind, 'single_active'::public.shipping_routing_reason;
    RETURN;
  END IF;

  SELECT count(*) INTO v_active_count
    FROM public.shipping_providers sp
   WHERE sp.tenant_id = v_tenant_id AND sp.is_enabled = true;

  IF v_active_count = 1 THEN
    SELECT sp.id, sp.provider_kind
      INTO v_only
      FROM public.shipping_providers sp
     WHERE sp.tenant_id = v_tenant_id AND sp.is_enabled = true
     LIMIT 1;
    RETURN QUERY SELECT v_only.id, v_only.provider_kind, 'single_active'::public.shipping_routing_reason;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::uuid, NULL::public.shipping_provider_kind, 'unresolved'::public.shipping_routing_reason;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_order_shipping_provider(uuid) FROM PUBLIC, anon;