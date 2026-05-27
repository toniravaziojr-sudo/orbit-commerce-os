
-- 1. Colunas de vínculo com PV
ALTER TABLE public.shipping_draft_queue
  ADD COLUMN IF NOT EXISTS source_pedido_venda_id uuid REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS source_pedido_venda_id uuid REFERENCES public.fiscal_invoices(id) ON DELETE SET NULL;

-- order_id passa a ser opcional (PV manual/duplicado não tem order_id)
ALTER TABLE public.shipping_draft_queue ALTER COLUMN order_id DROP NOT NULL;

-- Unicidade: 1 rascunho por PV
CREATE UNIQUE INDEX IF NOT EXISTS shipping_draft_queue_pv_unique
  ON public.shipping_draft_queue(source_pedido_venda_id)
  WHERE source_pedido_venda_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS shipments_source_pv_idx
  ON public.shipments(source_pedido_venda_id)
  WHERE source_pedido_venda_id IS NOT NULL;

-- 2. Novo trigger: ao criar PV (fiscal_stage='pedido_venda'), enfileira rascunho de remessa
CREATE OR REPLACE FUNCTION public.enqueue_shipping_draft_from_pv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved RECORD;
  v_carrier text;
BEGIN
  -- Só age em PV raiz recém criado
  IF COALESCE(NEW.fiscal_stage, '') <> 'pedido_venda' THEN
    RETURN NEW;
  END IF;
  IF NEW.source_order_invoice_id IS NOT NULL THEN
    RETURN NEW; -- é NF filha, não PV
  END IF;

  -- Se vem de pedido real, resolve provider (gateway sai da fila local)
  IF NEW.order_id IS NOT NULL THEN
    SELECT provider_id, provider_kind, reason
      INTO v_resolved
      FROM public.resolve_order_shipping_provider(NEW.order_id);

    IF v_resolved.reason = 'marketplace' THEN
      RETURN NEW;
    END IF;
    IF v_resolved.provider_kind = 'gateway' THEN
      RETURN NEW; -- gateway usa gateway_sync_queue, enfileirado em enqueue_fiscal_draft
    END IF;

    SELECT COALESCE(LOWER(TRIM(shipping_carrier)), 'manual')
      INTO v_carrier
      FROM public.orders WHERE id = NEW.order_id;
  ELSE
    v_carrier := 'manual';
  END IF;

  INSERT INTO public.shipping_draft_queue (tenant_id, order_id, source_pedido_venda_id, provider)
  VALUES (NEW.tenant_id, NEW.order_id, NEW.id, COALESCE(v_carrier, 'manual'))
  ON CONFLICT (source_pedido_venda_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_shipping_draft_from_pv ON public.fiscal_invoices;
CREATE TRIGGER trg_enqueue_shipping_draft_from_pv
AFTER INSERT ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_shipping_draft_from_pv();

-- 3. Remove o ramo de shipping_draft do enqueue_fiscal_draft (PV-trigger assume).
--    Gateway continua sendo enfileirado aqui.
CREATE OR REPLACE FUNCTION public.enqueue_fiscal_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved RECORD;
  v_should_fire boolean := false;
  v_was_paid boolean;
  v_is_paid boolean;
  v_status_was_paid boolean;
  v_status_is_paid boolean;
BEGIN
  v_is_paid := public.is_payment_approved(NEW.payment_status::text);
  v_status_is_paid := public.order_status_implies_paid(NEW.status::text);

  IF TG_OP = 'INSERT' THEN
    IF v_is_paid OR v_status_is_paid THEN
      v_should_fire := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_was_paid := public.is_payment_approved(OLD.payment_status::text);
    v_status_was_paid := public.order_status_implies_paid(OLD.status::text);
    IF (v_is_paid AND NOT v_was_paid) OR (v_status_is_paid AND NOT v_status_was_paid) THEN
      v_should_fire := true;
    END IF;
  END IF;

  IF NOT v_should_fire THEN RETURN NEW; END IF;
  IF public.order_has_unlinked_items(NEW.id) THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.fiscal_invoices
     WHERE order_id = NEW.id
       AND COALESCE(fiscal_stage, '') = 'pedido_venda'
  ) THEN
    INSERT INTO public.fiscal_draft_queue (tenant_id, order_id)
    VALUES (NEW.tenant_id, NEW.id)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  SELECT provider_id, provider_kind, reason
    INTO v_resolved
    FROM public.resolve_order_shipping_provider(NEW.id);

  UPDATE public.orders
     SET resolved_shipping_provider_id   = v_resolved.provider_id,
         resolved_shipping_provider_kind = v_resolved.provider_kind,
         resolved_shipping_reason        = v_resolved.reason
   WHERE id = NEW.id;

  IF v_resolved.reason = 'marketplace' THEN RETURN NEW; END IF;

  -- Gateway path permanece aqui (não passa pela fila local)
  IF v_resolved.provider_kind = 'gateway' THEN
    INSERT INTO public.gateway_sync_queue (tenant_id, order_id, provider_id, action, payload)
    VALUES (NEW.tenant_id, NEW.id, v_resolved.provider_id, 'sync_order',
            jsonb_build_object('reason', v_resolved.reason))
    ON CONFLICT (order_id, action) WHERE status IN ('pending','processing') DO NOTHING;
  END IF;
  -- Despacho local (Correios/manual) agora é responsabilidade do trg_enqueue_shipping_draft_from_pv

  RETURN NEW;
END;
$$;
