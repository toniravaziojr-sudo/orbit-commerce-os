-- Adicionar coluna ai_role em store_pages para permitir marcar páginas
-- como fonte oficial de FAQ ou Políticas para a IA de atendimento.
ALTER TABLE public.store_pages
  ADD COLUMN IF NOT EXISTS ai_role text;

ALTER TABLE public.store_pages
  DROP CONSTRAINT IF EXISTS store_pages_ai_role_check;

ALTER TABLE public.store_pages
  ADD CONSTRAINT store_pages_ai_role_check
  CHECK (ai_role IS NULL OR ai_role IN ('faq', 'policy'));

CREATE INDEX IF NOT EXISTS idx_store_pages_ai_role
  ON public.store_pages (tenant_id, ai_role)
  WHERE ai_role IS NOT NULL;

-- Remover os campos antigos de ai_support_config (substituídos por ai_role nas páginas).
-- Esses campos foram criados na Onda 1A.2 e ainda não são lidos em runtime.
ALTER TABLE public.ai_support_config
  DROP COLUMN IF EXISTS faq_page_ids;

ALTER TABLE public.ai_support_config
  DROP COLUMN IF EXISTS policy_page_ids;