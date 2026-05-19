-- Libera exclusão de notas fiscais sem efeito fiscal (draft, rejected, cancelled)
-- para owner/admin do tenant. Mantém bloqueio em status com efeito fiscal
-- (authorized, processing, etc.). Compat com regra anterior (apenas draft).

DROP POLICY IF EXISTS "Owners and admins delete draft invoices" ON public.fiscal_invoices;

CREATE POLICY "Owners and admins delete non-fiscal invoices"
ON public.fiscal_invoices
FOR DELETE
USING (
  status = ANY (ARRAY['draft','rejected','cancelled'])
  AND (
    has_role(auth.uid(), tenant_id, 'owner'::app_role)
    OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
  )
);