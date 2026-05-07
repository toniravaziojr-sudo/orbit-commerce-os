-- Fase 3C — Habilita shadow v2 de IA Vídeo no tenant piloto Respeite o Homem.
-- Adiciona apenas chaves canônicas confirmadas em service_pricing.
-- Não toca live_service_keys. Sem efeito financeiro.
UPDATE public.tenant_credit_motor_config
SET shadow_service_keys = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(shadow_service_keys, ARRAY[]::text[]) || ARRAY[
        'fal.kling-video.per_second.pro',
        'fal.kling-avatar-v2-pro.per_second',
        'fal.veo-3.1.per_second.fast.audio',
        'fal.veo-3.1.per_second.fast.noaudio',
        'fal.veo-3.1.per_second.standard.audio',
        'fal.veo-3.1.per_second.standard.noaudio'
      ]
    )
  )
)
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';