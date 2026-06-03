
-- ============================================================
-- 1. AUDITORIA DE EXCLUSÃO DE PEDIDO DE VENDA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pv_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pv_id uuid NOT NULL,
  pv_numero integer,
  pv_serie integer,
  order_id uuid,
  order_number text,
  customer_name text,
  customer_doc text,
  valor_total numeric,
  items_snapshot jsonb,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

GRANT SELECT, INSERT ON public.pv_deletion_audit TO authenticated;
GRANT ALL ON public.pv_deletion_audit TO service_role;

ALTER TABLE public.pv_deletion_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_members_read_pv_audit" ON public.pv_deletion_audit;
CREATE POLICY "tenant_members_read_pv_audit" ON public.pv_deletion_audit
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "service_role_all_pv_audit" ON public.pv_deletion_audit;
CREATE POLICY "service_role_all_pv_audit" ON public.pv_deletion_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pv_deletion_audit_tenant ON public.pv_deletion_audit(tenant_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pv_deletion_audit_order ON public.pv_deletion_audit(order_id);

-- ============================================================
-- 2. BLOQUEIO: PV de pedido pago não pode ser excluído
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_pv_deletion_from_paid_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_is_pv boolean;
BEGIN
  v_is_pv := COALESCE(OLD.fiscal_stage, '') = 'pedido_venda'
             AND OLD.source_order_invoice_id IS NULL;
  IF NOT v_is_pv THEN RETURN OLD; END IF;
  IF OLD.order_id IS NULL THEN RETURN OLD; END IF;

  SELECT status, payment_status INTO v_order
  FROM public.orders WHERE id = OLD.order_id;
  IF NOT FOUND THEN RETURN OLD; END IF;

  IF public.is_payment_approved(v_order.payment_status::text)
     OR public.order_status_implies_paid(v_order.status::text) THEN
    IF v_order.status::text NOT IN (
      'cancelled', 'cancelled_by_user', 'refunded',
      'expired', 'payment_expired'
    ) THEN
      RAISE EXCEPTION 'PV_FROM_PAID_ORDER_PROTECTED: Este Pedido de Venda pertence a um pedido pago e nao pode ser excluido. Para descartar, cancele o pedido de origem na tela de Pedidos.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_pv_deletion_from_paid_order ON public.fiscal_invoices;
CREATE TRIGGER trg_guard_pv_deletion_from_paid_order
  BEFORE DELETE ON public.fiscal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_pv_deletion_from_paid_order();

-- ============================================================
-- 3. SNAPSHOT DE AUDITORIA NA EXCLUSÃO DO PV
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_pv_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_order_number text;
BEGIN
  IF COALESCE(OLD.fiscal_stage, '') <> 'pedido_venda'
     OR OLD.source_order_invoice_id IS NOT NULL THEN
    RETURN OLD;
  END IF;

  BEGIN
    SELECT jsonb_agg(jsonb_build_object(
      'product_id', product_id,
      'descricao', descricao,
      'quantidade', quantidade,
      'valor_unitario', valor_unitario,
      'valor_total', valor_total
    ))
    INTO v_items
    FROM public.fiscal_invoice_items
    WHERE invoice_id = OLD.id;
  EXCEPTION WHEN OTHERS THEN v_items := NULL;
  END;

  IF OLD.order_id IS NOT NULL THEN
    SELECT order_number::text INTO v_order_number
    FROM public.orders WHERE id = OLD.order_id;
  END IF;

  INSERT INTO public.pv_deletion_audit (
    tenant_id, pv_id, pv_numero, pv_serie, order_id, order_number,
    customer_name, customer_doc, valor_total, items_snapshot, deleted_by
  ) VALUES (
    OLD.tenant_id, OLD.id, OLD.numero, OLD.serie, OLD.order_id, v_order_number,
    OLD.dest_nome, OLD.dest_cpf_cnpj, OLD.valor_total, v_items, auth.uid()
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_pv_deletion ON public.fiscal_invoices;
CREATE TRIGGER trg_audit_pv_deletion
  BEFORE DELETE ON public.fiscal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_pv_deletion();

-- ============================================================
-- 4. CASCATA TOTAL: PV deletado remove TODO objeto vinculado
-- ============================================================
CREATE OR REPLACE FUNCTION public.cascade_delete_shipments_on_pv_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_shipments INT := 0;
BEGIN
  IF OLD.fiscal_stage IS DISTINCT FROM 'pedido_venda'
     OR OLD.source_order_invoice_id IS NOT NULL THEN
    RETURN OLD;
  END IF;

  WITH del AS (
    DELETE FROM public.shipments
    WHERE source_pedido_venda_id = OLD.id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_shipments FROM del;

  IF v_deleted_shipments > 0 THEN
    RAISE NOTICE 'PV % deletado: % objeto(s) removido(s) em cascata total', OLD.id, v_deleted_shipments;
  END IF;

  RETURN OLD;
END;
$$;

-- ============================================================
-- 5. RECONCILIAÇÃO DE PV ÓRFÃO SEM OBJETO LOGÍSTICO
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
BEGIN
  FOR r IN
    SELECT fi.id AS pv_id, fi.tenant_id, fi.order_id,
           COALESCE(LOWER(TRIM(o.shipping_carrier)), 'correios') AS carrier
    FROM public.fiscal_invoices fi
    JOIN public.orders o ON o.id = fi.order_id
    WHERE (p_tenant_id IS NULL OR fi.tenant_id = p_tenant_id)
      AND fi.fiscal_stage = 'pedido_venda'
      AND fi.source_order_invoice_id IS NULL
      AND fi.order_id IS NOT NULL
      AND (public.is_payment_approved(o.payment_status::text)
           OR public.order_status_implies_paid(o.status::text))
      AND o.status::text NOT IN (
        'cancelled', 'cancelled_by_user', 'refunded',
        'expired', 'payment_expired',
        'chargeback_lost', 'chargeback_detected',
        'returning', 'returned'
      )
      AND COALESCE(o.marketplace_source, o.source_platform, '') IN
        ('', 'storefront', 'checkout', 'manual', 'link', 'admin')
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
    SELECT provider_kind, reason INTO v_resolved
      FROM public.resolve_order_shipping_provider(r.order_id);
    IF v_resolved.reason::text = 'marketplace' THEN CONTINUE; END IF;
    IF v_resolved.provider_kind::text = 'gateway' THEN CONTINUE; END IF;

    INSERT INTO public.shipping_draft_queue (
      tenant_id, order_id, source_pedido_venda_id, provider
    ) VALUES (
      r.tenant_id, r.order_id, r.pv_id, r.carrier
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_orphan_pv_shipments(uuid) TO service_role;

-- ============================================================
-- 6. CRON: rede de segurança a cada 15min
-- ============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('reconcile-orphan-pv-shipments-15m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reconcile-orphan-pv-shipments-15m',
  '*/15 * * * *',
  $cron$ SELECT public.reconcile_orphan_pv_shipments(NULL); $cron$
);

-- ============================================================
-- 7. REPARO IMEDIATO: tenant Respeite o Homem
-- ============================================================
SELECT public.reconcile_orphan_pv_shipments('d1a4d0ed-8842-495e-b741-540a9a345b25'::uuid) AS pvs_reparados;
