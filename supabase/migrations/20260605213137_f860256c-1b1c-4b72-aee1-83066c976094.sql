
-- ============================================================
-- Fix A: Auto-recuperação do agrupador de remessa (self-heal)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_shipment_has_remessa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remessa_id uuid;
  v_numero int;
  v_carrier text;
BEGIN
  -- Só age em objetos com código de rastreio. Rascunhos não precisam de agrupador.
  IF NEW.tracking_code IS NULL OR NEW.tracking_code = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.remessa_id IS NOT NULL THEN
    -- Garante que o agrupador referenciado realmente existe; se foi apagado, re-cria.
    PERFORM 1 FROM public.shipping_remessas WHERE id = NEW.remessa_id;
    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  v_carrier := COALESCE(NULLIF(LOWER(NEW.carrier), ''), 'correios');

  -- Próximo número sequencial por tenant
  SELECT COALESCE(MAX(numero), 0) + 1
    INTO v_numero
    FROM public.shipping_remessas
   WHERE tenant_id = NEW.tenant_id;

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
$$;

DROP TRIGGER IF EXISTS trg_ensure_shipment_has_remessa ON public.shipments;
CREATE TRIGGER trg_ensure_shipment_has_remessa
BEFORE INSERT OR UPDATE OF tracking_code, remessa_id
ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.ensure_shipment_has_remessa();

-- ============================================================
-- Fix B: Proteção contra exclusão de agrupador com etiquetas ativas
-- ============================================================
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
     AND COALESCE(delivery_status, '') NOT IN ('cancelled', 'cancelado');

  IF v_active_count > 0 THEN
    RAISE EXCEPTION
      'Não é possível excluir esta remessa: existem % objeto(s) de postagem ativo(s) vinculado(s). Cancele ou desvincule os objetos antes.', v_active_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_remessa_deletion ON public.shipping_remessas;
CREATE TRIGGER trg_guard_remessa_deletion
BEFORE DELETE ON public.shipping_remessas
FOR EACH ROW
EXECUTE FUNCTION public.guard_remessa_deletion();
