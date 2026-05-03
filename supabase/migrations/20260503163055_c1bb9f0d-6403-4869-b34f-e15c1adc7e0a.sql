
-- ============================================
-- ONDA A — AI Context Health (somente leitura)
-- ============================================

-- 1) Tabela global ai_segment_playbooks (sem tenant_id; é referência genérica)
CREATE TABLE IF NOT EXISTS public.ai_segment_playbooks (
  segment_slug text PRIMARY KEY,
  display_name text NOT NULL,
  role_taxonomy jsonb NOT NULL DEFAULT '[]'::jsonb,
  pack_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  complementarity_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  inference_prompt text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_segment_playbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playbooks_read_authenticated" ON public.ai_segment_playbooks;
CREATE POLICY "playbooks_read_authenticated"
  ON public.ai_segment_playbooks FOR SELECT
  TO authenticated
  USING (true);

-- Seed mínimo (4 segmentos)
INSERT INTO public.ai_segment_playbooks (segment_slug, display_name, role_taxonomy, pack_patterns, complementarity_rules, description)
VALUES
  ('cosmeticos', 'Cosméticos / Tratamento',
    '["base","limpeza","tratamento_dia","tratamento_noite","hidratacao","protecao","finalizador","kit"]'::jsonb,
    '[{"regex":"\\b(2|3|6|12)\\s*(x|un|unidades?)\\b","kind":"quantity_pack"},{"regex":"\\b(combo|kit|duo|trio)\\b","kind":"bundle"}]'::jsonb,
    '[{"if_role":"tratamento_dia","suggest_role":"tratamento_noite"},{"if_role":"limpeza","suggest_role":"tratamento_dia"}]'::jsonb,
    'Cosméticos, dermocosméticos, capilares, skincare, barba.'),
  ('eletronicos', 'Eletrônicos',
    '["principal","acessorio","compativel","cabo","fonte","protecao","kit"]'::jsonb,
    '[{"regex":"\\b(combo|kit|bundle)\\b","kind":"bundle"}]'::jsonb,
    '[{"if_role":"principal","suggest_role":"acessorio"}]'::jsonb,
    'Eletroportáteis, gadgets, áudio, vídeo, informática.'),
  ('moda', 'Moda',
    '["peca_principal","look_complementar","acessorio","tamanho_variante","colecao"]'::jsonb,
    '[{"regex":"\\b(combo|kit|look)\\b","kind":"bundle"}]'::jsonb,
    '[{"if_role":"peca_principal","suggest_role":"acessorio"}]'::jsonb,
    'Vestuário, calçados, acessórios.'),
  ('pet', 'Pet',
    '["alimentacao","higiene","saude","brinquedo","acessorio","kit"]'::jsonb,
    '[{"regex":"\\b(2|3|6)\\s*(x|kg|un)\\b","kind":"quantity_pack"},{"regex":"\\b(combo|kit)\\b","kind":"bundle"}]'::jsonb,
    '[{"if_role":"alimentacao","suggest_role":"higiene"}]'::jsonb,
    'Petshop, ração, acessórios pet.')
ON CONFLICT (segment_slug) DO NOTHING;

-- 2) View ai_context_health_view (9 dimensões + overall) — SECURITY INVOKER (default)
CREATE OR REPLACE VIEW public.ai_context_health_view AS
WITH
  cfg AS (
    SELECT
      t.id AS tenant_id,
      asc1.system_prompt,
      asc1.custom_knowledge,
      asc1.personality_name,
      asc1.sales_mode_enabled,
      asc1.is_enabled
    FROM public.tenants t
    LEFT JOIN public.ai_support_config asc1 ON asc1.tenant_id = t.id
  ),
  brand AS (
    SELECT tenant_id,
      (CASE WHEN brand_summary IS NOT NULL AND length(brand_summary) > 20 THEN 25 ELSE 0 END
      + CASE WHEN tone_of_voice IS NOT NULL AND length(tone_of_voice) > 5 THEN 20 ELSE 0 END
      + CASE WHEN coalesce(array_length(banned_claims,1),0) > 0 THEN 20 ELSE 0 END
      + CASE WHEN coalesce(array_length(do_not_do,1),0) > 0 THEN 15 ELSE 0 END
      + CASE WHEN products_focus IS NOT NULL THEN 10 ELSE 0 END
      + CASE WHEN visual_style_guidelines IS NOT NULL THEN 10 ELSE 0 END) AS score
    FROM public.tenant_brand_context
  ),
  lang AS (
    SELECT tenant_id,
      LEAST(100,
        (CASE WHEN tone_style IS NOT NULL THEN 20 ELSE 0 END)
        + (CASE WHEN coalesce(jsonb_array_length(niche_vocabulary), 0) > 0 THEN 30 ELSE 0 END)
        + (CASE WHEN coalesce(jsonb_array_length(product_aliases), 0) > 0 THEN 20 ELSE 0 END)
        + (CASE WHEN coalesce(array_length(forbidden_terms,1),0) > 0 THEN 15 ELSE 0 END)
        + (CASE WHEN coalesce(jsonb_array_length(preferred_phrases), 0) > 0 THEN 15 ELSE 0 END)
      ) AS score
    FROM public.ai_language_dictionary
  ),
  obj AS (
    SELECT tenant_id, LEAST(100, count(*)::int * 10) AS score
    FROM public.ai_intent_objection_map WHERE is_active = true GROUP BY tenant_id
  ),
  kb AS (
    SELECT tenant_id, LEAST(100, count(*)::int * 15) AS score
    FROM public.knowledge_base_docs WHERE status = 'active' GROUP BY tenant_id
  ),
  prods AS (
    SELECT p.tenant_id,
      count(*) FILTER (WHERE p.deleted_at IS NULL AND p.status = 'active') AS total_active,
      count(*) FILTER (WHERE p.deleted_at IS NULL AND p.status = 'active' AND pl.id IS NOT NULL AND pl.short_pitch IS NOT NULL AND pl.commercial_role IS NOT NULL) AS with_semantics
    FROM public.products p
    LEFT JOIN public.ai_product_commercial_payload pl ON pl.product_id = p.id
    GROUP BY p.tenant_id
  ),
  insights AS (
    SELECT tenant_id, LEAST(100, count(*)::int * 5) AS score
    FROM public.ai_brain_insights
    WHERE status::text = 'ativo' AND created_at > now() - interval '90 days'
    GROUP BY tenant_id
  ),
  snap AS (
    SELECT tenant_id,
      CASE
        WHEN updated_at IS NULL THEN 0
        WHEN updated_at > now() - interval '7 days' THEN 100
        WHEN updated_at > now() - interval '30 days' THEN 60
        WHEN updated_at > now() - interval '90 days' THEN 30
        ELSE 10
      END AS score
    FROM public.tenant_ai_context_snapshot
  ),
  ch AS (
    SELECT tenant_id,
      LEAST(100, count(*) FILTER (WHERE is_enabled)::int * 25) AS score
    FROM public.ai_channel_config GROUP BY tenant_id
  )
