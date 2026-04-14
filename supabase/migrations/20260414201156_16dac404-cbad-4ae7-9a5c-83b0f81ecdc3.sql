ALTER TABLE public.fiscal_invoices 
ADD COLUMN IF NOT EXISTS ambiente text DEFAULT 'homologacao';