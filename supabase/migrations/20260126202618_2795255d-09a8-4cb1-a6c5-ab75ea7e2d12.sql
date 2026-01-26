-- ============================================
-- FASE 1: RAG com pgvector - Fundação
-- ============================================

-- 1.1 Habilitar extensão vector (pgvector)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1.2 Tabela de documentos de Knowledge Base governada
CREATE TABLE public.knowledge_base_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Metadados
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('policy', 'faq', 'product', 'script', 'shipping', 'payment', 'category', 'other')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active', 'archived')),
  priority INTEGER DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
  
  -- Conteúdo original
  content TEXT NOT NULL,
  
  -- Governança
  version INTEGER DEFAULT 1,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  author_id UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Metadados extras
  tags TEXT[] DEFAULT '{}',
  source TEXT, -- 'manual', 'auto_import_products', 'auto_import_policies', etc.
  source_id TEXT, -- ID do registro fonte (ex: product_id, category_id)
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Constraint para evitar duplicação
ALTER TABLE public.knowledge_base_docs 
ADD CONSTRAINT unique_tenant_doc_source UNIQUE (tenant_id, doc_type, source, source_id);

-- 1.3 Tabela de chunks com embeddings
CREATE TABLE public.knowledge_base_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES knowledge_base_docs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Conteúdo do chunk
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_tokens INTEGER,
  
  -- Embedding (1536 dimensões para text-embedding-3-small)
  embedding extensions.vector(1536),
  
  -- Status herdado do doc
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_doc_chunk UNIQUE (doc_id, chunk_index)
);

-- Índice para busca vetorial (IVFFlat)
CREATE INDEX knowledge_base_chunks_embedding_idx 
ON knowledge_base_chunks 
USING ivfflat (embedding extensions.vector_cosine_ops) 
WITH (lists = 100);

-- Índice para filtro por tenant e status
CREATE INDEX knowledge_base_chunks_tenant_active_idx 
ON knowledge_base_chunks (tenant_id, is_active) WHERE is_active = true;

-- Índice para lookup por doc_id
CREATE INDEX knowledge_base_chunks_doc_id_idx 
ON knowledge_base_chunks (doc_id);

-- 1.4 Índices para knowledge_base_docs
CREATE INDEX knowledge_base_docs_tenant_status_idx 
ON knowledge_base_docs (tenant_id, status) WHERE status = 'active';

CREATE INDEX knowledge_base_docs_source_idx 
ON knowledge_base_docs (tenant_id, source, source_id);

-- 1.5 RLS para knowledge_base_docs
ALTER TABLE public.knowledge_base_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant KB docs"
  ON public.knowledge_base_docs FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant KB docs"
  ON public.knowledge_base_docs FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant KB docs"
  ON public.knowledge_base_docs FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete own tenant KB docs"
  ON public.knowledge_base_docs FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- 1.6 RLS para knowledge_base_chunks
ALTER TABLE public.knowledge_base_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant KB chunks"
  ON public.knowledge_base_chunks FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant KB chunks"
  ON public.knowledge_base_chunks FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant KB chunks"
  ON public.knowledge_base_chunks FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete own tenant KB chunks"
  ON public.knowledge_base_chunks FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- 1.7 Trigger para updated_at em knowledge_base_docs
CREATE TRIGGER update_knowledge_base_docs_updated_at
  BEFORE UPDATE ON public.knowledge_base_docs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 1.8 Função de busca semântica
CREATE OR REPLACE FUNCTION public.search_knowledge_base(
  p_tenant_id UUID,
  p_query_embedding extensions.vector(1536),
  p_top_k INTEGER DEFAULT 5,
  p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id UUID,
  doc_id UUID,
  doc_title TEXT,
  doc_type TEXT,
  doc_priority INTEGER,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT 
    c.id AS chunk_id,
    c.doc_id,
    d.title AS doc_title,
    d.doc_type,
    d.priority AS doc_priority,
    c.chunk_text,
    1 - (c.embedding <=> p_query_embedding) AS similarity
  FROM knowledge_base_chunks c
  JOIN knowledge_base_docs d ON d.id = c.doc_id
  WHERE c.tenant_id = p_tenant_id
    AND c.is_active = true
    AND d.status = 'active'
    AND (d.valid_until IS NULL OR d.valid_until > now())
    AND 1 - (c.embedding <=> p_query_embedding) >= p_threshold
  ORDER BY d.priority ASC, similarity DESC
  LIMIT p_top_k;
$$;

-- 1.9 Função para ativar/desativar chunks quando doc muda de status
CREATE OR REPLACE FUNCTION public.sync_kb_chunk_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando doc muda de status, sincronizar chunks
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    UPDATE knowledge_base_chunks 
    SET is_active = true 
    WHERE doc_id = NEW.id;
  ELSIF NEW.status != 'active' AND OLD.status = 'active' THEN
    UPDATE knowledge_base_chunks 
    SET is_active = false 
    WHERE doc_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_kb_chunks_on_doc_status_change
  AFTER UPDATE OF status ON public.knowledge_base_docs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_kb_chunk_status();

-- 1.10 Adicionar campos de RAG config em ai_support_config
ALTER TABLE public.ai_support_config ADD COLUMN IF NOT EXISTS
  rag_similarity_threshold FLOAT DEFAULT 0.7;

ALTER TABLE public.ai_support_config ADD COLUMN IF NOT EXISTS
  rag_min_evidence_chunks INTEGER DEFAULT 1;

ALTER TABLE public.ai_support_config ADD COLUMN IF NOT EXISTS
  rag_top_k INTEGER DEFAULT 5;

ALTER TABLE public.ai_support_config ADD COLUMN IF NOT EXISTS
  handoff_on_no_evidence BOOLEAN DEFAULT true;

ALTER TABLE public.ai_support_config ADD COLUMN IF NOT EXISTS
  data_retention_days INTEGER DEFAULT 365;

ALTER TABLE public.ai_support_config ADD COLUMN IF NOT EXISTS
  redact_pii_in_logs BOOLEAN DEFAULT true;