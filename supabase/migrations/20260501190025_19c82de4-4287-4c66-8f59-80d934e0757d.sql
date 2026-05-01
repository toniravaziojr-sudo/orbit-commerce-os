-- Permitir múltiplos rascunhos placeholder (numero=0, serie=0) no mesmo tenant.
-- Numero/serie reais (>0) continuam únicos.
-- Necessário para que rascunho fiscal seja criado SEM depender de fiscal_settings configurado.

ALTER TABLE public.fiscal_invoices DROP CONSTRAINT IF EXISTS fiscal_invoices_numero_unique;

DROP INDEX IF EXISTS public.fiscal_invoices_numero_unique;

-- Recria como índice único parcial: só aplica quando numero>0 (numeração fiscal real alocada)
CREATE UNIQUE INDEX fiscal_invoices_numero_unique
  ON public.fiscal_invoices (tenant_id, serie, numero)
  WHERE numero > 0;

COMMENT ON INDEX public.fiscal_invoices_numero_unique IS
  'Unicidade aplicada apenas a NFe com numeração real (numero>0). Rascunhos placeholder (numero=0) coexistem livremente — usados quando emissor fiscal ainda não está configurado para o tenant.';