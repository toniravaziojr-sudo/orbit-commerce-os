-- ============================================================
-- 1. CORRIGE sync_shipment_with_pv_status
--    Remove objeto APENAS em status terminais de cancelamento.
--    NÃO remove quando vai para concluido/nf_criada/pendente.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_shipment_with_pv_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_provider_kind shipping_provider_kind;
  v_carrier text;
  v_service_name text;
  v_service_code text;
  v_weight_grams numeric := 0;
  v_max_h numeric := 0;
  v_max_w numeric := 0;
  v_sum_d numeric := 0;
  v_declared numeric := 0;
  v_items_count integer := 0;
  v_meta jsonb;
  v_cancel_statuses CONSTANT text[] := ARRAY[
    'cancelado','cancelled','cancelled_by_user',
    'expirado','expired','payment_expired',
    'estornado','refunded',
    'devolvido','returned','returning',
    'chargeback_em_andamento','chargeback_detected',
    'chargeback_perdido','chargeback_lost'
  ];
  v_active_statuses CONSTANT text[] := ARRAY[
    'em_aberto','pendente','nf_criada','concluido'
  ];
BEGIN
  IF NEW.fiscal_stage <> 'pedido_venda' OR NEW.source_order_invoice_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.pedido_status,'') = COALESCE(NEW.pedido_status,'') THEN
    RETURN NEW;
  END IF;

  -- ATIVO: garantir que exista objeto rascunho (cria se faltar; costura PV se faltar)
  IF NEW.pedido_status = ANY(v_active_statuses) THEN
    IF NEW.order_id IS NOT NULL THEN
      SELECT o.resolved_shipping_provider_kind,
             COALESCE(NULLIF(LOWER(o.shipping_carrier),''), 'correios'),
             NULLIF(o.shipping_service_name,''),
             NULLIF(o.shipping_service_code,'')
        INTO v_provider_kind, v_carrier, v_service_name, v_service_code
        FROM orders o WHERE o.id = NEW.order_id LIMIT 1;
      IF v_provider_kind = 'gateway' THEN RETURN NEW; END IF;
    ELSE
      v_carrier := COALESCE(NULLIF(LOWER(NEW.transportadora_nome),''), 'correios');
      v_service_name := NULLIF(NEW.transportadora_servico,'');
      v_service_code := NULL;
    END IF;

    IF v_service_code IS NULL AND v_carrier = 'correios' AND v_service_name IS NOT NULL THEN
      v_service_code := CASE UPPER(TRIM(v_service_name))
        WHEN 'PAC' THEN '03298'
        WHEN 'SEDEX' THEN '03220'
        WHEN 'SEDEX 10' THEN '40215'
        WHEN 'SEDEX 12' THEN '40169'
        WHEN 'SEDEX HOJE' THEN '40290'
        WHEN 'MINI ENVIOS' THEN '04227'
        WHEN 'PAC MINI' THEN '04227'
        ELSE NULL
      END;
    END IF;

    -- Já existe objeto (rascunho ou postado) vinculado? Apenas costura PV se faltar.
    IF EXISTS (
      SELECT 1 FROM shipments s
       WHERE (
              (NEW.order_id IS NOT NULL AND s.order_id = NEW.order_id)
              OR s.source_pedido_venda_id = NEW.id
             )
    ) THEN
      UPDATE shipments
         SET source_pedido_venda_id = NEW.id
       WHERE (
              (NEW.order_id IS NOT NULL AND order_id = NEW.order_id)
              OR source_pedido_venda_id = NEW.id
             )
         AND source_pedido_venda_id IS NULL;
      RETURN NEW;
    END IF;

    -- Calcular peso/dimensões a partir do pedido real ou dos itens do PV
    IF NEW.order_id IS NOT NULL THEN
      SELECT
        COALESCE(SUM(COALESCE(p.weight, 300) * oi.quantity), 300),
        COALESCE(MAX(COALESCE(p.height, 10)), 10),
        COALESCE(MAX(COALESCE(p.width, 15)), 15),
        COALESCE(SUM(COALESCE(p.depth, 20)), 20),
        COALESCE(SUM(oi.total_price), 0),
        COALESCE(SUM(oi.quantity), 0)
      INTO v_weight_grams, v_max_h, v_max_w, v_sum_d, v_declared, v_items_count
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.order_id;
    ELSE
      SELECT
        COALESCE(SUM(COALESCE(p.weight, 300) * fii.quantidade), 300),
        COALESCE(MAX(COALESCE(p.height, 10)), 10),
        COALESCE(MAX(COALESCE(p.width, 15)), 15),
        COALESCE(SUM(COALESCE(p.depth, 20)), 20),
        COALESCE(SUM(fii.valor_total), 0),
        COALESCE(SUM(fii.quantidade), 0)
      INTO v_weight_grams, v_max_h, v_max_w, v_sum_d, v_declared, v_items_count
      FROM fiscal_invoice_items fii
      LEFT JOIN products p ON p.id = fii.product_id
                           OR (p.sku IS NOT NULL AND p.sku = fii.codigo_produto AND p.tenant_id = NEW.tenant_id)
      WHERE fii.invoice_id = NEW.id;
    END IF;

    v_meta := jsonb_build_object(
      'weight_grams', GREATEST(ROUND(v_weight_grams)::int, 1),
      'height_cm',    v_max_h,
      'width_cm',     v_max_w,
      'depth_cm',     v_sum_d,
      'declared_value', v_declared,
      'items_count',  v_items_count,
      'computed_by', 'sync_shipment_with_pv_status',
      'computed_at', to_jsonb(now())
    );

    INSERT INTO shipments (
      tenant_id, order_id, source_pedido_venda_id,
      carrier, service_name, service_code,
      source, delivery_status, metadata
    )
    VALUES (
      NEW.tenant_id, NEW.order_id, NEW.id,
      v_carrier, v_service_name, v_service_code,
      'auto_pv_sync', 'draft', v_meta
    );

    RETURN NEW;
  END IF;

  -- CANCELAMENTO/TERMINAL: remover apenas objetos sem rastreio e não ajustados manualmente
  IF TG_OP = 'UPDATE'
     AND NEW.pedido_status = ANY(v_cancel_statuses)
     AND (OLD.pedido_status IS NULL OR NOT (OLD.pedido_status = ANY(v_cancel_statuses))) THEN
    IF NEW.order_id IS NOT NULL THEN
      DELETE FROM shipments
       WHERE order_id = NEW.order_id
         AND (tracking_code IS NULL OR tracking_code = '')
         AND COALESCE(manually_adjusted, false) = false;
    END IF;

    DELETE FROM shipments
     WHERE source_pedido_venda_id = NEW.id
       AND (tracking_code IS NULL OR tracking_code = '')
       AND COALESCE(manually_adjusted, false) = false;

    UPDATE shipping_draft_queue
       SET status = 'cancelled',
           cancelled_at = now(),
           cancel_reason = 'pv_terminal:' || COALESCE(NEW.pedido_status, 'unknown')
     WHERE source_pedido_venda_id = NEW.id
       AND status IN ('pending','processing');
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. EXPANDE reconcile_orphan_pv_shipments
--    Cobre PVs manuais/duplicados (sem order_id) ativos sem objeto.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_orphan_pv_shipments(p_tenant_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  r RECORD;
  v_resolved RECORD;
  v_active_statuses CONSTANT text[] := ARRAY[
    'em_aberto','pendente','nf_criada','concluido'
  ];
  v_carrier text;
  v_service_name text;
  v_weight_grams numeric;
  v_max_h numeric;
  v_max_w numeric;
  v_sum_d numeric;
  v_declared numeric;
  v_items_count integer;
  v_meta jsonb;
  v_skip boolean;
BEGIN
  FOR r IN
    SELECT fi.id AS pv_id, fi.tenant_id, fi.order_id, fi.pedido_status,
           fi.transportadora_nome, fi.transportadora_servico
    FROM public.fiscal_invoices fi
    WHERE (p_tenant_id IS NULL OR fi.tenant_id = p_tenant_id)
      AND fi.fiscal_stage = 'pedido_venda'
      AND fi.source_order_invoice_id IS NULL
      AND COALESCE(fi.pedido_status, 'em_aberto') = ANY(v_active_statuses)
      AND NOT EXISTS (
        SELECT 1 FROM public.shipments s
        WHERE s.source_pedido_venda_id = fi.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.shipping_draft_queue q
        WHERE q.source_pedido_venda_id = fi.id
          AND q.status IN ('pending', 'processing')
      )
  LOOP
    v_skip := false;

    -- Caso A: PV com pedido real → respeita roteamento (não cria para gateway/marketplace)
    IF r.order_id IS NOT NULL THEN
      BEGIN
        SELECT provider_kind, reason INTO v_resolved
          FROM public.resolve_order_shipping_provider(r.order_id);
        IF v_resolved.reason::text = 'marketplace' THEN v_skip := true; END IF;
        IF v_resolved.provider_kind::text = 'gateway' THEN v_skip := true; END IF;
      EXCEPTION WHEN OTHERS THEN
        v_skip := false;
      END;

      IF v_skip THEN CONTINUE; END IF;

      SELECT COALESCE(NULLIF(LOWER(o.shipping_carrier),''), 'correios'),
             NULLIF(o.shipping_service_name,'')
        INTO v_carrier, v_service_name
        FROM public.orders o WHERE o.id = r.order_id LIMIT 1;

      INSERT INTO public.shipping_draft_queue (
        tenant_id, order_id, source_pedido_venda_id, provider
      ) VALUES (
        r.tenant_id, r.order_id, r.pv_id, COALESCE(v_carrier, 'correios')
      );
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    -- Caso B: PV manual/duplicado (sem order_id) → cria objeto rascunho direto
    v_carrier := COALESCE(NULLIF(LOWER(r.transportadora_nome),''), 'correios');
    v_service_name := NULLIF(r.transportadora_servico,'');

    SELECT
      COALESCE(SUM(COALESCE(p.weight, 300) * fii.quantidade), 300),
      COALESCE(MAX(COALESCE(p.height, 10)), 10),
      COALESCE(MAX(COALESCE(p.width, 15)), 15),
      COALESCE(SUM(COALESCE(p.depth, 20)), 20),
      COALESCE(SUM(fii.valor_total), 0),
      COALESCE(SUM(fii.quantidade), 0)
    INTO v_weight_grams, v_max_h, v_max_w, v_sum_d, v_declared, v_items_count
    FROM public.fiscal_invoice_items fii
    LEFT JOIN public.products p ON p.id = fii.product_id
                                OR (p.sku IS NOT NULL AND p.sku = fii.codigo_produto AND p.tenant_id = r.tenant_id)
    WHERE fii.invoice_id = r.pv_id;

    v_meta := jsonb_build_object(
      'weight_grams', GREATEST(ROUND(COALESCE(v_weight_grams, 300))::int, 1),
      'height_cm',    COALESCE(v_max_h, 10),
      'width_cm',     COALESCE(v_max_w, 15),
      'depth_cm',     COALESCE(v_sum_d, 20),
      'declared_value', COALESCE(v_declared, 0),
      'items_count',  COALESCE(v_items_count, 0),
      'computed_by', 'reconcile_orphan_pv_shipments',
      'computed_at', to_jsonb(now())
    );

    INSERT INTO public.shipments (
      tenant_id, order_id, source_pedido_venda_id,
      carrier, service_name,
      source, delivery_status, metadata
    )
    VALUES (
      r.tenant_id, NULL, r.pv_id,
      v_carrier, v_service_name,
      'reconcile_orphan', 'draft', v_meta
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_orphan_pv_shipments(uuid) TO service_role;

-- ============================================================
-- 3. REPARO IMEDIATO: tenant Respeite o Homem
-- ============================================================
SELECT public.reconcile_orphan_pv_shipments('d1a4d0ed-8842-495e-b741-540a9a345b25'::uuid) AS pvs_reparados;