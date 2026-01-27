-- =============================================
-- B2B EXTRATOR - Tabelas para prospecção de públicos B2B
-- Fase 1: MVP com busca CNPJ e gerenciamento de públicos
-- =============================================

-- Enum para status de consentimento
CREATE TYPE b2b_consent_status AS ENUM ('pending', 'opted_in', 'opted_out', 'unknown');

-- Enum para status de jobs
CREATE TYPE b2b_job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- Enum para tipo de fonte
CREATE TYPE b2b_source_type AS ENUM ('cnpj_api', 'poi_api', 'enrichment_provider', 'manual');

-- =============================================
-- 1. Tabela de conectores/fontes de dados por tenant
-- =============================================
CREATE TABLE public.b2b_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type b2b_source_type NOT NULL,
  provider_name TEXT NOT NULL, -- ex: 'brasilapi', 'cnpjws', 'tomtom', 'dataseek'
  display_name TEXT NOT NULL,
  api_key_encrypted TEXT, -- chave encriptada (se necessário)
  config JSONB DEFAULT '{}', -- configurações específicas do provider
  is_enabled BOOLEAN DEFAULT true,
  quota_daily INTEGER DEFAULT 100, -- limite diário de consultas
  quota_used_today INTEGER DEFAULT 0,
  last_quota_reset TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider_name)
);

-- =============================================
-- 2. Tabela de jobs de busca/enriquecimento
-- =============================================
CREATE TABLE public.b2b_search_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'search', -- 'search', 'enrich', 'export'
  status b2b_job_status NOT NULL DEFAULT 'pending',
  
  -- Parâmetros da busca
  search_params JSONB NOT NULL DEFAULT '{}', -- { uf, cidade, nicho, cnae, raio_km, etc }
  source_id UUID REFERENCES public.b2b_sources(id),
  
  -- Progresso
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- Resultado
  result_summary JSONB DEFAULT '{}',
  error_message TEXT,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 3. Tabela de entidades (empresas) encontradas
-- =============================================
CREATE TABLE public.b2b_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Identificadores
  cnpj TEXT, -- CNPJ limpo (14 dígitos)
  external_id TEXT, -- ID de fonte externa (POI, etc)
  
  -- Dados cadastrais
  razao_social TEXT,
  nome_fantasia TEXT,
  cnae_principal TEXT,
  cnae_descricao TEXT,
  natureza_juridica TEXT,
  porte TEXT, -- MEI, ME, EPP, etc
  situacao_cadastral TEXT,
  data_abertura DATE,
  capital_social NUMERIC(15,2),
  
  -- Endereço
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf CHAR(2),
  cep TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  
  -- Contatos (podem vir de enriquecimento)
  telefone TEXT,
  telefone_secundario TEXT,
  email TEXT,
  website TEXT,
  
  -- Redes sociais
  instagram TEXT,
  facebook TEXT,
  linkedin TEXT,
  
  -- Metadados de origem
  source_type b2b_source_type,
  source_provider TEXT,
  source_url TEXT, -- URL de onde veio o dado
  enriched_at TIMESTAMPTZ,
  enrichment_provider TEXT,
  
  -- Score e qualidade
  data_quality_score INTEGER DEFAULT 0, -- 0-100
  has_email BOOLEAN GENERATED ALWAYS AS (email IS NOT NULL AND email != '') STORED,
  has_phone BOOLEAN GENERATED ALWAYS AS (telefone IS NOT NULL AND telefone != '') STORED,
  has_whatsapp BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint de unicidade por tenant + CNPJ
  UNIQUE(tenant_id, cnpj)
);

-- Índice para buscas sem CNPJ (POI)
CREATE INDEX idx_b2b_entities_dedup ON public.b2b_entities(tenant_id, nome_fantasia, cidade, uf) WHERE cnpj IS NULL;
CREATE INDEX idx_b2b_entities_cnae ON public.b2b_entities(tenant_id, cnae_principal);
CREATE INDEX idx_b2b_entities_cidade ON public.b2b_entities(tenant_id, uf, cidade);
CREATE INDEX idx_b2b_entities_contacts ON public.b2b_entities(tenant_id, has_email, has_phone);

