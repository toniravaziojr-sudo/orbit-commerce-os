-- =============================================
-- FASE 2: FILA DE PROCESSAMENTO MULTIMODAL
-- Tabela ai_media_queue para vision/transcrição
-- =============================================

-- Tabela de fila de processamento de mídia
CREATE TABLE IF NOT EXISTS public.ai_media_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  attachment_id UUID NOT NULL REFERENCES message_attachments(id) ON DELETE CASCADE,
  
  -- Tipo de processamento
  process_type TEXT NOT NULL CHECK (process_type IN ('vision', 'transcription')),
  
  -- Status da fila
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed', 'skipped')),
  
  -- Retry control
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ DEFAULT now(),
  
  -- Resultado
  result JSONB,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  -- Evitar duplicação por attachment + tipo
  CONSTRAINT unique_attachment_process UNIQUE (attachment_id, process_type)
);

-- Índice para processador buscar itens pendentes
CREATE INDEX IF NOT EXISTS ai_media_queue_pending_idx 
ON ai_media_queue (status, next_retry_at) 
WHERE status IN ('queued', 'failed');

-- Índice por tenant para queries de status
CREATE INDEX IF NOT EXISTS ai_media_queue_tenant_idx 
ON ai_media_queue (tenant_id, created_at DESC);

-- RLS
ALTER TABLE ai_media_queue ENABLE ROW LEVEL SECURITY;

-- Policy: usuários do tenant podem ver a fila
CREATE POLICY "Users can view tenant media queue"
ON ai_media_queue FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.tenant_id = ai_media_queue.tenant_id
  )
);

-- Policy: service role pode tudo (para Edge Functions)
CREATE POLICY "Service role full access to media queue"
ON ai_media_queue FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Adicionar campos de metering expandido em tenant_monthly_usage
ALTER TABLE tenant_monthly_usage 
ADD COLUMN IF NOT EXISTS ai_messages_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_image_analysis_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_audio_transcription_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_audio_duration_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_handoff_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_embedding_tokens INTEGER DEFAULT 0;

-- Função para incrementar métricas de IA
CREATE OR REPLACE FUNCTION increment_ai_metrics(
  p_tenant_id UUID,
  p_messages INTEGER DEFAULT 0,
  p_images INTEGER DEFAULT 0,
  p_audio_count INTEGER DEFAULT 0,
  p_audio_seconds INTEGER DEFAULT 0,
  p_handoffs INTEGER DEFAULT 0,
  p_no_evidence INTEGER DEFAULT 0,
  p_embedding_tokens INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_month TEXT;
BEGIN
  v_year_month := get_current_year_month();
  
  INSERT INTO tenant_monthly_usage (
    tenant_id, year_month,
    ai_messages_count, ai_image_analysis_count,
    ai_audio_transcription_count, ai_audio_duration_seconds,
    ai_handoff_count, ai_no_evidence_count, ai_embedding_tokens
  ) VALUES (
    p_tenant_id, v_year_month,
    p_messages, p_images, p_audio_count, p_audio_seconds,
    p_handoffs, p_no_evidence, p_embedding_tokens
  )
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    ai_messages_count = tenant_monthly_usage.ai_messages_count + p_messages,
    ai_image_analysis_count = tenant_monthly_usage.ai_image_analysis_count + p_images,
    ai_audio_transcription_count = tenant_monthly_usage.ai_audio_transcription_count + p_audio_count,
    ai_audio_duration_seconds = tenant_monthly_usage.ai_audio_duration_seconds + p_audio_seconds,
    ai_handoff_count = tenant_monthly_usage.ai_handoff_count + p_handoffs,
    ai_no_evidence_count = tenant_monthly_usage.ai_no_evidence_count + p_no_evidence,
    ai_embedding_tokens = tenant_monthly_usage.ai_embedding_tokens + p_embedding_tokens,
    updated_at = now();
END;
$$;