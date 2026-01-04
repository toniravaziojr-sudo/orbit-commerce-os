-- Adicionar campo description (nome/descrição do que foi comprado)
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS description text;

-- Adicionar campo para vincular a NF de entrada
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS entry_invoice_id uuid REFERENCES public.fiscal_invoices(id) ON DELETE SET NULL;

-- Adicionar índice para busca por NF de entrada
CREATE INDEX IF NOT EXISTS idx_purchases_entry_invoice_id ON public.purchases(entry_invoice_id);

-- Comentários para documentação
COMMENT ON COLUMN public.purchases.description IS 'Descrição/nome do que foi comprado';
COMMENT ON COLUMN public.purchases.entry_invoice_id IS 'Referência à NF de entrada vinculada';