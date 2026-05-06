# Motor Universal de Créditos — Fase A2 Reserva Sombra (IA Imagem)

> **Camada:** Layer 3 — Especificação de Plataforma
> **Status:** ✅ Validada para o caminho primário Fal.AI `medium_1024` — fallback Gemini/OpenAI/Lovable é **gap conhecido** a ser tratado na A2.1
> **Última atualização:** 2026-05-05 (fechamento da coleta dos 10 jobs)
> **Relacionado a:** [`motor-creditos.md`](./motor-creditos.md), [`motor-creditos-fase-3b-shadow.md`](./motor-creditos-fase-3b-shadow.md), [`motor-creditos-fase-a1-pre-router-sidecar.md`](./motor-creditos-fase-a1-pre-router-sidecar.md), [`catalogo-precos-creditos.md`](./catalogo-precos-creditos.md)

---

## 1. Objetivo

A Fase A2 introduz uma **camada de simulação financeira** em cima do pre-router (A1). Para cada geração de imagem real, o sistema calcula em metadata o que `reserve_credits_v2 → capture_reservation | release_reservation` faria, **sem chamar essas RPCs**, **sem alterar wallet** e **sem alterar credit_ledger**.

A2 é **observabilidade financeira pura**. Não é cobrança. Não é live.

---

## 2. O que NÃO é a Fase A2

- ❌ Não chama `reserve_credits_v2`, `capture_reservation`, `release_reservation`, `charge_credits_v2`.
- ❌ Não muta `credit_wallet` nem `credit_ledger`.
- ❌ Não ativa live (`motor_v2_enabled=false`, `live_service_keys=[]`).
- ❌ Não cria pricing novo, não altera `service_pricing`.
- ❌ Não altera RLS, UI, ou comportamento do `resilientGenerate`.
- ❌ Não cobre outras `service_keys` além de `fal.gpt-image-1.5.per_image.medium_1024` nesta fase.
- ❌ Não bloqueia geração real, mesmo se simulação registrar saldo insuficiente.
- ❌ Não registra BRL nem `fx_rate_usd_brl` nesta fase.

---

## 3. Arquitetura

```text
Frontend → creative-image-generate (edge)
   │
   ├─ gates do tenant: pre_router_enabled && shadow_reservation_enabled
   │
   ├─ load 1x por job: pricing (medium_1024) + wallet snapshot (SELECT-only)
   │
   ▼ loop variations
   │
   ├─► preRouteImageGeneration(...)             ◄── Fase A1 (intacta)
   │
   ├─► buildShadowReservationMetadata(...)      ◄── Fase A2 (simulação reserve)
   │     calcula sell_usd, créditos, balance simulation
   │
   ├─► resilientGenerate(...)                   ◄── INALTERADO
   │
   ├─► finalizeShadowReservationOutcome(...)    ◄── Fase A2 (capture | release)
   │
   └─► recordImageShadowV2(..., shadowReservationMeta)
         INSERT service_usage_events com metadata A1+A2 no MESMO evento
```

---

## 4. Gate dedicado

A2 só roda quando **todas** verdadeiras:

| Condição | Valor |
|---|---|
| `tenant_credit_motor_config.metadata->>'pre_router_enabled'` | `'true'` |
| `tenant_credit_motor_config.metadata->>'shadow_reservation_enabled'` | `'true'` |
| `predicted_service_key` (do A1) | `fal.gpt-image-1.5.per_image.medium_1024` |
| `motor_v2_enabled` | `false` (mantido) |
| `live_service_keys` | `[]` (mantido) |

### 4.1 Tenant piloto

Apenas **Respeite o Homem** (`d1a4d0ed-8842-495e-b741-540a9a345b25`):

```sql
UPDATE public.tenant_credit_motor_config
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'shadow_reservation_enabled', true,
  'shadow_reservation_version', '0.1.0'
)
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';
```

Nenhum outro tenant é tocado.

---

## 5. Módulo `shadow-reservation.ts`

Arquivo: `supabase/functions/_shared/credits/shadow-reservation.ts`

Funções puras (jamais lançam, jamais tocam DB/RPC/provider):

