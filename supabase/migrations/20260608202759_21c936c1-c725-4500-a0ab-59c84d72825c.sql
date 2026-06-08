CREATE OR REPLACE FUNCTION public.guard_remessa_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count int;
BEGIN
  SELECT COUNT(*) INTO v_active_count
    FROM public.shipments
   WHERE remessa_id = OLD.id
     AND tracking_code IS NOT NULL
     AND tracking_code <> ''
     AND delivery_status::text <> 'canceled';

  IF v_active_count > 0 THEN
    RAISE EXCEPTION
      'Nao e possivel excluir esta remessa: existem % objeto(s) de postagem ativo(s) vinculado(s). Cancele ou desvincule os objetos antes.', v_active_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;
