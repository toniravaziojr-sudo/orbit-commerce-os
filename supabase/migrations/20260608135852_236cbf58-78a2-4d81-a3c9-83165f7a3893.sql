
ALTER TABLE public.shipping_draft_queue
  DROP CONSTRAINT IF EXISTS shipping_draft_queue_order_unique;

DROP INDEX IF EXISTS public.shipping_draft_queue_pv_unique;
DROP INDEX IF EXISTS public.shipping_draft_queue_order_unique;

CREATE UNIQUE INDEX IF NOT EXISTS shipping_draft_queue_pv_open_unique
  ON public.shipping_draft_queue (source_pedido_venda_id)
  WHERE source_pedido_venda_id IS NOT NULL
    AND status IN ('pending','processing');

CREATE UNIQUE INDEX IF NOT EXISTS shipping_draft_queue_order_open_unique
  ON public.shipping_draft_queue (order_id)
  WHERE order_id IS NOT NULL
    AND status IN ('pending','processing');