- `calculateShadowImageReservation({ pricing, units_quantity, service_key })`
- `simulateShadowBalance({ wallet, reserve_credits })`
- `buildShadowReservationMetadata({ pricing, wallet, service_key, units_quantity })`
- `finalizeShadowReservationOutcome(meta, { succeeded, failure_reason })`
- `isShadowReservationEnabled(metadata)`

Constantes:

- `SHADOW_RESERVATION_VERSION = '0.1.0'`
- `SHADOW_RESERVATION_SUPPORTED_KEYS = ['fal.gpt-image-1.5.per_image.medium_1024']`

---

## 6. Aritmética oficial

```
sell_usd = cost_usd * units_quantity * (1 + markup_pct/100)
credits  = GREATEST(1, CEIL(sell_usd / 0.01))
```

Para `fal.gpt-image-1.5.per_image.medium_1024`:

| Campo | Valor |
|---|---|
| `pricing_id` | `1da61468-e950-4407-8268-6c9df71b2143` |
| `cost_usd_snap` | `0.034` |
| `markup_pct_snap` | `50` |
| `units_quantity` | `1` |
| `sell_usd_snap` | `0.051` |
| `shadow_reserve_credits` | **6** |
| `credit_formula` | `GREATEST(1, CEIL(sell_usd / 0.01))` |
| `rounding_rule` | `ceil` |

`fx_rate_usd_brl` e `sell_brl_snap`: **fora de escopo** nesta fase.

---

## 7. Simulação de saldo

```
available_before = balance_credits - reserved_credits
balance_after    = available_before - shadow_reserve_credits
insufficient     = available_before < shadow_reserve_credits
shadow_would_block_provider_call = pricing.would_block || insufficient
```

Mesmo se `insufficient=true`, a A2 **não bloqueia** a geração real — apenas registra que em live bloquearia.

---

## 8. Metadata estendida em `service_usage_events`

A2 estende o **mesmo evento shadow** já gravado pela A1/3B (sem nova linha):

```jsonc
{
  // existentes (3B + A1)…
  "pre_router_version": "0.1.0-shadow-sidecar",
  "pre_route_match": true,
  "would_block_in_live": false,

  // novos (A2)
  "shadow_reservation_version": "0.1.0",
  "no_wallet_mutation": true,
  "no_ledger_mutation": true,

  "shadow_pricing_snapshot": {
    "pricing_id": "1da61468-e950-4407-8268-6c9df71b2143",
    "service_key": "fal.gpt-image-1.5.per_image.medium_1024",
    "cost_usd_snap": 0.034,
    "markup_pct_snap": 50,
    "sell_usd_snap": 0.051,
    "unit": "image",
    "approved_for_live": true,
    "would_block_in_live": false,
    "block_reason": null
  },

  "shadow_formula_snapshot": {
    "units_quantity": 1,
    "credit_formula": "GREATEST(1, CEIL(sell_usd / 0.01))",
    "rounding_rule": "ceil",
    "credits": 6
  },

  "shadow_balance_simulation": {
    "balance_before": 500,
    "reserved_before": 0,
    "available_before": 500,
    "balance_after": 494,
    "insufficient": false
  },

  "shadow_reserve":  { "would_run": true,  "credits": 6, "decided_at": "ISO" },
  "shadow_capture":  { "would_run": true,  "credits": 6, "decided_at": "ISO" },
  "shadow_release":  { "would_run": false, "reason": null, "credits": 0, "decided_at": null },

  "shadow_would_block_provider_call": false,
  "shadow_error": null
}
```

### 8.1 Visibilidade dos snapshots USD

Eventos shadow são gravados com `cost_owner='platform'`. A RLS de `service_usage_events` libera leitura ao tenant **somente** quando `cost_owner='tenant'` (`Tenant read own usage_events`). Logo, snapshots `cost_usd_snap` / `sell_usd_snap` **ficam admin-only**, sem exposição ao tenant.

---

