UPDATE public.fiscal_settings
SET focus_empresa_id = NULL,
    focus_company_status = 'unknown',
    focus_ultima_sincronizacao = NULL,
    webhook_status = 'pending',
    webhook_environment = 'homologacao',
    is_configured = false,
    updated_at = NOW()
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';