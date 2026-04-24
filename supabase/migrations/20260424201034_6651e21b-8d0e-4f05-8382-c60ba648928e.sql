-- ============================================================
-- F2 Sub-fase 1.5 — VIEW: sales_pipeline_funnel_metrics
-- Funil agregado por dia/tenant, lendo apenas ai_support_turn_log.
-- security_invoker=true → respeita RLS da tabela base.
-- ============================================================

CREATE OR REPLACE VIEW public.sales_pipeline_funnel_metrics
WITH (security_invoker = true) AS
WITH per_turn AS (
  SELECT
    t.tenant_id,
    date_trunc('day', t.created_at) AS day,
    t.conversation_id,
    t.sales_state_after,
    t.duration_ms,
    COALESCE(t.metadata->>'pipeline_state_after', t.sales_state_after) AS pipeline_state,
    COALESCE(t.metadata->>'state_transition_reason', '') AS transition_reason,
    COALESCE(t.metadata->'pipeline_blocked_tools', '[]'::jsonb) AS blocked_tools,
    COALESCE(t.tools_called, '[]'::jsonb) AS tools_called,
    COALESCE((t.metadata->>'handoff')::boolean, false) AS handoff,
    t.metadata->'variant_gate' AS variant_gate
  FROM public.ai_support_turn_log t
),
state_counts AS (
  SELECT
    tenant_id,
    day,
    COUNT(DISTINCT conversation_id) FILTER (WHERE pipeline_state = 'greeting') AS conv_greeting,
    COUNT(DISTINCT conversation_id) FILTER (WHERE pipeline_state = 'discovery') AS conv_discovery,
    COUNT(DISTINCT conversation_id) FILTER (WHERE pipeline_state = 'proposal') AS conv_proposal,
    COUNT(DISTINCT conversation_id) FILTER (WHERE pipeline_state = 'cart') AS conv_cart,
    COUNT(DISTINCT conversation_id) FILTER (WHERE pipeline_state = 'checkout') AS conv_checkout,
    COUNT(DISTINCT conversation_id) FILTER (WHERE pipeline_state = 'closed') AS conv_closed,
    COUNT(DISTINCT conversation_id) FILTER (WHERE handoff IS TRUE) AS conv_handoff,
    COUNT(*) AS total_turns,
    AVG(duration_ms) FILTER (WHERE pipeline_state = 'greeting')::int AS avg_ms_greeting,
    AVG(duration_ms) FILTER (WHERE pipeline_state = 'discovery')::int AS avg_ms_discovery,
    AVG(duration_ms) FILTER (WHERE pipeline_state = 'proposal')::int AS avg_ms_proposal,
    AVG(duration_ms) FILTER (WHERE pipeline_state = 'cart')::int AS avg_ms_cart,
    AVG(duration_ms) FILTER (WHERE pipeline_state = 'checkout')::int AS avg_ms_checkout
  FROM per_turn
  GROUP BY tenant_id, day
),
gate_counts AS (
  SELECT
    tenant_id,
    day,
    COUNT(*) FILTER (WHERE variant_gate->>'status' = 'ask_variant') AS variant_gate_asked,
    COUNT(*) FILTER (WHERE variant_gate->>'status' = 'ok_already_resolved') AS variant_gate_resolved,
    COUNT(*) FILTER (WHERE variant_gate->>'status' = 'ok_single_variant') AS variant_gate_single,
    COUNT(*) FILTER (WHERE variant_gate->>'status' = 'ok_no_variant_needed') AS variant_gate_not_needed
  FROM per_turn
  WHERE variant_gate IS NOT NULL
  GROUP BY tenant_id, day
),
tool_counts AS (
  SELECT
    tenant_id,
    day,
    COUNT(*) FILTER (WHERE jsonb_array_length(tools_called) > 0) AS turns_with_tool_calls,
    COUNT(*) FILTER (WHERE jsonb_array_length(blocked_tools) > 0) AS turns_with_blocked_tools
  FROM per_turn
  GROUP BY tenant_id, day
)
SELECT
  s.tenant_id,
  s.day,
  s.total_turns,
  s.conv_greeting,
  s.conv_discovery,
  s.conv_proposal,
  s.conv_cart,
  s.conv_checkout,
  s.conv_closed,
  s.conv_handoff,
  s.avg_ms_greeting,
  s.avg_ms_discovery,
  s.avg_ms_proposal,
  s.avg_ms_cart,
  s.avg_ms_checkout,
  COALESCE(g.variant_gate_asked, 0) AS variant_gate_asked,
  COALESCE(g.variant_gate_resolved, 0) AS variant_gate_resolved,
  COALESCE(g.variant_gate_single, 0) AS variant_gate_single,
  COALESCE(g.variant_gate_not_needed, 0) AS variant_gate_not_needed,
  COALESCE(tc.turns_with_tool_calls, 0) AS turns_with_tool_calls,
  COALESCE(tc.turns_with_blocked_tools, 0) AS turns_with_blocked_tools,
  -- Conversões úteis pra UI
  CASE WHEN s.conv_discovery > 0
       THEN ROUND(100.0 * s.conv_cart / s.conv_discovery, 2)
       ELSE 0 END AS conv_rate_discovery_to_cart_pct,
  CASE WHEN s.conv_cart > 0
       THEN ROUND(100.0 * s.conv_checkout / s.conv_cart, 2)
       ELSE 0 END AS conv_rate_cart_to_checkout_pct,
  CASE WHEN s.conv_checkout > 0
       THEN ROUND(100.0 * s.conv_closed / s.conv_checkout, 2)
       ELSE 0 END AS conv_rate_checkout_to_closed_pct
FROM state_counts s
LEFT JOIN gate_counts g USING (tenant_id, day)
LEFT JOIN tool_counts tc USING (tenant_id, day);

COMMENT ON VIEW public.sales_pipeline_funnel_metrics IS
'F2 1.5 — Funil agregado do pipeline de vendas IA por tenant/dia. security_invoker respeita RLS de ai_support_turn_log.';