## 9. Query oficial de coerência A2

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE metadata->'shadow_reserve'->>'would_run' = 'true') AS reserves,
  COUNT(*) FILTER (WHERE metadata->'shadow_capture'->>'would_run' = 'true') AS captures,
  COUNT(*) FILTER (WHERE metadata->'shadow_release'->>'would_run' = 'true') AS releases,
  COUNT(*) FILTER (WHERE metadata->>'shadow_would_block_provider_call' = 'true') AS would_block,
  COUNT(*) FILTER (WHERE metadata->>'shadow_error' IS NOT NULL) AS errors
FROM service_usage_events
WHERE category='ai_image'
  AND service_key='fal.gpt-image-1.5.per_image.medium_1024'
  AND metadata->>'shadow_reservation_version'='0.1.0'
  AND created_at >= now() - interval '30 days';
```

### 9.1 Critérios de saída

- `total >= 10`
- 100% com `shadow_pricing_snapshot.pricing_id` resolvido
- 100% com `shadow_reserve.credits = 6`
- 100% dos jobs `succeeded` com `shadow_capture.would_run=true`
- 0 mutações em wallet
- 0 lançamentos em `credit_ledger`
- 0 ativações de `live_service_keys`
- 0 `shadow_error` crítico
- 0 exposição de custo interno ao tenant (validado via RLS)

---

## 10. Testes técnicos

`supabase/functions/_shared/credits/shadow-reservation_test.ts` — 11 cenários, todos verdes:

| # | Cenário | Resultado |
|---|---|---|
| 1 | aritmética 0.034+50% → 6 créditos | ✅ |
| 2 | saldo suficiente (500) | ✅ insufficient=false |
| 3 | saldo insuficiente (3) | ✅ insufficient=true, block=true |
| 4 | pricing ausente | ✅ block=no_pricing |
| 5 | pricing inativo | ✅ block=pricing_inactive |
| 6 | pricing expirado | ✅ block=pricing_expired |
| 7 | service_key fora do escopo A2 | ✅ block=service_key_out_of_scope |
| 8 | succeeded → capture.would_run=true | ✅ |
| 9 | failed → release.would_run=true (reason) | ✅ |
| 10 | invariantes no_wallet/no_ledger=true | ✅ |
| 11 | gate isShadowReservationEnabled | ✅ |

Nenhum teste chama RPC, banco, wallet, ledger ou provider.

---

## 11. O que NÃO foi alterado

- `service_pricing` — intocado.
- `credit_wallet` — `balance=500, reserved=0, lifetime_consumed=0` no piloto.
- `credit_ledger` — sem novas entradas.
- RPCs `reserve_credits_v2`, `capture_reservation`, `release_reservation`, `charge_credits_v2` — não chamadas pela A2.
- `motor_v2_enabled=false`, `live_service_keys=[]` — preservados.
- `visual-engine.ts`, `image-resolver.ts`, `image-prerouter.ts` — intocados.
- RLS, UI, mapa de UI — intocados.

---

## 12. Próxima fase (condicional, **NÃO autorizada automaticamente**)

A Fase A3 (live seletivo) **não deve ser ativada** antes da decisão explícita sobre como tratar fallback (ver Seção 14). Mantida como direção futura:

- Avaliar Fase A3 — ativação seletiva de `reserve → execute → capture | release` em live limitado a `fal.gpt-image-1.5.per_image.medium_1024` no Respeite o Homem, **somente após A2.1**.
- Definir gate dedicado A3 e plano de rollback antes de qualquer EXECUÇÃO.
- Normalização do alias `model` (cosmético, herdado da A1) pode entrar como melhoria observacional.

---

## 13. Fechamento da coleta — evidências (2026-05-05)

### 13.1 Janela e escopo

- **Tenant:** Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`)
- **Janela UTC:** 2026-05-05 23:15 → 23:29
- **Modo:** shadow sidecar (live desligado)

### 13.2 Cobertura dos jobs

| Métrica | Valor |
|---|---|
| Jobs gerados (`creative_jobs`) | **10** |
| Jobs `succeeded` | **10/10** |
| Jobs com evento A2 (`shadow_reservation_version='0.1.0'`) | **9/10** |
| Jobs **sem** evento A2 | **1/10** — `1bc6496d-57b4-43ce-a470-f3e39469517f` (caiu em fallback Gemini, fora do escopo A2) |

### 13.3 Coerência dos 9 eventos A2 (caminho primário Fal.AI)

