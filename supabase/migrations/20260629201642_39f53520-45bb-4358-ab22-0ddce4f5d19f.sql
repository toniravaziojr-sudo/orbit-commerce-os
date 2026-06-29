ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS mensagem_sefaz text,
  ADD COLUMN IF NOT EXISTS status_sefaz text;

COMMENT ON COLUMN public.fiscal_invoices.mensagem_sefaz IS 'Mensagem retornada pela SEFAZ no último evento (autorização/rejeição). Espelha o campo retornado pelo provedor (Focus NFe).';
COMMENT ON COLUMN public.fiscal_invoices.status_sefaz IS 'Código de status da SEFAZ (ex.: 100 Autorizado, 110 Denegado).';