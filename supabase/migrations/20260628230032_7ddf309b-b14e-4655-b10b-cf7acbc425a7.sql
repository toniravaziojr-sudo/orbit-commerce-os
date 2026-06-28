
CREATE TABLE IF NOT EXISTS public.marketplace_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label_origin text NOT NULL CHECK (label_origin IN ('marketplace','gateway')),
  source_key text NOT NULL CHECK (source_key IN (
    'mercadolivre','shopee','tiktok_shop','amazon_seller','frenet','melhor_envio'
  )),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  marketplace_order_id text,
  external_shipment_id text NOT NULL,
  carrier text,
  tracking_number text,
  tracking_url text,
  status text NOT NULL DEFAULT 'awaiting_invoice' CHECK (status IN (
    'awaiting_invoice','ready_to_ship','label_issued','in_transit',
    'delivered','problem','returned','cancelled'
  )),
  label_pdf_url text,
  label_fetched_at timestamptz,
  invoice_id uuid REFERENCES public.fiscal_invoices(id) ON DELETE SET NULL,
  invoice_sent_at timestamptz,
  pratika_sent_at timestamptz,
  last_tracking_event_at timestamptz,
  last_error text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_shipments_uniq UNIQUE (tenant_id, source_key, external_shipment_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_shipments TO authenticated;
GRANT ALL ON public.marketplace_shipments TO service_role;

ALTER TABLE public.marketplace_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ms_tenant_select" ON public.marketplace_shipments
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "ms_tenant_modify" ON public.marketplace_shipments
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "ms_service_role_all" ON public.marketplace_shipments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_ms_tenant_status ON public.marketplace_shipments (tenant_id, status);
CREATE INDEX idx_ms_order ON public.marketplace_shipments (order_id);
CREATE INDEX idx_ms_source ON public.marketplace_shipments (tenant_id, source_key);
CREATE INDEX idx_ms_tracking ON public.marketplace_shipments (tracking_number) WHERE tracking_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_marketplace_shipments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER marketplace_shipments_updated_at
  BEFORE UPDATE ON public.marketplace_shipments
  FOR EACH ROW EXECUTE FUNCTION public.tg_marketplace_shipments_updated_at();

-- Fila NF→ML
CREATE TABLE IF NOT EXISTS public.meli_invoice_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meli_invoice_send_queue_uniq UNIQUE (tenant_id, order_id, invoice_id)
);

GRANT SELECT ON public.meli_invoice_send_queue TO authenticated;
GRANT ALL ON public.meli_invoice_send_queue TO service_role;

ALTER TABLE public.meli_invoice_send_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "misq_tenant_read" ON public.meli_invoice_send_queue
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "misq_service_role_all" ON public.meli_invoice_send_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_misq_pending ON public.meli_invoice_send_queue (status, next_attempt_at) WHERE status IN ('pending','failed');

CREATE TRIGGER meli_invoice_send_queue_updated_at
  BEFORE UPDATE ON public.meli_invoice_send_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_marketplace_shipments_updated_at();

-- Trigger NF autorizada de pedido ML → enfileira
CREATE OR REPLACE FUNCTION public.tg_enqueue_meli_invoice_send()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid;
  v_marketplace_source text;
BEGIN
  IF NEW.status <> 'authorized' OR NEW.chave_acesso IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'authorized' THEN RETURN NEW; END IF;

  -- Resolver pedido: NF direta tem order_id; NF emitida a partir de PV usa source_order_invoice_id → PV.order_id
  v_order_id := NEW.order_id;
  IF v_order_id IS NULL AND NEW.source_order_invoice_id IS NOT NULL THEN
    SELECT order_id INTO v_order_id FROM public.fiscal_invoices WHERE id = NEW.source_order_invoice_id;
  END IF;
  IF v_order_id IS NULL THEN RETURN NEW; END IF;

  SELECT marketplace_source INTO v_marketplace_source
  FROM public.orders WHERE id = v_order_id;

  IF v_marketplace_source IS DISTINCT FROM 'mercadolivre' THEN RETURN NEW; END IF;

  INSERT INTO public.meli_invoice_send_queue (tenant_id, order_id, invoice_id)
  VALUES (NEW.tenant_id, v_order_id, NEW.id)
  ON CONFLICT (tenant_id, order_id, invoice_id) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enqueue_meli_invoice_send ON public.fiscal_invoices;
CREATE TRIGGER enqueue_meli_invoice_send
  AFTER INSERT OR UPDATE OF status ON public.fiscal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_meli_invoice_send();

-- Trigger marketplace_shipments → orders tracking
CREATE OR REPLACE FUNCTION public.tg_propagate_ms_tracking_to_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.tracking_number IS NULL AND NEW.tracking_url IS NULL THEN RETURN NEW; END IF;

  UPDATE public.orders
  SET
    tracking_code = COALESCE(NEW.tracking_number, tracking_code),
    tracking_url = COALESCE(NEW.tracking_url, tracking_url),
    updated_at = now()
  WHERE id = NEW.order_id
    AND (tracking_code IS DISTINCT FROM NEW.tracking_number
         OR tracking_url IS DISTINCT FROM NEW.tracking_url);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS propagate_ms_tracking ON public.marketplace_shipments;
CREATE TRIGGER propagate_ms_tracking
  AFTER INSERT OR UPDATE OF tracking_number, tracking_url ON public.marketplace_shipments
  FOR EACH ROW EXECUTE FUNCTION public.tg_propagate_ms_tracking_to_order();
