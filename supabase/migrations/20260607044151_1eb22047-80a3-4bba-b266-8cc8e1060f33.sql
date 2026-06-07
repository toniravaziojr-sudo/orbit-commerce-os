-- =====================================================================
-- C.3.2 Etapa 5 — VIEW leve de CPA de referência (7d / 14d) por campanha Meta.
-- Calculada on-demand a partir de meta_ad_insights. Sem tabela materializada,
-- sem cron novo. Uso EXCLUSIVO do piloto observacional do Ads Autopilot.
-- =====================================================================

CREATE OR REPLACE VIEW public.meta_ad_campaign_cpa_reference AS
WITH base AS (
  SELECT
    i.tenant_id,
    i.meta_campaign_id,
    i.campaign_id,
    i.date_start,
    i.spend_cents,
    i.conversions,
    i.cost_per_conversion_cents
  FROM public.meta_ad_insights i
  WHERE i.date_start >= (CURRENT_DATE - INTERVAL '14 days')::date
),
agg_7d AS (
  SELECT
    tenant_id, meta_campaign_id, campaign_id,
    COUNT(DISTINCT date_start)                 AS days_with_data_7d,
    COALESCE(SUM(spend_cents), 0)              AS spend_cents_7d,
    COALESCE(SUM(conversions), 0)              AS conversions_7d
  FROM base
  WHERE date_start >= (CURRENT_DATE - INTERVAL '7 days')::date
  GROUP BY tenant_id, meta_campaign_id, campaign_id
),
agg_14d AS (
  SELECT
    tenant_id, meta_campaign_id, campaign_id,
    COUNT(DISTINCT date_start)                 AS days_with_data_14d,
    COALESCE(SUM(spend_cents), 0)              AS spend_cents_14d,
    COALESCE(SUM(conversions), 0)              AS conversions_14d
  FROM base
  GROUP BY tenant_id, meta_campaign_id, campaign_id
)
SELECT
  COALESCE(a14.tenant_id, a7.tenant_id)                                  AS tenant_id,
  COALESCE(a14.meta_campaign_id, a7.meta_campaign_id)                    AS meta_campaign_id,
  COALESCE(a14.campaign_id, a7.campaign_id)                              AS campaign_id,
  COALESCE(a7.days_with_data_7d, 0)                                      AS days_with_data_7d,
  COALESCE(a7.spend_cents_7d, 0)                                         AS spend_cents_7d,
  COALESCE(a7.conversions_7d, 0)                                         AS conversions_7d,
  CASE WHEN COALESCE(a7.conversions_7d, 0) > 0
       THEN (a7.spend_cents_7d / a7.conversions_7d)::bigint
       ELSE NULL END                                                     AS cpa_cents_7d,
  COALESCE(a14.days_with_data_14d, 0)                                    AS days_with_data_14d,
  COALESCE(a14.spend_cents_14d, 0)                                       AS spend_cents_14d,
  COALESCE(a14.conversions_14d, 0)                                       AS conversions_14d,
  CASE WHEN COALESCE(a14.conversions_14d, 0) > 0
       THEN (a14.spend_cents_14d / a14.conversions_14d)::bigint
       ELSE NULL END                                                     AS cpa_cents_14d,
  -- Sinal de baixa confiança: < 3 dias de dado ou < 10 conversões na janela 14d.
  (COALESCE(a14.days_with_data_14d, 0) < 3 OR COALESCE(a14.conversions_14d, 0) < 10)
                                                                          AS low_confidence
FROM agg_14d a14
FULL OUTER JOIN agg_7d a7
  ON a7.tenant_id = a14.tenant_id
 AND a7.meta_campaign_id = a14.meta_campaign_id;

COMMENT ON VIEW public.meta_ad_campaign_cpa_reference IS
'C.3.2 Etapa 5 — CPA de referência (7d/14d) por campanha Meta, calculado on-demand a partir de meta_ad_insights. Sem tabela materializada e sem cron. Uso interno do piloto observacional.';

GRANT SELECT ON public.meta_ad_campaign_cpa_reference TO authenticated;
GRANT SELECT ON public.meta_ad_campaign_cpa_reference TO service_role;