DELETE FROM public.platform_cost_ledger
WHERE idempotency_key = 'f2.4-validation-001'
  AND id = '5b0d171c-4646-4f69-a49a-b14104a87bc6'
  AND service_key = 'email-system-send'
  AND origin_function = 'auth-email-hook';