UPDATE public.fiscal_settings
SET certificado_valido_ate = '2027-02-16T18:25:07Z',
    certificado_cnpj = '63269917000106',
    certificado_cn = '63.269.917 DALKEN SANTOS MURAKAMI',
    is_configured = true,
    focus_ultima_sincronizacao = NOW(),
    updated_at = NOW()
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND focus_empresa_id = '211379';