-- Cleanup cirúrgico F2.3: remove apenas a linha sintética de validação
-- Pré-condição validada: existe exatamente 1 linha com idempotency_key='f2.3-validation-001'
-- id confirmado: 82b762b4-fd6c-47d0-bf74-4744322be3a3
DELETE FROM public.platform_cost_ledger
WHERE idempotency_key = 'f2.3-validation-001'
  AND id = '82b762b4-fd6c-47d0-bf74-4744322be3a3'
  AND reason = 'platform_absorbed_cost'
  AND origin_function = 'resend-signup-email';