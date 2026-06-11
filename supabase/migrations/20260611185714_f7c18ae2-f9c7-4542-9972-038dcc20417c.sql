
-- RPC para regenerar rascunho logístico após cancelamento de NF
-- Mesma lógica do trigger AFTER INSERT enqueue_shipping_draft_from_pv,
-- mas chamável explicitamente e idempotente (só insere se não houver
-- rascunho aberto para o PV).
CREATE OR REPLACE FUNCTION public.requeue_shipping_draft_for_pv(p_pv_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pv RECORD;
  v_resolved RECORD;
  v_carrier text;
  v_terminal_status text[] := ARRAY[
    'cancelado','cancelled','cancelled_by_user',
    'expirado','expired','payment_expired',
    'estornado','refunded',
    'devolvido','returned','returning',
    'chargeback_em_andamento','chargeback_detected',
    'chargeback_perdido','chargeback_lost'
  ];
BEGIN
  SELECT id, tenant_id, order_id, fiscal_stage, source_order_invoice_id,
         pedido_status, transportadora_nome, cancelled_at
    INTO v_pv
    FROM public.fiscal_invoices
   WHERE id = p_pv_id;

  IF v_pv IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'pv_not_found');
  END IF;
  IF COALESCE(v_pv.fiscal_stage,'') <> 'pedido_venda' OR v_pv.source_order_invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_root_pv');
  END IF;
  IF v_pv.cancelled_at IS NOT NULL OR COALESCE(v_pv.pedido_status,'') = ANY(v_terminal_status) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'pv_terminal');
  END IF;

  -- Roteamento: pular gateway/marketplace
  IF v_pv.order_id IS NOT NULL THEN
    SELECT provider_id, provider_kind, reason
      INTO v_resolved
      FROM public.resolve_order_shipping_provider(v_pv.order_id);
    IF v_resolved.reason = 'marketplace' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'marketplace');
    END IF;
    IF v_resolved.provider_kind = 'gateway' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'gateway');
    END IF;
    SELECT COALESCE(LOWER(TRIM(shipping_carrier)), 'manual')
      INTO v_carrier FROM public.orders WHERE id = v_pv.order_id;
  ELSE
    v_carrier := COALESCE(NULLIF(LOWER(TRIM(v_pv.transportadora_nome)),''), 'correios');
  END IF;

  -- Idempotência: respeita unique parcial (pending/processing)
  IF EXISTS (
    SELECT 1 FROM public.shipping_draft_queue
     WHERE source_pedido_venda_id = v_pv.id
       AND status IN ('pending','processing')
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_queued');
  END IF;

  INSERT INTO public.shipping_draft_queue
    (tenant_id, order_id, source_pedido_venda_id, provider)
  VALUES
    (v_pv.tenant_id, v_pv.order_id, v_pv.id, COALESCE(v_carrier,'correios'));

  RETURN jsonb_build_object('success', true, 'pv_id', v_pv.id, 'carrier', v_carrier);
END;
$function$;

REVOKE ALL ON FUNCTION public.requeue_shipping_draft_for_pv(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requeue_shipping_draft_for_pv(uuid) TO service_role;
