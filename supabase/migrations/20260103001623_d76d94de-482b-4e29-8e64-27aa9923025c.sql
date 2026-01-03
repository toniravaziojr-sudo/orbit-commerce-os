-- Add danfe_printed_at column to track printed invoices
ALTER TABLE fiscal_invoices 
ADD COLUMN IF NOT EXISTS danfe_printed_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance on status filtering
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_status_tenant 
ON fiscal_invoices(tenant_id, status);

-- Create index for draft invoices (most frequently edited)
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_draft 
ON fiscal_invoices(tenant_id, status) WHERE status = 'draft';