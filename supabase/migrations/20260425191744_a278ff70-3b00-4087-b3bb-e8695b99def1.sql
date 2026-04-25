-- ============================================================
-- D9 — Telemetria de execuções de tools do agente comercial F2
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_support_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identificadores de contexto do turno
  conversation_id uuid,
  message_id uuid,
  turn_correlation_id uuid NOT NULL,
  iteration smallint NOT NULL DEFAULT 1,

  -- Tool executada
  tool_name text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Resultado (preview truncado, SEM PII - contrato documentado abaixo)
  result_preview text,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  duration_ms integer,

  -- Bloqueio estruturado
  blocked boolean NOT NULL DEFAULT false,
  block_type text,
  block_reason text,

  -- Estado da jornada (pipeline state)
  pipeline_state_before text,
  pipeline_state_after text,

  -- Cruzamento com D6 (fonte do business context usada no turno)
  business_context_source text,

  -- Modelo de IA usado no turno
  model text,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- CHECKs de domínio
  CONSTRAINT ai_support_tool_calls_block_type_chk CHECK (
    block_type IS NULL OR block_type IN (
      'pipeline_state_block',
      'guardrail',
      'missing_variant',
      'tool_disabled',
      'channel_restriction',
      'other'
    )
  ),
  CONSTRAINT ai_support_tool_calls_business_context_source_chk CHECK (
    business_context_source IS NULL OR business_context_source IN (
      'tenant_business_context',
      'ai_business_snapshot',
      'neutral'
    )
  ),
  CONSTRAINT ai_support_tool_calls_iteration_chk CHECK (iteration >= 1 AND iteration <= 50),
  CONSTRAINT ai_support_tool_calls_result_preview_chk CHECK (
    result_preview IS NULL OR length(result_preview) <= 500
  )
);

-- Documentação dos contratos críticos
COMMENT ON TABLE public.ai_support_tool_calls IS
  'Telemetria de execuções de tools do agente F2 (ai-support-chat). Registro imutável (somente insert via service role). Retenção prevista: 90 dias.';
COMMENT ON COLUMN public.ai_support_tool_calls.turn_correlation_id IS
  'Identificador único do turno (gerado pelo agente). Igual em todas as linhas do mesmo loop de tool-calls — permite reconstruir a sequência completa do turno.';
COMMENT ON COLUMN public.ai_support_tool_calls.result_preview IS
  'Prévia truncada do resultado da tool (máx 500 chars). PROIBIDO incluir PII: telefone, e-mail, endereço, CPF, payload bruto grande. Sanitização é responsabilidade do agente antes do insert.';
COMMENT ON COLUMN public.ai_support_tool_calls.block_type IS
  'Tipo estruturado de bloqueio: pipeline_state_block | guardrail | missing_variant | tool_disabled | channel_restriction | other.';
COMMENT ON COLUMN public.ai_support_tool_calls.business_context_source IS
  'Cruzamento com D6: qual fonte do business context foi usada neste turno (tenant_business_context | ai_business_snapshot | neutral).';

-- Índices operacionais
CREATE INDEX IF NOT EXISTS idx_ai_support_tool_calls_tenant_created
  ON public.ai_support_tool_calls (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_support_tool_calls_turn
  ON public.ai_support_tool_calls (turn_correlation_id);

CREATE INDEX IF NOT EXISTS idx_ai_support_tool_calls_conversation
  ON public.ai_support_tool_calls (conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

-- Índice parcial para auditoria de falhas/bloqueios (alta seletividade)
CREATE INDEX IF NOT EXISTS idx_ai_support_tool_calls_failures
  ON public.ai_support_tool_calls (tenant_id, created_at DESC)
  WHERE success = false OR blocked = true;

-- ============================================================
-- RLS — telemetria imutável, leitura tenant-scoped
-- ============================================================
ALTER TABLE public.ai_support_tool_calls ENABLE ROW LEVEL SECURITY;

-- SELECT: membros da tenant veem apenas a própria
CREATE POLICY "Tenant members can view own tool calls"
ON public.ai_support_tool_calls
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT user_roles.tenant_id
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
  )
);

-- INSERT: apenas service role (o agente roda com service role)
CREATE POLICY "Service role can insert tool calls"
ON public.ai_support_tool_calls
FOR INSERT
TO service_role
WITH CHECK (true);

-- Sem policies de UPDATE/DELETE → ninguém edita/apaga (telemetria imutável).
-- Service role bypassa RLS para futura limpeza programada de retenção.