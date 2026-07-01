-- 1. Adiciona 'awaiting_label' ao enum shipping_status (usado por orders + marketplace_shipments espelhado).
ALTER TYPE public.shipping_status ADD VALUE IF NOT EXISTS 'awaiting_label';

-- 2. Remove o CHECK antigo do marketplace_shipments ANTES do backfill.
ALTER TABLE public.marketplace_shipments
  DROP CONSTRAINT IF EXISTS marketplace_shipments_status_check;

-- 3. Backfill dos valores legados → canônico.
UPDATE public.marketplace_shipments
SET status = CASE status
  WHEN 'awaiting_invoice' THEN 'awaiting_shipment'
  WHEN 'ready_to_ship'    THEN CASE WHEN COALESCE(tracking_number,'') <> '' THEN 'label_generated' ELSE 'awaiting_label' END
  WHEN 'label_issued'     THEN 'label_generated'
  WHEN 'in_transit'       THEN 'shipped'
  ELSE status
END;

-- 4. Novo CHECK constraint canônico.
ALTER TABLE public.marketplace_shipments
  ADD CONSTRAINT marketplace_shipments_status_check CHECK (status = ANY (ARRAY[
    'awaiting_shipment'::text,
    'awaiting_label'::text,
    'label_generated'::text,
    'shipped'::text,
    'delivered'::text,
    'problem'::text,
    'returned'::text,
    'cancelled'::text
  ]));