
DROP FUNCTION IF EXISTS public.reconcile_missing_fiscal_drafts(uuid, int);

CREATE OR REPLACE FUNCTION public.reconcile_missing_fiscal_drafts(
  p_tenant_id uuid DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS TABLE(reconciled_order_id uuid, reconciled_order_number text, reconciled_action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT o.id, o.tenant_id, o.order_number, o.shipping_carrier
      FROM public.orders o
     WHERE (p_tenant_id IS NULL OR o.tenant_id = p_tenant_id)
       AND (
         public.is_payment_approved(o.payment_status::text)
         OR public.order_status_implies_paid(o.status::text)
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.fiscal_invoices fi
          WHERE fi.order_id = o.id
            AND COALESCE(fi.fiscal_stage, '') = 'pedido_venda'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.fiscal_draft_queue q
          WHERE q.order_id = o.id
            AND q.status IN ('pending','processing')
       )
       AND NOT public.order_has_unlinked_items(o.id)
     ORDER BY o.created_at DESC
     LIMIT p_limit
  LOOP
    INSERT INTO public.fiscal_draft_queue (tenant_id, order_id)
    VALUES (v_order.tenant_id, v_order.id)
    ON CONFLICT (order_id) DO NOTHING;

    reconciled_order_id := v_order.id;
    reconciled_order_number := v_order.order_number;
    reconciled_action := 'enqueued';
    RETURN NEXT;
  END LOOP;
END;
$function$;
