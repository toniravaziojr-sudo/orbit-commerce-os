# Fase 3C — Piloto Shadow v2 de IA Vídeo (2026-05-07)

> **Camada:** Layer 2 — Especificação de Plataforma  
> **Status:** Ativo (shadow apenas, sem cutover live)  
> **Tenant piloto:** Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`)

## Contexto

A Fase 3B (IA Imagem em `creative-image-generate`) validou o padrão de shadow v2: `cost_owner='platform'`, `status='shadow'`, gate por `shadow_service_keys`, idempotência determinística, NUNCA toca wallet/ledger. A Fase 3C aplica o mesmo padrão em IA Vídeo, plugando exclusivamente o worker `creative-process` (path async — `pollJobInBackground`).

## Decisões estruturais

1. **Resolver canônico obrigatório.** O `model_id` interno (kling-i2v-pro, kling-avatar*, veo31-text-video, gpt-image-bg) é traduzido para a `service_key` canônica de `service_pricing` por `_shared/credits/media-service-key-resolver.ts`. Função pura, nunca lança, retorna `null` quando não há pricing seedado.
2. **Falta de pricing = skip silencioso.** Modelos sem entrada canônica em `service_pricing` (pixverse-*, f5-tts, sync-lipsync, kling-avatar-mascot-std) NÃO geram evento shadow nesta fase — apenas log estruturado `media-shadow.skip_pricing_unresolved`. Sem ruído de placeholders.
3. **Helper único para mídia.** `_shared/credits/media-shadow-event.ts` (`recordMediaShadowEvent`) é o único caminho permitido. `creative-image-generate` continua com seu helper próprio (legado da Fase 3B); novas edges de mídia devem usar `recordMediaShadowEvent`.
4. **Idempotência determinística.** Chave: `{originFunction}-shadow-v2:{tenant_id}:{job_id}:{step_key}:{service_key}`. Retry do mesmo polling não duplica evento (insert duplicado vira log `idempotent_skip`).
5. **`provider_cost_usd_snapshot`.** O custo USD real apurado via Fal Usage API é gravado em `metadata.provider_cost_usd_snapshot` para reconciliação futura, mas NÃO é fonte do cálculo de créditos (cálculo permanece via `service_pricing`).

## Service keys cobertas

Apenas as confirmadas em `service_pricing` no momento da Fase 3C:

| service_key | Origem |
|---|---|
| `fal.kling-video.per_second.pro` | `kling-i2v-pro` (product_video, ugc_ai_video) |
| `fal.kling-avatar-v2-pro.per_second` | `kling-avatar`, `kling-avatar-mascot-pro` |
| `fal.veo-3.1.per_second.fast.{audio\|noaudio}` | `veo31-text-video` (variant default = fast.audio) |
| `fal.veo-3.1.per_second.standard.{audio\|noaudio}` | `veo31-text-video` |
| `fal.veo-3.1.per_second.4k.standard.{audio\|noaudio}` | `veo31-text-video` (caso futuro) |
| `fal.gpt-image-1.5.per_image.{quality}` | `gpt-image-bg` (geração de fundo) |

## Edges plugadas

- ✅ `creative-process` — `pollJobInBackground`, após `fetchRealCostFromFalai` resolver custo real e job marcar `succeeded`. Modelo fixo `kling-i2v-pro` no path async atual.

## Edges fora do escopo desta fase

- `ads-autopilot-creative-generate` — delega via fetch interno para `creative-image-generate` (já em shadow Fase 3B).
- `meta-ads-creatives` — apenas CRUD/sync com a Meta API, não gera mídia.
- `media-generate-video` — apenas enfileira `media_asset_generations`. Geração real de vídeo cai em `creative-process` (path async). Se um worker futuro processar vídeo direto na fila de mídia, plugar `recordMediaShadowEvent` no mesmo padrão.

## Tenant piloto — `tenant_credit_motor_config`

```text
motor_v2_enabled    = true
live_service_keys   = []
shadow_service_keys = [
  // ... chaves Fase 3B (imagem) preservadas
  'fal.kling-video.per_second.pro',
  'fal.kling-avatar-v2-pro.per_second',
  'fal.veo-3.1.per_second.fast.audio',
  'fal.veo-3.1.per_second.fast.noaudio',
  'fal.veo-3.1.per_second.standard.audio',
  'fal.veo-3.1.per_second.standard.noaudio',
]
```

## Critério para promoção live

Mesma régua da Fase 3:
- ≥10 eventos shadow por chave;
- 0 erros (`metadata.shadow_error IS NULL`);
- janela mínima de 7 dias.

Promoção é por `service_key`, manual, via `tenant_credit_motor_config.live_service_keys`. Vídeo IA exige reserve+capture com 110% (regra do `motor-creditos.md` §8) — promover live só após adaptar `creative-process` para abrir reserva ANTES da submissão Fal.

## Validação técnica obrigatória

```sql
SELECT
  service_key,
  metadata->>'model_id'                  AS model_id,
  metadata->>'v2_credits_estimated'      AS credits_v2,
  metadata->>'provider_cost_usd_snapshot' AS cost_usd,
  metadata->>'shadow_error'              AS shadow_error,
  created_at
FROM service_usage_events
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND status = 'shadow'
  AND origin_function = 'creative-process'
ORDER BY created_at DESC
LIMIT 20;
```

## Anti-regressão

1. Toda nova edge de mídia DEVE usar `recordMediaShadowEvent` — não inventar helper alternativo.
2. Toda novo `model_id` interno DEVE ter entrada explícita em `media-service-key-resolver.ts` — caso contrário, retornar `null` (skip silencioso) é o comportamento correto.
3. NUNCA criar `service_key` no formato `creative.*` ou `media.*` — chaves canônicas são `{provider}.{model}.per_{unit}.{variant}`.
4. Validação de shadow consulta `service_usage_events` (`status='shadow'`, `metadata.motor_version='v2'`). NUNCA consultar `credit_ledger` para validar shadow.
