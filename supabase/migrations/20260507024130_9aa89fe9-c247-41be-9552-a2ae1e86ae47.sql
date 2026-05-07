DO $$
DECLARE
  v1 RECORD;
  v2 RECORD;
  v_count INT;
BEGIN
  -- 1ª chamada: deve criar linha
  SELECT * INTO v1 FROM record_platform_cost(
    p_service_key := 'email-system-send',
    p_units := '{"count":1}'::jsonb,
    p_cost_usd := 0.00060,
    p_origin := 'send-system-email',
    p_origin_id := NULL,
    p_metadata := '{"provider":"sendgrid","category":"email","email_type":"validation","origin_function":"send-system-email","triggered_by":"platform_admin","validation":"f2.5"}'::jsonb,
    p_idempotency_key := 'f2.5-validation-001'
  );
  RAISE NOTICE 'F2.5 insert#1: %', to_jsonb(v1);

  -- 2ª chamada: deve ser idempotente (mesma idempotency_key)
  SELECT * INTO v2 FROM record_platform_cost(
    p_service_key := 'email-system-send',
    p_units := '{"count":1}'::jsonb,
    p_cost_usd := 0.00060,
    p_origin := 'send-system-email',
    p_origin_id := NULL,
    p_metadata := '{"provider":"sendgrid","category":"email","email_type":"validation","origin_function":"send-system-email","triggered_by":"platform_admin","validation":"f2.5"}'::jsonb,
    p_idempotency_key := 'f2.5-validation-001'
  );
  RAISE NOTICE 'F2.5 insert#2 (idempotente): %', to_jsonb(v2);

  SELECT count(*) INTO v_count FROM platform_cost_ledger WHERE idempotency_key = 'f2.5-validation-001';
  RAISE NOTICE 'F2.5 linhas com idem-key f2.5-validation-001 ANTES do cleanup: %', v_count;

  -- Cleanup obrigatório da linha sintética
  DELETE FROM platform_cost_ledger WHERE idempotency_key = 'f2.5-validation-001';

  SELECT count(*) INTO v_count FROM platform_cost_ledger WHERE idempotency_key = 'f2.5-validation-001';
  RAISE NOTICE 'F2.5 linhas APOS cleanup: % (esperado 0)', v_count;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'F2.5 cleanup falhou — linha sintética persiste';
  END IF;
END $$;