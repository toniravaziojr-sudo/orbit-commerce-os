-- Adicionar campos para integração Focus NFe na tabela fiscal_settings
ALTER TABLE public.fiscal_settings
ADD COLUMN IF NOT EXISTS focus_empresa_id TEXT,
ADD COLUMN IF NOT EXISTS focus_empresa_criada_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS focus_ultima_sincronizacao TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS focus_ambiente TEXT DEFAULT 'homologacao' CHECK (focus_ambiente IN ('homologacao', 'producao'));

-- Comentários para documentação
COMMENT ON COLUMN public.fiscal_settings.focus_empresa_id IS 'ID da empresa cadastrada na Focus NFe';
COMMENT ON COLUMN public.fiscal_settings.focus_empresa_criada_em IS 'Data de criação da empresa na Focus NFe';
COMMENT ON COLUMN public.fiscal_settings.focus_ultima_sincronizacao IS 'Última sincronização com Focus NFe';
COMMENT ON COLUMN public.fiscal_settings.focus_ambiente IS 'Ambiente Focus NFe: homologacao ou producao';