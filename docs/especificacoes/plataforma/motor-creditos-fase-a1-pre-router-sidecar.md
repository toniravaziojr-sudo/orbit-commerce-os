# Motor Universal de Créditos — Fase A1 Pre-Router Sidecar (IA Imagem)

> **Camada:** Layer 3 — Especificação de Plataforma
> **Status:** Implantado em shadow sidecar — pendente coleta de amostras (≥10 jobs reais)
> **Última atualização:** 2026-05-05
> **Relacionado a:** [`motor-creditos.md`](./motor-creditos.md), [`motor-creditos-fase-3b-shadow.md`](./motor-creditos-fase-3b-shadow.md), [`catalogo-precos-creditos.md`](./catalogo-precos-creditos.md)

---

## 1. Objetivo

A Fase A1 introduz uma **camada observacional de pre-routing** para IA Imagem. O sistema calcula, **antes** da chamada ao provider, qual `provider/model/service_key` seria escolhido, e depois compara essa previsão com o resultado real entregue pelo `resilientGenerate`.

**A Fase A1 não altera o comportamento real da geração.** É observabilidade pura, sem cobrança, sem reserva, sem captura, sem alteração de wallet ou ledger.

---

## 2. O que NÃO é a Fase A1

- ❌ Não refatora `visual-engine.ts`.
- ❌ Não transforma `resilientGenerate` em executor de plano.
- ❌ Não ativa live (`motor_v2_enabled` continua `false`, `live_service_keys` continua `[]`).
- ❌ Não chama `reserve_credits_v2`, `capture_reservation`, `release_reservation` ou `charge_credits_v2`.
- ❌ Não toca `credit_wallet`, `credit_ledger`, `service_pricing`.
- ❌ Não cadastra pricing novo (Gemini/Nano Banana permanecem sem pricing nesta fase).
- ❌ Não cria evento separado de erro em `service_usage_events`.
- ❌ Não chama o provider duas vezes.

---

## 3. Arquitetura

```text
Frontend
   │
   ▼
creative-image-generate (edge)
   │
   ├─ gate: tenant_credit_motor_config.metadata.pre_router_enabled === true
   │
   ▼ loop variations
   │
   ├─► preRouteImageGeneration(...)            ◄── SIDECAR Fase A1
   │     calcula predicted_provider/model/service_key
   │     monta fallback_chain
   │     decide would_block_in_live
   │     NÃO chama provider externo
   │
   ├─► resilientGenerate(...)                  ◄── INALTERADO
   │     decide actualProvider/model real
   │
   └─► recordImageShadowV2(..., preRouteDecision)
         INSERT service_usage_events (status='shadow')
         metadata estendida com predicted_*, actual_*, pre_route_match
```

---

## 4. Gate dedicado

O sidecar só roda quando **todas** as condições forem verdadeiras:

| Condição | Valor esperado |
|---|---|
| `tenant_credit_motor_config.metadata->>'pre_router_enabled'` | `'true'` |
| `motor_v2_enabled` | `false` (mantido) |
| `live_service_keys` | `[]` (mantido) |

`shadow_service_keys` **não é gate principal** do pre-router. Continua sendo o gate do `recordImageShadowV2` (compatibilidade com Fase 3B).

### 4.1 Tenant piloto

Apenas **Respeite o Homem** (`d1a4d0ed-8842-495e-b741-540a9a345b25`):

```sql
UPDATE tenant_credit_motor_config
SET metadata = metadata || jsonb_build_object(
  'pre_router_enabled', true,
  'pre_router_version', '0.1.0-shadow-sidecar'
)
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';
```

Migration estrutural aplicada:

```sql
ALTER TABLE public.tenant_credit_motor_config
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
```

---

## 5. Contrato `preRouteImageGeneration`

Arquivo: `supabase/functions/_shared/credits/image-prerouter.ts`

```ts
preRouteImageGeneration({
  tenant_id, feature, job_id, variation_index,
  outputSize, quality, has_reference_image,
  available_keys: { fal, gemini, openai, lovable }
}) → PreRouteDecision
```

Saída `PreRouteDecision`:

