-- Atualiza a view do funil de vendas WhatsApp para também contabilizar
-- handoffs comerciais sem carrinho ativo (tickets de categoria 'sales' vindos do WhatsApp).
CREATE OR REPLACE VIEW public.whatsapp_sales_funnel_view
WITH (security_invoker = true) AS
WITH carts AS (
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
  GROUP BY wc.tenant_id, date_trunc('day', wc.created_at)
),
ticket_handoffs AS (
  SELECT
    st.tenant_id,
    date_trunc('day', st.created_at) AS day,
    count(DISTINCT st.id) AS extra_handoffs
  FROM public.support_tickets st
  WHERE st.category = 'sales'
    AND st.metadata ->> 'source' = 'whatsapp_sales'
    AND NOT EXISTS (
      -- evita dupla contagem com handoffs já refletidos em whatsapp_carts
      SELECT 1
      FROM public.whatsapp_carts wc2
      WHERE wc2.handoff_ticket_id = st.id
    )
  GROUP BY st.tenant_id, date_trunc('day', st.created_at)
)
SELECT
  COALESCE(c.tenant_id, t.tenant_id) AS tenant_id,
  COALESCE(c.day, t.day) AS day,
  COALESCE(c.carts_with_items, 0) AS carts_with_items,
  COALESCE(c.total_carts, 0) AS total_carts,
  COALESCE(c.carts_converted, 0) AS carts_converted,
  COALESCE(c.carts_handoff, 0) + COALESCE(t.extra_handoffs, 0) AS carts_handoff,
  COALESCE(c.orders_generated, 0) AS orders_generated,
  COALESCE(c.revenue, 0) AS revenue
FROM carts c
FULL OUTER JOIN ticket_handoffs t
  ON t.tenant_id = c.tenant_id AND t.day = c.day;

COMMENT ON VIEW public.whatsapp_sales_funnel_view IS 'Funil consolidado de vendas WhatsApp por dia/tenant: inclui handoffs comerciais mesmo sem carrinho ativo.';