-- =============================================
-- 4. Tabela de públicos/audiências salvos
-- =============================================
CREATE TABLE public.b2b_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Critérios de filtro (para regenerar)
  filter_criteria JSONB DEFAULT '{}',
  
  -- Contagens
  total_entities INTEGER DEFAULT 0,
  entities_with_email INTEGER DEFAULT 0,
  entities_with_phone INTEGER DEFAULT 0,
  entities_with_consent INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 5. Tabela de membros de públicos
-- =============================================
CREATE TABLE public.b2b_audience_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id UUID NOT NULL REFERENCES public.b2b_audiences(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.b2b_entities(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Consentimento por canal
  email_consent b2b_consent_status DEFAULT 'unknown',
  whatsapp_consent b2b_consent_status DEFAULT 'unknown',
  phone_consent b2b_consent_status DEFAULT 'unknown',
  
  -- Metadados
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_updated_at TIMESTAMPTZ,
  notes TEXT,
  
  UNIQUE(audience_id, entity_id)
);

CREATE INDEX idx_b2b_audience_members_consent ON public.b2b_audience_members(audience_id, email_consent, whatsapp_consent);

-- =============================================
-- 6. Tabela de logs de exportação (auditoria)
-- =============================================
CREATE TABLE public.b2b_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  audience_id UUID REFERENCES public.b2b_audiences(id) ON DELETE SET NULL,
  
  export_type TEXT NOT NULL, -- 'csv_entities', 'csv_contacts', 'crm_import'
  export_channel TEXT, -- 'email', 'whatsapp', 'all'
  
  total_records INTEGER NOT NULL DEFAULT 0,
  filter_applied JSONB DEFAULT '{}',
  
  -- Compliance
  consent_verified BOOLEAN DEFAULT false,
  legal_basis TEXT, -- 'legitimate_interest', 'consent', 'contract'
  
  file_url TEXT, -- URL do arquivo exportado (se aplicável)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Triggers para updated_at
-- =============================================
CREATE TRIGGER update_b2b_sources_updated_at
  BEFORE UPDATE ON public.b2b_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_b2b_search_jobs_updated_at
  BEFORE UPDATE ON public.b2b_search_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_b2b_entities_updated_at
  BEFORE UPDATE ON public.b2b_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_b2b_audiences_updated_at
  BEFORE UPDATE ON public.b2b_audiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS Policies
-- =============================================

-- b2b_sources
ALTER TABLE public.b2b_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view b2b_sources"
  ON public.b2b_sources FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant owners/admins can manage b2b_sources"
  ON public.b2b_sources FOR ALL
  TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id));

-- b2b_search_jobs
ALTER TABLE public.b2b_search_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view b2b_search_jobs"
  ON public.b2b_search_jobs FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can create b2b_search_jobs"
  ON public.b2b_search_jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Job creators can update their jobs"
  ON public.b2b_search_jobs FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_tenant_owner(auth.uid(), tenant_id));

-- b2b_entities
ALTER TABLE public.b2b_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view b2b_entities"
  ON public.b2b_entities FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can manage b2b_entities"
  ON public.b2b_entities FOR ALL
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- b2b_audiences
ALTER TABLE public.b2b_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view b2b_audiences"
  ON public.b2b_audiences FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can manage b2b_audiences"
  ON public.b2b_audiences FOR ALL
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- b2b_audience_members
ALTER TABLE public.b2b_audience_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view b2b_audience_members"
  ON public.b2b_audience_members FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can manage b2b_audience_members"
  ON public.b2b_audience_members FOR ALL
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- b2b_export_logs
ALTER TABLE public.b2b_export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view b2b_export_logs"
  ON public.b2b_export_logs FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can create b2b_export_logs"
  ON public.b2b_export_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- =============================================
-- Função para reset de quota diária
-- =============================================
CREATE OR REPLACE FUNCTION public.reset_b2b_source_quota()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE b2b_sources
  SET quota_used_today = 0, last_quota_reset = now()
  WHERE last_quota_reset < CURRENT_DATE;
END;
$$;