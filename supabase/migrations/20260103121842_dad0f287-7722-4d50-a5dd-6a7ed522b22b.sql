-- Sprint 1-6: Complete fiscal system tables and columns

-- 1. Add columns to fiscal_invoices for entry invoices and references
ALTER TABLE public.fiscal_invoices 
ADD COLUMN IF NOT EXISTS tipo_documento integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS finalidade_emissao integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS nfe_referenciada text,
ADD COLUMN IF NOT EXISTS printed_at timestamptz;

COMMENT ON COLUMN public.fiscal_invoices.tipo_documento IS '0=Entrada, 1=Saída';
COMMENT ON COLUMN public.fiscal_invoices.finalidade_emissao IS '1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução';
COMMENT ON COLUMN public.fiscal_invoices.nfe_referenciada IS 'Chave de acesso da NF-e original (para devoluções)';

-- 2. Create table for operation natures (naturezas de operação)
CREATE TABLE IF NOT EXISTS public.fiscal_operation_natures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  codigo text,
  cfop_intra text NOT NULL,
  cfop_inter text NOT NULL,
  finalidade integer DEFAULT 1,
  tipo_documento integer DEFAULT 1,
  ativo boolean DEFAULT true,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, nome)
);

-- Enable RLS
ALTER TABLE public.fiscal_operation_natures ENABLE ROW LEVEL SECURITY;

-- RLS policies for operation natures
CREATE POLICY "Users can view their tenant operation natures"
ON public.fiscal_operation_natures FOR SELECT
USING (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
));

CREATE POLICY "Users can insert their tenant operation natures"
ON public.fiscal_operation_natures FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
));

CREATE POLICY "Users can update their tenant operation natures"
ON public.fiscal_operation_natures FOR UPDATE
USING (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
));

CREATE POLICY "Users can delete their tenant operation natures"
ON public.fiscal_operation_natures FOR DELETE
USING (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
) AND is_system = false);

-- 3. Create table for CC-e (Carta de Correção)
CREATE TABLE IF NOT EXISTS public.fiscal_invoice_cces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  numero_sequencia integer NOT NULL,
  correcao text NOT NULL,
  protocolo text,
  status text DEFAULT 'pending',
  response_data jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(invoice_id, numero_sequencia)
);

-- Enable RLS
ALTER TABLE public.fiscal_invoice_cces ENABLE ROW LEVEL SECURITY;

-- RLS policies for CC-e
CREATE POLICY "Users can view their tenant cces"
ON public.fiscal_invoice_cces FOR SELECT
USING (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
));

CREATE POLICY "Users can insert their tenant cces"
ON public.fiscal_invoice_cces FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
));

-- 4. Create table for number inutilization (inutilização)
CREATE TABLE IF NOT EXISTS public.fiscal_inutilizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  serie text NOT NULL,
  numero_inicial integer NOT NULL,
  numero_final integer NOT NULL,
  justificativa text NOT NULL,
  protocolo text,
  status text DEFAULT 'pending',
  response_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fiscal_inutilizacoes ENABLE ROW LEVEL SECURITY;

-- RLS policies for inutilizações
CREATE POLICY "Users can view their tenant inutilizacoes"
ON public.fiscal_inutilizacoes FOR SELECT
USING (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
));

CREATE POLICY "Users can insert their tenant inutilizacoes"
ON public.fiscal_inutilizacoes FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
));

-- 5. Add trigger for updated_at on operation natures
CREATE OR REPLACE TRIGGER update_fiscal_operation_natures_updated_at
BEFORE UPDATE ON public.fiscal_operation_natures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_tipo_documento ON public.fiscal_invoices(tenant_id, tipo_documento);
CREATE INDEX IF NOT EXISTS idx_fiscal_operation_natures_tenant ON public.fiscal_operation_natures(tenant_id, ativo);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoice_cces_invoice ON public.fiscal_invoice_cces(invoice_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_inutilizacoes_tenant ON public.fiscal_inutilizacoes(tenant_id);