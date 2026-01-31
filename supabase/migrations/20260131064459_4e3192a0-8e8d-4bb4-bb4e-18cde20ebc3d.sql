-- Adicionar coluna para armazenar request_id externo (Fal.ai)
-- Isso permite submit separado de polling

ALTER TABLE creative_jobs 
ADD COLUMN IF NOT EXISTS external_request_id TEXT,
ADD COLUMN IF NOT EXISTS external_model_id TEXT,
ADD COLUMN IF NOT EXISTS poll_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_poll_at TIMESTAMPTZ;

-- Índice para buscar jobs que precisam de polling
CREATE INDEX IF NOT EXISTS idx_creative_jobs_running_poll 
ON creative_jobs (status, last_poll_at) 
WHERE status = 'running';

COMMENT ON COLUMN creative_jobs.external_request_id IS 'Request ID retornado pelo Fal.ai para polling';
COMMENT ON COLUMN creative_jobs.external_model_id IS 'Base model ID para usar no polling (ex: fal-ai/kling-video)';
COMMENT ON COLUMN creative_jobs.poll_attempts IS 'Número de tentativas de polling';
COMMENT ON COLUMN creative_jobs.last_poll_at IS 'Última vez que fizemos polling';