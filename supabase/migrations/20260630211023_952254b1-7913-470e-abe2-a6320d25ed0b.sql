
-- ============================================================
-- Onda 1: Blindar gatilho contra marketplace
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
  v_is_marketplace boolean := false;
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
      -- Detectar marketplace e roteamento de transporte
      SELECT
        o.resolved_shipping_provider_kind,
        COALESCE(NULLIF(LOWER(o.shipping_carrier),''), 'correios'),
        NULLIF(o.shipping_service_name,''),
        NULLIF(o.shipping_service_code,''),
        (o.marketplace_source IS NOT NULL)
      INTO v_provider_kind, v_carrier, v_service_name, v_service_code, v_is_marketplace
      FROM orders o WHERE o.id = NEW.order_id LIMIT 1;

      -- Pular gateway (Frenet etc.)
      IF v_provider_kind = 'gateway' THEN RETURN NEW; END IF;

      -- Pular marketplace (etiqueta é externa, Logística Externa cuida)
      IF v_is_marketplace THEN RETURN NEW; END IF;

      -- Cinto-suspensório: consultar resolver caso marketplace_source venha NULL mas roteamento sinalize
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM public.resolve_order_shipping_provider(NEW.order_id) r
          WHERE r.reason::text = 'marketplace'
        ) THEN
          RETURN NEW;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
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

    -- Já existe objeto vinculado? Apenas costura PV se faltar.
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
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- Onda 3: Trava física — 1 objeto ativo por PV
-- delivery_status enum: draft,label_created,posted,in_transit,
--   out_for_delivery,delivered,failed,returned,canceled,unknown
-- Excluímos os terminais 'canceled', 'returned' e 'failed' para
-- permitir nova tentativa após falha, mas garantir 1 ativo por PV.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipments_active_per_pv
  ON public.shipments (source_pedido_venda_id)
  WHERE source_pedido_venda_id IS NOT NULL
    AND delivery_status NOT IN ('canceled', 'returned', 'failed');

COMMENT ON INDEX public.uq_shipments_active_per_pv IS
  'Anti-regressão (Bug #658, 2026-06-30): garante no máximo 1 objeto ativo por Pedido de Venda. Múltiplos PVs do mesmo pedido continuam permitidos (saída manual para reenvio). Histórico cancelado/devolvido/falho não conta.';