| Campo | Tipo |
|---|---|
| `pre_router_version` | `'0.1.0-shadow-sidecar'` |
| `decided_at` | ISO 8601 |
| `predicted_provider` | `'fal' \| 'gemini' \| 'openai' \| 'lovable'` |
| `predicted_model` | string |
| `predicted_service_key` | string \| null |
| `predicted_pricing_id` | null (não consultado nesta fase) |
| `predicted_estimated_credits` | null (estimativa real fica no shadow event) |
| `fallback_chain` | array com `{ step, provider, model, service_key, mode, reason_to_use }` |
| `would_block_in_live` | bool |
| `block_reason` | `'no_pricing' \| 'pricing_not_approved_for_live' \| 'tenant_not_in_live_keys' \| 'legacy_provider_out_of_live' \| 'provider_unavailable' \| null` |
| `mode_predicted` | `'live' \| 'shadow' \| 'free' \| 'shadow_observation'` |

### 5.1 Regras de decisão

A cascata espelha `visual-engine.ts → resilientGenerate`:

1. **Step 1 — Fal GPT Image 1**: se `has_reference_image && available_keys.fal`, é a previsão primária. Para `1024x1024 + medium` resolve `fal.gpt-image-1.5.per_image.medium_1024`.
2. **Step 2 — Gemini Nativa**: se `available_keys.gemini`, entra como fallback. `service_key=null`, `mode='free'` (sem pricing nesta fase).
3. **Step 3 — OpenAI legacy**: marcado `legacy/out_of_live`, `would_block_in_live=true` se primário.
4. **Step 4 — Lovable Gateway**: último recurso, `mode='free'`.

### 5.2 Garantias

- Função pura, **nunca lança**.
- Toda exceção interna devolve decisão segura (`mode_predicted='shadow_observation'`, `would_block_in_live=true`).
- Não chama provider externo, RPC, banco ou rede.

---

## 6. Metadata estendida em `service_usage_events`

A linha shadow existente (Fase 3B) recebe campos adicionais quando `preRouteDecision` for fornecida:

```jsonc
{
  // existentes (Fase 3B):
  "motor_version": "v2",
  "mode": "shadow",
  "is_internal_shadow": true,
  "v2_credits_estimated": 6,
  "idempotency_key": "ai-image-shadow-v2|...",

  // novos (Fase A1):
  "pre_router_version": "0.1.0-shadow-sidecar",
  "pre_route_decision": { /* objeto completo */ },
  "predicted_provider": "fal",
  "predicted_model": "gpt-image-1.5",
  "predicted_service_key": "fal.gpt-image-1.5.per_image.medium_1024",
  "actual_provider": "fal",
  "actual_model": "fal-ai/gpt-image-1/edit-image",
  "actual_service_key": "fal.gpt-image-1.5.per_image.medium_1024",
  "pre_route_match": true,
  "pre_route_match_dimensions": { "provider": true, "model": true, "service_key": true },
  "mismatch_reason": null,
  "would_block_in_live": false,
  "actual_pricing_missing": false,
  "no_billing": true
}
```

**Garantias:**

- `status` continua `'shadow'`.
- `cost_owner` continua `'platform'`.
- `tenant_id` real preenchido.
- Não cria nova linha — aproveita o INSERT do shadow Fase 3B.
- Se `preRouteDecision` for `null` (gate desligado ou erro do sidecar), o INSERT do shadow Fase 3B continua igual, sem campos sidecar.
- Se `actual_provider` não tiver `service_key` (Gemini/OpenAI/Lovable sem pricing), o evento shadow **não é gravado** e o sidecar emite WARN estruturado:

```jsonc
{
  "evt": "creative-image.shadow.event_not_recorded",
  "tenant_id": "...",
  "job_id": "...",
  "variation_index": 1,
  "actual_provider": "gemini",
  "actual_model": "gemini-2.5-flash-image",
  "predicted_provider": "fal",
  "predicted_service_key": "fal.gpt-image-1.5.per_image.medium_1024",
  "event_not_recorded_reason": "pricing_not_ready",
  "detail": "..."
}
```

Esta limitação é **aceita** nesta fase. Casos sem evento devem ser analisados via WARN. Fase futura pode introduzir evento de erro separado.

