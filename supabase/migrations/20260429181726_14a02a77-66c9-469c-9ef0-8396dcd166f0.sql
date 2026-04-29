-- Fase 2: Roteamento nos triggers (separa fila local vs gateway)

CREATE OR REPLACE FUNCTION public.enqueue_fiscal_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resolved RECORD;
BEGIN
  -- Only fire when payment_status changes to 'approved'
  IF NOT (TG_OP = 'UPDATE'
          AND NEW.payment_status = 'approved'
          AND (OLD.payment_status IS DISTINCT FROM 'approved'))
  THEN
    RETURN NEW;
  END IF;

  -- 1) Fiscal draft queue: ALWAYS enqueue (every approved order needs fiscal doc — NF-e or DC-e)
  --    Imported orders are excluded by upstream importer logic (they don't reach this path
  --    in fiscal/logistics modules). Marketplaces still need fiscal doc to release label.
  INSERT INTO public.fiscal_draft_queue (tenant_id, order_id)
  VALUES (NEW.tenant_id, NEW.id)
  ON CONFLICT (order_id) DO NOTHING;

  -- 2) Resolve shipping routing via central engine
  SELECT provider_id, provider_kind, reason
    INTO v_resolved
    FROM public.resolve_order_shipping_provider(NEW.id);

  -- Persist resolution on the order row (best-effort; uses dynamic UPDATE to avoid recursion)
  UPDATE public.orders
     SET resolved_shipping_provider_id   = v_resolved.provider_id,
         resolved_shipping_provider_kind = v_resolved.provider_kind,
         resolved_shipping_reason        = v_resolved.reason
   WHERE id = NEW.id;

  -- 3) Route to the correct downstream queue based on provider_kind / reason
  --    a) Marketplace orders: do NOT enter local logistics nor gateway sync
  --       (marketplace itself releases the label after we attach the fiscal doc back)
  --    b) Manual / third-party: enqueue local shipping draft (manual label flow)
  --    c) Contract (Correios, Loggi, etc.): enqueue local shipping draft (label generation)
  --    d) Gateway (Frenet, Melhor Envio, etc.): enqueue gateway sync (sync_order action)

  IF v_resolved.reason = 'marketplace' THEN
    -- skip both queues; fiscal flow handles marketplace label release
    RETURN NEW;
  END IF;

  IF v_resolved.provider_kind = 'gateway' THEN
    INSERT INTO public.gateway_sync_queue (tenant_id, order_id, provider_id, action, payload)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      v_resolved.provider_id,
      'sync_order',
      jsonb_build_object('reason', v_resolved.reason)
    )
    ON CONFLICT (order_id, action) WHERE status IN ('pending','processing') DO NOTHING;
  ELSE
    -- manual or contract → local shipping draft queue
    INSERT INTO public.shipping_draft_queue (tenant_id, order_id, provider)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      COALESCE(LOWER(TRIM(NEW.shipping_carrier)),
               CASE WHEN v_resolved.provider_kind = 'manual' THEN 'manual' ELSE 'manual' END)
    )
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;