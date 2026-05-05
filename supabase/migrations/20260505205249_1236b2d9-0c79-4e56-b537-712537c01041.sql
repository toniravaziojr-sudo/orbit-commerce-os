ALTER TABLE public.tenant_credit_motor_config
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;