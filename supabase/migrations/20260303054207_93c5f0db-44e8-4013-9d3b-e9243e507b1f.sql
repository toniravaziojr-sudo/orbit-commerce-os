-- Add show_header and show_footer toggles to ai_landing_pages
ALTER TABLE public.ai_landing_pages
  ADD COLUMN IF NOT EXISTS show_header boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_footer boolean NOT NULL DEFAULT true;