SELECT
  cfg.tenant_id,
  COALESCE(brand.score, 0) AS brand_context_score,
  COALESCE(lang.score, 0) AS language_score,
  COALESCE(obj.score, 0) AS objections_score,
  COALESCE(kb.score, 0) AS knowledge_base_score,
  CASE WHEN COALESCE(prods.total_active,0) = 0 THEN 0
       ELSE (prods.with_semantics * 100 / NULLIF(prods.total_active,0))::int END AS products_semantics_score,
  COALESCE(insights.score, 0) AS approved_insights_score,
  COALESCE(snap.score, 0) AS snapshot_freshness_score,
  COALESCE(ch.score, 0) AS channel_config_score,
  (
    (CASE WHEN cfg.is_enabled IS TRUE THEN 30 ELSE 0 END)
    + (CASE WHEN cfg.system_prompt IS NOT NULL AND length(cfg.system_prompt) > 50 THEN 25 ELSE 0 END)
    + (CASE WHEN cfg.custom_knowledge IS NOT NULL AND length(cfg.custom_knowledge) > 50 THEN 20 ELSE 0 END)
    + (CASE WHEN cfg.personality_name IS NOT NULL THEN 10 ELSE 0 END)
    + (CASE WHEN cfg.sales_mode_enabled IS TRUE THEN 15 ELSE 0 END)
  ) AS general_ai_config_score,
  COALESCE(prods.total_active, 0) AS products_total_active,
  COALESCE(prods.with_semantics, 0) AS products_with_semantics,
  (
    COALESCE(brand.score,0)
    + COALESCE(lang.score,0)
    + COALESCE(obj.score,0)
    + COALESCE(kb.score,0)
    + (CASE WHEN COALESCE(prods.total_active,0) = 0 THEN 0 ELSE (prods.with_semantics * 100 / NULLIF(prods.total_active,0))::int END)
    + COALESCE(insights.score,0)
    + COALESCE(snap.score,0)
    + COALESCE(ch.score,0)
    + (
      (CASE WHEN cfg.is_enabled IS TRUE THEN 30 ELSE 0 END)
      + (CASE WHEN cfg.system_prompt IS NOT NULL AND length(cfg.system_prompt) > 50 THEN 25 ELSE 0 END)
      + (CASE WHEN cfg.custom_knowledge IS NOT NULL AND length(cfg.custom_knowledge) > 50 THEN 20 ELSE 0 END)
      + (CASE WHEN cfg.personality_name IS NOT NULL THEN 10 ELSE 0 END)
      + (CASE WHEN cfg.sales_mode_enabled IS TRUE THEN 15 ELSE 0 END)
    )
  ) / 9 AS overall_score
FROM cfg
LEFT JOIN brand ON brand.tenant_id = cfg.tenant_id
LEFT JOIN lang ON lang.tenant_id = cfg.tenant_id
LEFT JOIN obj ON obj.tenant_id = cfg.tenant_id
LEFT JOIN kb ON kb.tenant_id = cfg.tenant_id
LEFT JOIN prods ON prods.tenant_id = cfg.tenant_id
LEFT JOIN insights ON insights.tenant_id = cfg.tenant_id
LEFT JOIN snap ON snap.tenant_id = cfg.tenant_id
LEFT JOIN ch ON ch.tenant_id = cfg.tenant_id;

-- Permissão de leitura pela view
GRANT SELECT ON public.ai_context_health_view TO authenticated;
