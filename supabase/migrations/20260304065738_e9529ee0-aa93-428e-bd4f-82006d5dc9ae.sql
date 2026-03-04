
-- Correção 1: Alterar defaults de show_header e show_footer para false
ALTER TABLE public.ai_landing_pages ALTER COLUMN show_header SET DEFAULT false;
ALTER TABLE public.ai_landing_pages ALTER COLUMN show_footer SET DEFAULT false;
