
CREATE OR REPLACE FUNCTION public.recalc_remessa_counters(p_remessa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_total int; v_emit int; v_fail int;
BEGIN
  IF p_remessa_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE delivery_status NOT IN ('draft','label_created')),
    COUNT(*) FILTER (WHERE requires_action = true)
  INTO v_total, v_emit, v_fail
  FROM public.shipments
  WHERE remessa_id = p_remessa_id;

  UPDATE public.shipping_remessas
    SET total_objetos = COALESCE(v_total,0),
        total_emitidos = COALESCE(v_emit,0),
        total_falhas = COALESCE(v_fail,0),
        updated_at = now()
  WHERE id = p_remessa_id;
END;
$function$;
