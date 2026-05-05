-- Fase 3B Motor Universal de Créditos — Suporte a 'shadow' em service_usage_events
-- Correção transversal v2: aceita 'shadow' e permite cost_owner='platform' + tenant_id NOT NULL apenas quando status='shadow'

-- 1) Atualizar CHECK de status para incluir 'shadow'
ALTER TABLE public.service_usage_events
  DROP CONSTRAINT IF EXISTS service_usage_events_status_check;

ALTER TABLE public.service_usage_events
  ADD CONSTRAINT service_usage_events_status_check
  CHECK (status = ANY (ARRAY[
    'estimated'::text,
    'reserved'::text,
    'captured'::text,
    'released'::text,
    'refunded'::text,
    'failed'::text,
    'shadow'::text
  ]));

-- 2) Ajustar chk_sue_owner_tenant para permitir cost_owner='platform' + tenant_id preenchido
--    SOMENTE quando status='shadow' (observabilidade interna do motor v2)
ALTER TABLE public.service_usage_events
  DROP CONSTRAINT IF EXISTS chk_sue_owner_tenant;

ALTER TABLE public.service_usage_events
  ADD CONSTRAINT chk_sue_owner_tenant
  CHECK (
    -- Caso normal: tenant paga → tenant_id obrigatório
    (cost_owner = 'tenant' AND tenant_id IS NOT NULL)
    OR
    -- Plataforma absorve custo normal → sem tenant_id
    (cost_owner = 'platform' AND tenant_id IS NULL)
    OR
    -- Exceção shadow v2: plataforma absorve mas mantém tenant_id real para análise admin
    (cost_owner = 'platform' AND tenant_id IS NOT NULL AND status = 'shadow')
  );

COMMENT ON CONSTRAINT chk_sue_owner_tenant ON public.service_usage_events IS
  'Motor v2: tenant→tenant_id obrigatório; platform→tenant_id NULL; exceção: shadow permite platform+tenant_id real para observabilidade admin sem expor ao tenant.';