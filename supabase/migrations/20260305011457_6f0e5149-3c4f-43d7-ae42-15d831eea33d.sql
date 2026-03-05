
ALTER TABLE public.ai_landing_pages ADD COLUMN IF NOT EXISTS generated_schema jsonb DEFAULT NULL;
ALTER TABLE public.ai_landing_page_versions ADD COLUMN IF NOT EXISTS schema_content jsonb DEFAULT NULL;
