-- =============================================
-- Campos SEFAZ na fiscal_invoices (cabeçalho)
-- =============================================
ALTER TABLE public.fiscal_invoices
ADD COLUMN IF NOT EXISTS indicador_presenca integer NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS indicador_ie_dest integer NOT NULL DEFAULT 9,
ADD COLUMN IF NOT EXISTS hora_emissao timestamptz,
ADD COLUMN IF NOT EXISTS hora_saida timestamptz,
ADD COLUMN IF NOT EXISTS informacoes_fisco text,
ADD COLUMN IF NOT EXISTS pagamento_indicador integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pagamento_meio text NOT NULL DEFAULT '99',
ADD COLUMN IF NOT EXISTS pagamento_valor numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_bc_icms numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_icms numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_pis numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_cofins numeric(15,2) NOT NULL DEFAULT 0;

-- =============================================
-- Campos SEFAZ na fiscal_invoice_items (itens)
-- =============================================
ALTER TABLE public.fiscal_invoice_items
ADD COLUMN IF NOT EXISTS gtin text,
ADD COLUMN IF NOT EXISTS gtin_tributavel text,
ADD COLUMN IF NOT EXISTS cest text,
ADD COLUMN IF NOT EXISTS valor_desconto numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_frete numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS icms_base numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS icms_aliquota numeric(5,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS icms_valor numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pis_cst text NOT NULL DEFAULT '49',
ADD COLUMN IF NOT EXISTS pis_base numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pis_aliquota numeric(5,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pis_valor numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cofins_cst text NOT NULL DEFAULT '49',
ADD COLUMN IF NOT EXISTS cofins_base numeric(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cofins_aliquota numeric(5,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cofins_valor numeric(15,2) NOT NULL DEFAULT 0;