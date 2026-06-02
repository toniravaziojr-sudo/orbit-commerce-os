-- 1) FK shipments.order_id: CASCADE -> SET NULL
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_order_id_fkey;
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- 2) FK shipping_draft_queue.order_id: CASCADE -> SET NULL
ALTER TABLE public.shipping_draft_queue DROP CONSTRAINT IF EXISTS shipping_draft_queue_order_id_fkey;
ALTER TABLE public.shipping_draft_queue
  ADD CONSTRAINT shipping_draft_queue_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- 3) Unicidade por PV (substitui a antiga "por pedido real")
DROP INDEX IF EXISTS public.idx_shipments_order_tracking;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_pv_tracking
  ON public.shipments (source_pedido_venda_id, tracking_code)
  WHERE source_pedido_venda_id IS NOT NULL
    AND tracking_code IS NOT NULL
    AND tracking_code <> '';

-- Mantém proteção para registros legados (sem PV) que ainda usam order_id como chave histórica
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_order_tracking_legacy
  ON public.shipments (order_id, tracking_code)
  WHERE source_pedido_venda_id IS NULL
    AND order_id IS NOT NULL
    AND tracking_code IS NOT NULL
    AND tracking_code <> '';