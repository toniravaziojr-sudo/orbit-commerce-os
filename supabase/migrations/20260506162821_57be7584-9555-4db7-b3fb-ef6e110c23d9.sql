UPDATE public.tenant_credit_motor_config
SET live_service_keys = ARRAY[]::text[],
    updated_at = NOW()
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';