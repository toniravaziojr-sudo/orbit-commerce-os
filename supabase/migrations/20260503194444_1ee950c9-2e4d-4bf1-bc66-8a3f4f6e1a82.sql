ALTER TABLE public.ai_support_config 
  ADD COLUMN IF NOT EXISTS faq_page_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS policy_page_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.ai_support_config.faq_page_ids IS 'IDs de store_pages que serao usadas como FAQ pela IA';
COMMENT ON COLUMN public.ai_support_config.policy_page_ids IS 'IDs de store_pages que serao usadas como Politicas pela IA';