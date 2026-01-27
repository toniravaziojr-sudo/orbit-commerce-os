-- =============================================================
-- Tabela: creative_jobs
-- Gestão de jobs de geração de criativos com IA (vídeos/imagens)
-- =============================================================

-- Criar enum para tipos de criativos
CREATE TYPE creative_type AS ENUM (
  'ugc_client_video',      -- Aba 1: UGC Cliente gravou vídeo
  'ugc_ai_video',          -- Aba 2: UGC 100% IA
  'short_video',           -- Aba 3: Vídeos curtos (talking head)
  'tech_product_video',    -- Aba 4: Vídeos tecnológicos de produtos
  'product_image'          -- Aba 5: Imagens de pessoas com produto
);

-- Criar enum para status do job
CREATE TYPE creative_job_status AS ENUM (
  'queued',
  'running',
  'succeeded',
  'failed'
);

-- Tabela principal de jobs
CREATE TABLE public.creative_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Tipo e status
  type creative_type NOT NULL,
  status creative_job_status NOT NULL DEFAULT 'queued',
  
  -- Inputs
  prompt TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  product_image_url TEXT,
  reference_images TEXT[], -- URLs das imagens de referência
  reference_video_url TEXT,
  reference_audio_url TEXT,
  
  -- Settings (configurações específicas por tipo)
  settings JSONB NOT NULL DEFAULT '{}',
  
  -- Compliance
  has_authorization BOOLEAN DEFAULT false,
  authorization_accepted_at TIMESTAMPTZ,
  
  -- Pipeline (etapas de processamento)
  pipeline_steps JSONB DEFAULT '[]',
  current_step INTEGER DEFAULT 0,
  
  -- Output
  output_urls TEXT[],
  output_folder_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  
  -- Metadata
  error_message TEXT,
  cost_cents INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Indexes
  CONSTRAINT creative_jobs_valid_status CHECK (
    (status = 'succeeded' AND output_urls IS NOT NULL AND array_length(output_urls, 1) > 0) OR
    (status != 'succeeded')
  )
);

-- Indexes para performance
CREATE INDEX idx_creative_jobs_tenant ON public.creative_jobs(tenant_id);
CREATE INDEX idx_creative_jobs_status ON public.creative_jobs(tenant_id, status);
CREATE INDEX idx_creative_jobs_type ON public.creative_jobs(tenant_id, type);
CREATE INDEX idx_creative_jobs_created ON public.creative_jobs(tenant_id, created_at DESC);
CREATE INDEX idx_creative_jobs_product ON public.creative_jobs(product_id) WHERE product_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.creative_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view creative jobs from their tenant"
ON public.creative_jobs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = creative_jobs.tenant_id
  )
);

CREATE POLICY "Users can create creative jobs in their tenant"
ON public.creative_jobs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = creative_jobs.tenant_id
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update their own jobs"
ON public.creative_jobs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = creative_jobs.tenant_id
  )
);

-- Service role pode fazer tudo (para Edge Functions)
CREATE POLICY "Service role has full access"
ON public.creative_jobs FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Function para atualizar métricas de uso
CREATE OR REPLACE FUNCTION public.increment_creative_usage(
  p_tenant_id UUID,
  p_cost_cents INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_month TEXT;
BEGIN
  v_year_month := get_current_year_month();
  
  INSERT INTO tenant_monthly_usage (
    tenant_id, 
    year_month, 
    ai_usage_cents
  ) VALUES (
    p_tenant_id, 
    v_year_month, 
    p_cost_cents
  )
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    ai_usage_cents = tenant_monthly_usage.ai_usage_cents + p_cost_cents,
    updated_at = now();
END;
$$;

-- Trigger para atualizar timestamps
CREATE TRIGGER update_creative_jobs_updated_at
BEFORE UPDATE ON public.creative_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for job status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.creative_jobs;