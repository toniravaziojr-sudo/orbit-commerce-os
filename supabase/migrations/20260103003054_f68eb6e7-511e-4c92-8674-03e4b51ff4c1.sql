-- Add missing fields to fiscal_invoices for complete NF-e editing
ALTER TABLE fiscal_invoices 
ADD COLUMN IF NOT EXISTS dest_telefone TEXT,
ADD COLUMN IF NOT EXISTS dest_email TEXT,
ADD COLUMN IF NOT EXISTS valor_seguro NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_outras_despesas NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS modalidade_frete TEXT DEFAULT '9',
ADD COLUMN IF NOT EXISTS transportadora_nome TEXT,
ADD COLUMN IF NOT EXISTS transportadora_cnpj TEXT,
ADD COLUMN IF NOT EXISTS peso_bruto NUMERIC(12,3),
ADD COLUMN IF NOT EXISTS peso_liquido NUMERIC(12,3),
ADD COLUMN IF NOT EXISTS quantidade_volumes INTEGER,
ADD COLUMN IF NOT EXISTS especie_volumes TEXT,
ADD COLUMN IF NOT EXISTS observacoes TEXT;