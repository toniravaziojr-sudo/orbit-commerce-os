-- Fase A2 — Reserva Sombra IA Imagem
-- Ativa apenas no tenant piloto Respeite o Homem (d1a4d0ed-8842-495e-b741-540a9a345b25).
-- NÃO altera wallet, ledger, RPCs, RLS, service_pricing, motor_v2_enabled, live_service_keys.
UPDATE public.tenant_credit_motor_config
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'shadow_reservation_enabled', true,
  'shadow_reservation_version', '0.1.0'
)
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';