| Critério | Resultado |
|---|---|
| `pre_route_match=true` | **9/9** ✅ |
| `predicted_provider=fal` e `actual_provider=fal` | **9/9** ✅ |
| `predicted_service_key = fal.gpt-image-1.5.per_image.medium_1024` | **9/9** ✅ |
| `shadow_pricing_snapshot.cost_usd_snap` | **0.034** (constante) |
| `shadow_pricing_snapshot.markup_pct_snap` | **50** |
| `shadow_pricing_snapshot.sell_usd_snap` | **0.051** |
| `shadow_reserve.credits = 6` / `would_run=true` | **9/9** ✅ |
| `shadow_capture.would_run=true` (jobs `succeeded`) | **9/9** ✅ |
| `shadow_release.would_run=false` | **9/9** ✅ |
| `shadow_would_block_provider_call=false` | **9/9** ✅ |
| `would_block_in_live=false` | **9/9** ✅ |
| `cost_owner='platform'` (snapshots USD protegidos) | **9/9** ✅ |
| `shadow_balance_simulation.insufficient=false` | **9/9** ✅ |
| `balance_before / balance_after` (simulação) | **500 / 494** |

### 13.4 Estado financeiro real (intocado)

| Item | Antes | Depois |
|---|---|---|
| `credit_wallet.balance_credits` | 500 | **500** ✅ |
| `credit_wallet.reserved_credits` | 0 | **0** ✅ |
| `credit_wallet.lifetime_consumed` | 0 | **0** ✅ |
| `credit_ledger` (count) | 1 | **1** ✅ |
| `motor_v2_enabled` | false | **false** ✅ |
| `live_service_keys` | `[]` | **`[]`** ✅ |

### 13.5 Status preciso da Fase A2

- ✅ **Validada** para o caminho primário **Fal.AI `medium_1024`**.
- ⚠️ **Não cobre** fallbacks Gemini / OpenAI / Lovable — **gap conhecido**.
- ❌ **Não** equivale a validação completa de todos os providers/caminhos.
- ❌ **A3 live NÃO é autorizada automaticamente** por esta validação.
- ✅ Wallet, ledger, `service_pricing`, `tenant_credit_motor_config`, RLS, UI e código permaneceram intocados durante a coleta.
- ✅ Nenhuma cobrança real, nenhuma reserva real, nenhum live ativado.

---

## 14. Próxima etapa recomendada — PLANNER A2.1 (Fallback Shadow)

Antes de qualquer decisão sobre A3 live, criar **PLANNER da Fase A2.1 — Fallback Shadow** para definir como registrar/simular fallback quando Fal.AI falha e o fluxo cai em Gemini / OpenAI / Lovable.

A A2.1 deve avaliar (sem implementar):

- **Opção A** — evento shadow separado para fallback, **sem pricing** (apenas observabilidade do fato).
- **Opção B** — metadata de fallback **vinculada ao job**, mesmo sem evento A2 do Fal (extensão do evento existente ou ligação cruzada).
- **Opção C** — em live futuro, se Fal.AI falhar, **liberar reserva** e **bloquear fallback sem pricing** (release determinístico).
- **Opção D** — **cadastrar pricing** de Gemini/OpenAI/Lovable antes de permitir fallback live (homologação financeira por trilha).
- **Opção E** — fallback **apenas em shadow/free** até pricing aprovado por trilha (rollout faseado).

A A2.1 é **planejamento documental**. Não implementa, não ativa live, não toca pricing.

### 14.1 Atualização (2026-05-06) — A2.1 implementada (gate desligado)

A Fase A2.1 foi **implementada** (Opção A — evento shadow separado, sem pricing). Detalhes em
[motor-creditos-fase-a2-1-fallback-shadow.md](./motor-creditos-fase-a2-1-fallback-shadow.md).

- Status: 🟡 código + testes + docs entregues; **gate desligado para todos os tenants**.
- Próxima etapa: prompt separado de EXECUÇÃO para ativar `fallback_shadow_enabled=true` no tenant Respeite o Homem e validar 1 evento real.
- A2 (Fal `medium_1024` com pricing) **não foi alterada** — continua emitindo evento normal.

