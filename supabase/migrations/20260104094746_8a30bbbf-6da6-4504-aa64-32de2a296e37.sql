-- Add DELETE policy for fiscal_invoices (only drafts)
CREATE POLICY "Users can delete own tenant draft invoices"
ON public.fiscal_invoices
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid()
  )
  AND status = 'draft'
);