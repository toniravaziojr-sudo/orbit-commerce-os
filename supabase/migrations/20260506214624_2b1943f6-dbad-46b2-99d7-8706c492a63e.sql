UPDATE public.tenant_credit_motor_config
SET motor_v2_enabled = true,
    updated_at = NOW()
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';

INSERT INTO public.tenant_credit_motor_config (tenant_id, motor_v2_enabled, live_service_keys)
SELECT 'd1a4d0ed-8842-495e-b741-540a9a345b25', true, '{}'::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_credit_motor_config WHERE tenant_id='d1a4d0ed-8842-495e-b741-540a9a345b25');