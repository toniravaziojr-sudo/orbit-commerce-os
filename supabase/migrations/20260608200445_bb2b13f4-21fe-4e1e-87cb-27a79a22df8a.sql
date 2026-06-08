
-- =============================================================================
-- Ajuste fluxo Fiscal × Logístico (NF cancelada / PV excluído)
-- Plano aprovado 2026-06-08
-- =============================================================================

-- (1) FK shipments.invoice_id passa a ON DELETE SET NULL
ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_invoice_id_fkey;
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.fiscal_invoices(id)
  ON DELETE SET NULL;

-- (2) Nova cascata de exclusão de PV: respeita agrupamento por remessa.
--     - Shipment sozinho na remessa OU sem remessa: DELETE.
--     - Shipment acompanhado em remessa: marca cancelado dentro da remessa.
CREATE OR REPLACE FUNCTION public.cascade_delete_shipments_on_pv_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_siblings INT;
BEGIN
  IF OLD.fiscal_stage IS DISTINCT FROM 'pedido_venda'
     OR OLD.source_order_invoice_id IS NOT NULL THEN
    RETURN OLD;
  END IF;

  FOR r IN
    SELECT id, remessa_id, delivery_status
      FROM public.shipments
     WHERE source_pedido_venda_id = OLD.id
  LOOP
    IF r.remessa_id IS NULL THEN
      DELETE FROM public.shipments WHERE id = r.id;
    ELSE
      SELECT COUNT(*) INTO v_siblings
        FROM public.shipments
       WHERE remessa_id = r.remessa_id
         AND id <> r.id
         AND delivery_status <> 'cancelled';
      IF v_siblings = 0 THEN
        -- sozinho na remessa: cascata total (remessa cai pelo gatilho AFTER)
        DELETE FROM public.shipments WHERE id = r.id;
      ELSE
        -- acompanhado: marca cancelado dentro da remessa
        UPDATE public.shipments
           SET delivery_status = 'cancelled',
               action_reason   = 'pv_deleted',
               requires_action = false,
               updated_at      = now()
         WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$function$;

-- (3) Reconciliação do caso atual (PV 403 / NF 404 / objeto AP053729025BR)
--     Limpa pendência fantasma "Pedido sem itens" e desvincula a NF cancelada
--     do objeto, liberando exclusão da NF pelo usuário para refazer o teste.
UPDATE public.fiscal_invoices
   SET pendencia_motivos = NULL,
       updated_at = now()
 WHERE id = '9c93d7f6-04a6-4dec-a021-1d75253a4819'
   AND fiscal_stage = 'pedido_venda';

UPDATE public.shipments
   SET invoice_id = NULL,
       updated_at = now()
 WHERE id = 'db64907e-8b51-40f5-b8d1-72a578e46c8d';

-- Recalcula pedido_status do PV
SELECT public.recompute_pv_pedido_status('9c93d7f6-04a6-4dec-a021-1d75253a4819'::uuid);
