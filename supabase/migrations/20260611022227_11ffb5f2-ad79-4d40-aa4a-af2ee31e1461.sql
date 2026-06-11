CREATE OR REPLACE FUNCTION public.ensure_shipment_has_remessa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_remessa_id uuid;
  v_numero text;
  v_carrier text;
BEGIN
  IF NEW.tracking_code IS NULL OR NEW.tracking_code = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.remessa_id IS NOT NULL THEN
    PERFORM 1 FROM public.shipping_remessas WHERE id = NEW.remessa_id;
    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  v_carrier := COALESCE(NULLIF(LOWER(NEW.carrier), ''), 'correios');

  -- Usa o mesmo alocador canônico do fluxo manual (numero é TEXT no formato Remessa_DDMMYYYY.HHMMSS)
  v_numero := public.allocate_remessa_numero(NEW.tenant_id);

  INSERT INTO public.shipping_remessas (
    tenant_id, numero, carrier, status,
    total_objetos, total_emitidos, total_falhas,
    descricao, emitted_at, dispatched_at,
    metadata
  ) VALUES (
    NEW.tenant_id, v_numero, v_carrier, 'despachada',
    1, 1, 0,
    'Agrupador recuperado automaticamente para objeto ' || NEW.tracking_code,
    COALESCE(NEW.created_at, now()), COALESCE(NEW.created_at, now()),
    jsonb_build_object('auto_recovered', true, 'recovered_at', to_jsonb(now()))
  )
  RETURNING id INTO v_remessa_id;

  NEW.remessa_id := v_remessa_id;
  RETURN NEW;
END;
$function$;