---

## 7. Cálculo de match

`computePreRouteMatch(decision, actual)` retorna:

- `match: boolean` = `predicted_provider === actual_provider && predicted_service_key === actual_service_key`
- `dimensions: { provider, model, service_key }` (booleans)
- `mismatch_reason`:
  - `null` se match
  - `fal_failed_runtime` se previu Fal mas real foi outro
  - `actual_pricing_missing` se predicted tinha service_key e real não
  - `fallback_used` se providers diferentes
  - `model_alias_mismatch` se providers iguais mas service_keys diferentes
  - `unknown` para casos não classificados

Outros valores possíveis aceitos no contrato (não emitidos pelo cálculo automático nesta fase): `pricing_not_ready`, `provider_unavailable`, `event_not_recorded`.

---

## 8. Query oficial de coerência

```sql
SELECT
  COUNT(*) AS total_jobs,
  COUNT(*) FILTER (WHERE (metadata->>'pre_route_match')::bool) AS matches,
  COUNT(*) FILTER (WHERE NOT (metadata->>'pre_route_match')::bool) AS mismatches,
  COUNT(*) FILTER (WHERE metadata->>'predicted_service_key' IS NULL) AS no_pricing_predicted,
  COUNT(*) FILTER (WHERE (metadata->>'would_block_in_live')::bool) AS would_block,
  COUNT(*) FILTER (WHERE metadata->>'mismatch_reason' = 'fallback_used') AS fallback_in_real,
  COUNT(*) FILTER (WHERE metadata->>'actual_pricing_missing' = 'true') AS actual_pricing_missing
FROM service_usage_events
WHERE status='shadow'
  AND category='ai_image'
  AND metadata->>'pre_router_version'='0.1.0-shadow-sidecar'
  AND created_at >= now() - interval '30 days';
```

### 8.1 Critérios para liberar próxima fase

- `total_jobs >= 10`
- `matches / total_jobs >= 0.90`
- `no_pricing_predicted = 0` para casos onde `actual_provider = fal`
- `would_block = 0` para jobs que seriam live em `fal.gpt-image-1.5.per_image.medium_1024`
- Zero exceções críticas no sidecar (logs do edge sem `creative-image.pre-router.error` recorrentes)

> **Limitação aceita:** casos sem evento por falta de pricing (Gemini/OpenAI/Lovable como `actual_provider`) **não aparecem** na query acima. Devem ser analisados via WARN estruturado nos logs do edge enquanto a Fase A1 não criar evento de erro separado.

---

## 9. O que NÃO foi alterado

- `supabase/functions/_shared/visual-engine.ts` — intocado.
- `supabase/functions/_shared/credits/image-resolver.ts` — apenas importado, sem mudança de contrato.
- `supabase/functions/_shared/credits/charge.ts` — intocado.
- RPCs `reserve_credits_v2`, `capture_reservation`, `release_reservation`, `charge_credits_v2`, `estimate_credits_internal` — não chamadas pelo sidecar (estimativa continua via `estimateCredits` no shadow Fase 3B).
- RLS de `tenant_credit_motor_config` — intocado.
- UI — nenhuma mudança.
- `service_pricing` — intocado.
- `live_service_keys` — `[]` no tenant piloto (mantido).

---

## 10. Próxima fase (Fase A2 — futura, condicional)

Após coleta de ≥10 jobs reais com `matches/total >= 0.90`, a Fase A2 avaliará:

- Quebrar `resilientGenerate` em executor de plano (single-attempt).
- Orquestrar `reserve → execute → capture | release` no edge.
- Modelo de fallback B aprovado (re-reserva por tentativa).
- Live inicial limitado a `fal.gpt-image-1.5.per_image.medium_1024` no Respeite o Homem.

A Fase A2 **não** será iniciada sem novo prompt PLANNER e validação dos critérios da seção 8.1.

---

## 11. Status

📌 **STATUS DA ENTREGA:** Fase A1 IA Imagem — **implantada em shadow sidecar**. Pendente:

- Coletar ≥10 jobs reais para validar critério de coerência.
- `pipeline_version=10.0` no backend pendente de validação no próximo job real (separado, não bloqueante).
