INSERT INTO public.service_pricing (
  service_key, category, display_name, provider, model, unit, cost_usd, markup_pct, min_credits_charge,
  metadata, effective_from, is_active
)
SELECT
  'command-insights-generate',
  'ai_text',
  'Central de Comando — Insights semanais (custo plataforma)',
  'gemini',
  'gemini-2.5-flash',
  'aggregated_call',
  0,
  0,
  0,
  jsonb_build_object(
    'usage_owner', 'platform',
    'cost_owner', 'platform',
    'pricing_type', 'aggregated_runtime_calc',
    'cost_source', 'computed_from_token_pricings',
    'cost_components', jsonb_build_array(
      'gemini.gemini-2.5-flash.per_1m_tokens_in',
      'gemini.gemini-2.5-flash.per_1m_tokens_in_cached',
      'gemini.gemini-2.5-flash.per_1m_tokens_out'
    ),
    'placeholder', false,
    'approved_for_live', true,
    'created_by_phase', 'F2.6',
    'note', 'cost_usd=0 é marcador. Custo real vem do parâmetro p_cost_usd na chamada de record_platform_cost, calculado em runtime via tokens reais do retorno do LLM.'
  ),
  now(),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_pricing
  WHERE service_key = 'command-insights-generate' AND is_active = true
);