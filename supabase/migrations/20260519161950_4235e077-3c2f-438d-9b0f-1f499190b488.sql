
-- Etapa 3: Transições especiais (chargeback recuperado, cancelados ampliados, reabertura)
-- Refina derive_pv_pedido_status para cobrir todos os estados do core de Pedidos.

CREATE OR REPLACE FUNCTION public.derive_pv_pedido_status(
  p_order_status text,
  p_payment_status text,
  p_chargeback_detected_at timestamptz,
  p_cancelled_at timestamptz,
  p_has_authorized_nf boolean
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    -- 1) Chargeback perdido (terminal)
    WHEN p_order_status = 'chargeback_lost' THEN 'chargeback_perdido'

    -- 2) Cancelado (todos os estados terminais regressivos)
    WHEN p_order_status IN (
           'cancelled','cancelled_by_user','payment_expired',
           'returning','returned','invoice_cancelled'
         )
      OR p_payment_status IN ('cancelled','refunded')
      OR p_cancelled_at IS NOT NULL
      THEN 'cancelado'

    -- 3) Chargeback em andamento — apenas se o pedido ainda está em disputa.
    --    Se o status virou 'chargeback_recovered', cai para regras seguintes
    --    e o PV volta para "em aberto" (ou concluido, se tiver NF).
    WHEN p_order_status = 'chargeback_detected'
      OR (p_chargeback_detected_at IS NOT NULL
          AND p_order_status NOT IN ('chargeback_recovered','chargeback_lost'))
      THEN 'chargeback_em_andamento'

    -- 4) Concluído — NF autorizada derivada existe
    WHEN p_has_authorized_nf THEN 'concluido'

    -- 5) Em aberto — qualquer estado pós-pagamento sem NF nem regressão
    WHEN p_order_status IN (
           'paid','ready_to_invoice','processing',
           'invoice_pending_sefaz','invoice_rejected',
           'invoice_authorized','invoice_issued',
           'dispatched','shipped','in_transit',
           'delivered','completed','fulfilled',
           'chargeback_recovered'
         )
      OR p_payment_status IN ('approved','paid')
      THEN 'em_aberto'

    -- 6) Padrão — pendente (pré-pagamento ou dado faltando)
    ELSE 'pendente'
  END;
$$;

-- Backfill: recalcular pedido_status de todos os PVs já materializados
UPDATE public.fiscal_invoices pv
   SET pedido_status = public.derive_pv_pedido_status(
         o.status::text, o.payment_status::text,
         o.chargeback_detected_at, o.cancelled_at,
         EXISTS (SELECT 1 FROM public.fiscal_invoices nf
                  WHERE nf.source_order_invoice_id = pv.id
                    AND nf.status = 'authorized')
       ),
       updated_at = now()
  FROM public.orders o
 WHERE pv.order_id = o.id
   AND pv.source_order_invoice_id IS NULL
   AND pv.pedido_status IS DISTINCT FROM public.derive_pv_pedido_status(
         o.status::text, o.payment_status::text,
         o.chargeback_detected_at, o.cancelled_at,
         EXISTS (SELECT 1 FROM public.fiscal_invoices nf
                  WHERE nf.source_order_invoice_id = pv.id
                    AND nf.status = 'authorized')
       );
