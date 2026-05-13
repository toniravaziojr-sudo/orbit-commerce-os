-- Lote 1.C.1: ampliar máquina de status fiscal
-- Antes: draft, pending, authorized, rejected, cancelled
-- Depois: draft, pending, processing, authorized, rejected, cancelled, error
-- 'processing' = Focus em processamento assíncrono
-- 'error'      = falha técnica não-Sefaz (timeout, rede, parse)
-- 'rejected'   = rejeição Sefaz (continua existindo)
-- Não há registros fora dos novos valores (apenas draft/cancelled hoje).

ALTER TABLE public.fiscal_invoices
  DROP CONSTRAINT IF EXISTS fiscal_invoices_status_check;

ALTER TABLE public.fiscal_invoices
  ADD CONSTRAINT fiscal_invoices_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'pending'::text,
    'processing'::text,
    'authorized'::text,
    'rejected'::text,
    'cancelled'::text,
    'error'::text
  ]));

COMMENT ON COLUMN public.fiscal_invoices.status IS
  'Máquina de status fiscal oficial (Lote 1.C.1): draft → pending/processing → authorized | rejected | error; authorized → cancelled. printed e devolvido NÃO são status, são derivados (danfe_printed_at, nfe_referenciada).';