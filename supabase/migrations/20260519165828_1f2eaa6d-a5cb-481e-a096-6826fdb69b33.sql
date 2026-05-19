-- Cancelamento manual administrativo do pedido #182 (respeite-o-homem)
-- Motivo: pedido travado com status=paid + payment_status=pending impediu criação do PV.
-- Decisão do lojista: cancelar para resolver pendência.

UPDATE public.orders
SET status = 'cancelled',
    payment_status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = 'Cancelado administrativamente — pedido travado por inconsistência histórica entre status do pedido e status do pagamento.',
    updated_at = NOW()
WHERE id = 'f34ab4db-a963-4503-ac58-b2dbc3869602'
  AND tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';

INSERT INTO public.order_history (order_id, action, description)
VALUES (
  'f34ab4db-a963-4503-ac58-b2dbc3869602',
  'set_order_status_override',
  '[OVERRIDE ADMIN] Pedido cancelado manualmente para resolver pendência histórica (status=paid + payment_status=pending sem PV gerado).'
);