-- =====================================================================
-- Etapa 7.mem — Subfase C: Tenant Memory Writer
-- Ledger de evidências (idempotência feedback ↔ memória)
-- =====================================================================

CREATE TABLE public.ads_autopilot_memory_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES public.ads_autopilot_feedback(id) ON DELETE CASCADE,
  memory_id UUID REFERENCES public.ads_autopilot_tenant_memory(memory_id) ON DELETE SET NULL,

  -- Identidade lógica do padrão aplicado (mesmo formato da tenant_memory)
  sales_platform TEXT NOT NULL,
  ads_platform TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,

  -- Sustenta ou contradiz o padrão?
  is_supporting BOOLEAN NOT NULL,
  -- Peso da evidência (maior se should_become_preference=true)
  weight NUMERIC(5,4) NOT NULL DEFAULT 1.0
    CHECK (weight >= 0 AND weight <= 5),

  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotência: mesmo feedback nunca é aplicado duas vezes ao mesmo padrão
  CONSTRAINT aame_unique_application
    UNIQUE (tenant_id, feedback_id, sales_platform, ads_platform, memory_type, scope, key)
);

GRANT SELECT ON public.ads_autopilot_memory_evidence TO authenticated;
GRANT ALL ON public.ads_autopilot_memory_evidence TO service_role;

ALTER TABLE public.ads_autopilot_memory_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read own memory evidence"
  ON public.ads_autopilot_memory_evidence FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role manages memory evidence"
  ON public.ads_autopilot_memory_evidence FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_aame_tenant_pattern
  ON public.ads_autopilot_memory_evidence
  (tenant_id, sales_platform, ads_platform, memory_type, scope, key);

CREATE INDEX idx_aame_feedback
  ON public.ads_autopilot_memory_evidence (feedback_id);

CREATE INDEX idx_aame_memory
  ON public.ads_autopilot_memory_evidence (memory_id)
  WHERE memory_id IS NOT NULL;

CREATE INDEX idx_aame_tenant_processed_at
  ON public.ads_autopilot_memory_evidence (tenant_id, processed_at DESC);

COMMENT ON TABLE public.ads_autopilot_memory_evidence IS
  'Etapa 7.mem Subfase C — Ledger imutável que liga feedbacks humanos do Ads Autopilot às preferências aprendidas (tenant_memory). Garante idempotência do Writer. Não altera feedback original. Não influencia a IA nesta subfase.';
