ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS telefone text;

COMMENT ON COLUMN public.fiscal_settings.email IS 'E-mail do emitente — usado pela Focus NFe como remetente do DANFE para o cliente.';
COMMENT ON COLUMN public.fiscal_settings.telefone IS 'Telefone do emitente — aparece impresso no DANFE.';