-- Adicionar colunas de email customizado em fiscal_settings
ALTER TABLE public.fiscal_settings
ADD COLUMN IF NOT EXISTS email_nfe_subject TEXT,
ADD COLUMN IF NOT EXISTS email_nfe_body TEXT;

-- Adicionar colunas expandidas em fiscal_operation_natures
ALTER TABLE public.fiscal_operation_natures
ADD COLUMN IF NOT EXISTS descricao TEXT,
ADD COLUMN IF NOT EXISTS serie INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS crt INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS ind_pres INTEGER DEFAULT 9,
ADD COLUMN IF NOT EXISTS faturada BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS consumidor_final BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS operacao_devolucao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS csosn_padrao TEXT,
ADD COLUMN IF NOT EXISTS cst_icms TEXT,
ADD COLUMN IF NOT EXISTS cst_pis TEXT DEFAULT '49',
ADD COLUMN IF NOT EXISTS cst_cofins TEXT DEFAULT '49',
ADD COLUMN IF NOT EXISTS info_complementares TEXT,
ADD COLUMN IF NOT EXISTS info_fisco TEXT;

-- Atualizar naturezas existentes com dados corretos do Simples Nacional
UPDATE public.fiscal_operation_natures
SET 
  descricao = 'Venda de mercadoria adquirida ou recebida de terceiros',
  crt = 1,
  csosn_padrao = '102',
  cst_pis = '49',
  cst_cofins = '49',
  consumidor_final = true,
  faturada = true,
  ind_pres = 9
WHERE nome = 'Venda de Mercadoria';

UPDATE public.fiscal_operation_natures
SET 
  descricao = 'Devolução de venda de mercadoria adquirida ou recebida de terceiros',
  crt = 1,
  csosn_padrao = '900',
  cst_pis = '49',
  cst_cofins = '49',
  operacao_devolucao = true,
  faturada = false,
  ind_pres = 9
WHERE nome = 'Devolução de Venda';

UPDATE public.fiscal_operation_natures
SET 
  descricao = 'Venda de mercadoria de produção própria do estabelecimento',
  crt = 1,
  csosn_padrao = '101',
  cst_pis = '49',
  cst_cofins = '49',
  consumidor_final = true,
  faturada = true,
  ind_pres = 9
WHERE nome = 'Venda de Produção Própria';

UPDATE public.fiscal_operation_natures
SET 
  descricao = 'Remessa de mercadoria para troca ou substituição',
  crt = 1,
  csosn_padrao = '400',
  cst_pis = '49',
  cst_cofins = '49',
  faturada = false,
  ind_pres = 9
WHERE nome = 'Remessa para Troca';

UPDATE public.fiscal_operation_natures
SET 
  descricao = 'Remessa de mercadoria para conserto ou reparo',
  crt = 1,
  csosn_padrao = '400',
  cst_pis = '49',
  cst_cofins = '49',
  faturada = false,
  ind_pres = 9
WHERE nome = 'Remessa para Conserto';

UPDATE public.fiscal_operation_natures
SET 
  descricao = 'Bonificação, doação ou brinde de mercadoria',
  crt = 1,
  csosn_padrao = '400',
  cst_pis = '49',
  cst_cofins = '49',
  faturada = false,
  ind_pres = 9
WHERE nome = 'Bonificação/Doação/Brinde';