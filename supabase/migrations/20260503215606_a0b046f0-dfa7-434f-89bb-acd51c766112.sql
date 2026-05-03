-- Onda 1C — ligar Recommendation Context Builder em DRY_RUN apenas no Respeite o Homem.
-- Não altera nenhum comportamento de runtime: dry_run só grava trace em ai_turn_traces.
-- Nenhum outro tenant é afetado.
UPDATE public.ai_support_config
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object(
       'arch1c_recommendation_context_builder_enabled', true,
       'arch1c_recommendation_context_builder_mode', 'dry_run'
     )
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';