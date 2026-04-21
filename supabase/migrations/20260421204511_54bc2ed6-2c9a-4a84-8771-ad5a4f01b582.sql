-- ============================================
-- WHATSAPP CARTS — vínculo com pedido + handoff
-- ============================================
ALTER TABLE public.whatsapp_carts
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handoff_reason text,
  ADD COLUMN IF NOT EXISTS handoff_ticket_id uuid;

CREATE INDEX IF NOT EXISTS idx_whatsapp_carts_order_id ON public.whatsapp_carts(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_carts_status ON public.whatsapp_carts(tenant_id, status);

-- ============================================
-- CHECKOUT LINKS — origem da conversa
-- ============================================
ALTER TABLE public.checkout_links
  ADD COLUMN IF NOT EXISTS source_conversation_id uuid;

CREATE INDEX IF NOT EXISTS idx_checkout_links_source_conv ON public.checkout_links(source_conversation_id) WHERE source_conversation_id IS NOT NULL;

-- ============================================
-- ORDERS — referência ao checkout_link de origem
-- ============================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_link_id uuid REFERENCES public.checkout_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_checkout_link_id ON public.orders(checkout_link_id) WHERE checkout_link_id IS NOT NULL;

-- ============================================
-- SUPPORT TICKETS — metadata + conversation source
-- ============================================
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_conversation_id uuid;

CREATE INDEX IF NOT EXISTS idx_support_tickets_source_conv ON public.support_tickets(source_conversation_id) WHERE source_conversation_id IS NOT NULL;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='tenant_members_select_tickets') THEN
    CREATE POLICY tenant_members_select_tickets ON public.support_tickets
      FOR SELECT TO authenticated
      USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='tenant_members_insert_tickets') THEN
    CREATE POLICY tenant_members_insert_tickets ON public.support_tickets
      FOR INSERT TO authenticated
      WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='tenant_members_update_tickets') THEN
    CREATE POLICY tenant_members_update_tickets ON public.support_tickets
      FOR UPDATE TO authenticated
      USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='service_role_full_tickets') THEN
    CREATE POLICY service_role_full_tickets ON public.support_tickets
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- TRIGGER — back-fill cart↔order quando pedido criado via checkout_link do WhatsApp
-- ============================================
CREATE OR REPLACE FUNCTION public.link_whatsapp_cart_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_conv uuid;
BEGIN
  -- Só age quando o pedido vem de um checkout_link
  IF NEW.checkout_link_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar conversa de origem do link
  SELECT source_conversation_id
  INTO v_source_conv
  FROM public.checkout_links
  WHERE id = NEW.checkout_link_id
  LIMIT 1;

  -- Incrementar conversão do link
  UPDATE public.checkout_links
  SET conversion_count = COALESCE(conversion_count, 0) + 1,
      updated_at = now()
  WHERE id = NEW.checkout_link_id;

  -- Vincular o carrinho do WhatsApp ao pedido
  IF v_source_conv IS NOT NULL THEN
    UPDATE public.whatsapp_carts
    SET order_id = NEW.id,
        status = 'converted',
        updated_at = now()
    WHERE conversation_id = v_source_conv
      AND tenant_id = NEW.tenant_id
      AND order_id IS NULL
      AND status IN ('active','converted');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_whatsapp_cart_to_order ON public.orders;
CREATE TRIGGER trg_link_whatsapp_cart_to_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.link_whatsapp_cart_to_order();

-- ============================================
-- VIEW — funil de vendas WhatsApp
-- ============================================
CREATE OR REPLACE VIEW public.whatsapp_sales_funnel_view
WITH (security_invoker = true) AS
SELECT
  wc.tenant_id,
  date_trunc('day', wc.created_at) AS day,
  count(DISTINCT wc.conversation_id) FILTER (WHERE jsonb_array_length(wc.items) > 0) AS carts_with_items,
  count(DISTINCT wc.id) AS total_carts,
  count(DISTINCT wc.id) FILTER (WHERE wc.status = 'converted') AS carts_converted,
  count(DISTINCT wc.id) FILTER (WHERE wc.status = 'handoff') AS carts_handoff,
  count(DISTINCT wc.order_id) FILTER (WHERE wc.order_id IS NOT NULL) AS orders_generated,
  COALESCE(sum(o.total) FILTER (WHERE wc.order_id IS NOT NULL), 0) AS revenue
FROM public.whatsapp_carts wc
LEFT JOIN public.orders o ON o.id = wc.order_id
GROUP BY wc.tenant_id, date_trunc('day', wc.created_at);

COMMENT ON VIEW public.whatsapp_sales_funnel_view IS 'Funil consolidado de vendas WhatsApp por dia/tenant: carrinhos -> conversoes -> pedidos -> receita.';