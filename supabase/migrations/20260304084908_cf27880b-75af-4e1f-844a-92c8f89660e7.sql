
-- V5: Add generated_blocks column to ai_landing_pages
-- This stores structured BlockNode JSON instead of raw HTML
-- Allows rendering with real React components via PublicTemplateRenderer

ALTER TABLE public.ai_landing_pages 
ADD COLUMN IF NOT EXISTS generated_blocks jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.ai_landing_pages.generated_blocks IS 'V5: Structured BlockNode JSON for React-based rendering. When present, takes priority over generated_html.';

-- Also add to versions table for history tracking
ALTER TABLE public.ai_landing_page_versions
ADD COLUMN IF NOT EXISTS blocks_content jsonb DEFAULT NULL;

COMMENT ON COLUMN public.ai_landing_page_versions.blocks_content IS 'V5: Structured BlockNode JSON snapshot for this version';
