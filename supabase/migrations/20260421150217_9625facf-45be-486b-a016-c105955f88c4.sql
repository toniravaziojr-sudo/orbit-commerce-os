-- Fase 0 — Higiene de channel_accounts
-- 1) Deduplicação determinística: mantém o "melhor" registro por (tenant_id, channel_type)
--    Critério de preferência: is_active DESC, last_sync_at DESC NULLS LAST, created_at ASC
--    (ativo > sincronizado mais recente > criado primeiro/estável)

WITH ranked AS (
  SELECT
    id,
    tenant_id,
    channel_type,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, channel_type
      ORDER BY
        is_active DESC,
        last_sync_at DESC NULLS LAST,
        created_at ASC
    ) AS rn
  FROM public.channel_accounts
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.channel_accounts ca
USING to_delete td
WHERE ca.id = td.id;

-- 2) Constraint de unicidade — impede futuras duplicatas
ALTER TABLE public.channel_accounts
  ADD CONSTRAINT channel_accounts_tenant_channel_unique
  UNIQUE (tenant_id, channel_type);