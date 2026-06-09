
-- ============================================================
-- 1) BACKFILL: marca alta da SEFAZ no cursor numero_nfe_atual
-- A partir de agora o cursor "numero_nfe_atual" passa a ser a marca alta
-- de números que tocaram a SEFAZ (autorizados, rejeitados ou duplicados).
-- ============================================================
WITH sefaz_max AS (
  SELECT
    fi.tenant_id,
    GREATEST(
      COALESCE(MAX(fi.numero) FILTER (
        WHERE fi.chave_acesso IS NOT NULL
           OR fi.status IN ('authorized','rejected','cancelled')
      ), 0),
      COALESCE((
        SELECT MAX((ev.event_data->>'numero_rejeitado')::int)
        FROM public.fiscal_invoice_events ev
        WHERE ev.tenant_id = fi.tenant_id
          AND ev.event_type = 'numero_duplicado_sefaz'
      ), 0)
    ) AS max_num
  FROM public.fiscal_invoices fi
  WHERE COALESCE(fi.fiscal_stage,'') <> 'pedido_venda'
  GROUP BY fi.tenant_id
)
UPDATE public.fiscal_settings s
SET numero_nfe_atual = GREATEST(COALESCE(s.numero_nfe_atual, 1), sm.max_num + 1)
FROM sefaz_max sm
WHERE s.tenant_id = sm.tenant_id
  AND sm.max_num > 0;

-- ============================================================
-- 2) TRIGGER: bloqueia exclusão de NF que já tocou a SEFAZ
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_nf_deletion_when_submitted_to_sefaz()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_nf boolean;
  v_has_event boolean;
BEGIN
  v_is_nf := COALESCE(OLD.fiscal_stage, '') <> 'pedido_venda';
  IF NOT v_is_nf THEN RETURN OLD; END IF;

  -- Já tem chave de acesso: NF emitida -> nunca apaga, só cancela
  IF OLD.chave_acesso IS NOT NULL AND length(trim(OLD.chave_acesso)) > 0 THEN
    RAISE EXCEPTION 'NF_ALREADY_SUBMITTED_TO_SEFAZ: Esta Nota Fiscal já foi enviada à SEFAZ e nao pode ser excluida. Use o cancelamento ou a inutilizacao.'
      USING ERRCODE = '42501';
  END IF;

  -- Tem evento de envio/autorização/rejeição/duplicidade no histórico: número já foi queimado
  SELECT EXISTS (
    SELECT 1 FROM public.fiscal_invoice_events ev
    WHERE ev.invoice_id = OLD.id
      AND ev.event_type IN ('submitted','authorized','rejected','submission_error','numero_duplicado_sefaz')
  ) INTO v_has_event;

  IF v_has_event THEN
    RAISE EXCEPTION 'NF_ALREADY_SUBMITTED_TO_SEFAZ: Esta Nota Fiscal já foi transmitida à SEFAZ e nao pode ser excluida. Use o cancelamento ou a inutilizacao.'
      USING ERRCODE = '42501';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_nf_deletion_when_submitted_to_sefaz ON public.fiscal_invoices;
CREATE TRIGGER trg_guard_nf_deletion_when_submitted_to_sefaz
  BEFORE DELETE ON public.fiscal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_nf_deletion_when_submitted_to_sefaz();

-- ============================================================
-- 3) TABELA: auditoria de exclusão de NF (espelho de pv_deletion_audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nf_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nf_id uuid NOT NULL,
  nf_numero integer,
  nf_serie integer,
  nf_status text,
  nf_fiscal_stage text,
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

GRANT SELECT, INSERT ON public.nf_deletion_audit TO authenticated;
GRANT ALL ON public.nf_deletion_audit TO service_role;

ALTER TABLE public.nf_deletion_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_members_read_nf_audit" ON public.nf_deletion_audit;
CREATE POLICY "tenant_members_read_nf_audit" ON public.nf_deletion_audit
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "service_role_all_nf_audit" ON public.nf_deletion_audit;
CREATE POLICY "service_role_all_nf_audit" ON public.nf_deletion_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_nf_deletion_audit_tenant ON public.nf_deletion_audit(tenant_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nf_deletion_audit_order ON public.nf_deletion_audit(order_id);

-- ============================================================
-- 4) TRIGGER: snapshot de auditoria na exclusão de NF (rascunho puro)
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_nf_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_order_number text;
BEGIN
  -- Apenas NFs (não PV)
  IF COALESCE(OLD.fiscal_stage, '') = 'pedido_venda' THEN
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

  INSERT INTO public.nf_deletion_audit (
    tenant_id, nf_id, nf_numero, nf_serie, nf_status, nf_fiscal_stage,
    order_id, order_number,
    customer_name, customer_doc, valor_total, items_snapshot, deleted_by
  ) VALUES (
    OLD.tenant_id, OLD.id, OLD.numero, OLD.serie, OLD.status::text, OLD.fiscal_stage::text,
    OLD.order_id, v_order_number,
    OLD.dest_nome, OLD.dest_cpf_cnpj, OLD.valor_total, v_items, auth.uid()
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_nf_deletion ON public.fiscal_invoices;
CREATE TRIGGER trg_audit_nf_deletion
  BEFORE DELETE ON public.fiscal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_nf_deletion();
