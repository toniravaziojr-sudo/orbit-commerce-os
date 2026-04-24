DROP VIEW IF EXISTS public.ai_brain_active_view;

CREATE VIEW public.ai_brain_active_view
WITH (security_invoker = true) AS
SELECT
  id,
  tenant_id,
  insight_type,
  title,
  summary,
  recommendation,
  variations,
  product_id,
  scope_vendas,
  scope_trafego,
  scope_landing,
  scope_auxiliar,
  approved_at,
  expires_at
FROM public.ai_brain_insights
WHERE status = 'ativo'
  AND (expires_at IS NULL OR expires_at > now());