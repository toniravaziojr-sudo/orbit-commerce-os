UPDATE public.fiscal_settings
SET ambiente = 'homologacao',
    focus_ambiente = 'homologacao',
    updated_at = now()
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';