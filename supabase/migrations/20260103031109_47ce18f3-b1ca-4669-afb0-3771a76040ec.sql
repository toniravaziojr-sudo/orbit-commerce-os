-- Adicionar campos Focus NFe na tabela fiscal_invoices
ALTER TABLE public.fiscal_invoices
ADD COLUMN IF NOT EXISTS focus_ref TEXT,
ADD COLUMN IF NOT EXISTS xml_url TEXT,
ADD COLUMN IF NOT EXISTS danfe_url TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_justificativa TEXT;

-- Índice para busca por referência Focus
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_focus_ref ON public.fiscal_invoices(focus_ref) WHERE focus_ref IS NOT NULL;

-- Comentários
COMMENT ON COLUMN public.fiscal_invoices.focus_ref IS 'Referência única usada na Focus NFe';
COMMENT ON COLUMN public.fiscal_invoices.xml_url IS 'URL do XML autorizado na Focus NFe';
COMMENT ON COLUMN public.fiscal_invoices.danfe_url IS 'URL do DANFE PDF na Focus NFe';