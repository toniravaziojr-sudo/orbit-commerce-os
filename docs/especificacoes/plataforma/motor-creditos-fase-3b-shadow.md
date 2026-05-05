# Motor Universal de Créditos — Fase 3B Shadow (IA Imagem)

> **Camada:** Layer 3 — Especificação de Plataforma
> **Status:** Validado em shadow mode (sem cutover para live)
> **Última atualização:** 2026-05-05
> **Relacionado a:** [`motor-creditos.md`](./motor-creditos.md), [`funcoes-pagas.md`](./funcoes-pagas.md)

---

## 1. Objetivo do documento

Este documento registra a validação oficial da **Fase 3B do Motor Universal de Créditos** em **shadow mode** para o vertical de **IA Imagem**, e estabelece a regra anti-regressão para futuras validações de shadow.

A Fase 3B introduz a instrumentação shadow do motor v2 nas edge functions de geração visual sem ativar cobrança real. O objetivo é coletar telemetria de custo/uso paralela ao comportamento atual (v1), permitindo comparação antes de qualquer cutover.

---

## 2. Fonte correta de validação

Shadow mode **deve ser validado exclusivamente em `service_usage_events`**.

Filtros principais:

- `status = 'shadow'`
- `metadata->>'motor_version' = 'v2'`
- `metadata->>'mode' = 'shadow'`

Regras associadas:

- A tabela `credit_ledger` é **exclusiva para eventos financeiros (live)**.
- **Não** procurar débito shadow em `credit_ledger`.
- **A ausência de linha em `credit_ledger` é o comportamento correto em shadow.**
- A `credit_wallet` **não é alterada** em shadow.

---

## 3. Regra anti-regressão

> **Qualquer validação futura de shadow mode do Motor Universal de Créditos deve consultar `service_usage_events`. Consultar `credit_ledger` para validar shadow é erro de validação, salvo se a fase já estiver em live/cutover.**

Esta regra existe porque uma validação anterior procurou o débito em `credit_ledger` e gerou falso positivo, concluindo erroneamente que o shadow não havia sido registrado.

---

## 4. Estrutura esperada do evento shadow IA Imagem

Campos esperados em cada linha de `service_usage_events` gerada pela Fase 3B:

| Campo | Valor esperado |
|---|---|
| `tenant_id` | tenant real (não nulo) |
| `cost_owner` | `'platform'` |
| `status` | `'shadow'` |
| `category` | `'ai_image'` |
| `service_key` | chave canônica Fal.AI (ex.: `fal.gpt-image-1.5.per_image.medium_1024`) |
| `provider` | provedor real vencedor (ex.: `fal`) |
| `origin_function` | `'creative-image-generate'` |
| `units_json` | unidades consumidas (imagens, resolução etc.) |
| `metadata.motor_version` | `'v2'` |
| `metadata.mode` | `'shadow'` |
| `metadata.v1_credits` | `null` |
| `metadata.v2_credits_estimated` | preenchido (estimativa do motor v2) |
| `metadata.provider_cost_source` | `'service_pricing_estimate'` |
| `metadata.is_internal_shadow` | `true` |
| `metadata.shadow_for_tenant_id` | tenant real |
| `metadata.idempotency_key` | preenchido |
| `credit_ledger_id` | `null` |
| `platform_cost_ledger_id` | `null` |
| `reservation_ledger_id` | `null` |

---

## 5. O que NÃO deve acontecer em shadow

- **Não** alterar `credit_wallet`.
- **Não** criar lançamento financeiro em `credit_ledger`.
- **Não** criar reservation/capture/refund.
- **Não** chamar `charge_credits_v2`, `reserve_credits_v2` ou `capture_reservation`.
- **Não** ativar live (`motor_v2_enabled` permanece `false`; `live_service_keys` permanece `[]`).
- **Não** chamar o provedor duas vezes (shadow é instrumentação paralela ao mesmo call).
- **Não** expor custo real ao tenant.

---

## 6. Resultado validado

A geração real executada no tenant **Respeite o Homem** criou um evento shadow com:

- `service_key = 'fal.gpt-image-1.5.per_image.medium_1024'`
- `origin_function = 'creative-image-generate'`
- `cost_owner = 'platform'`
- `status = 'shadow'`
- `tenant_id` real do Respeite o Homem preenchido
- `metadata.motor_version = 'v2'`, `metadata.mode = 'shadow'`, `metadata.is_internal_shadow = true`
- `credit_ledger_id`, `platform_cost_ledger_id`, `reservation_ledger_id` todos `null`
- `credit_wallet` e `credit_ledger` financeiros **inalterados**

Comportamento dos demais provedores no piloto:

- `image-resolver` mapeou corretamente o modelo real para a `service_key` canônica.
- Gemini ficou em `skip pricing_not_ready`.
- OpenAI legacy ficou em `skip legacy_provider_not_in_pilot`.

Estado do motor durante o teste:

- `motor_v2_enabled = false`
- `live_service_keys = []`
- `shadow_service_keys` contendo as 9 chaves Fal + `youtube_upload` preservada.

---

## 7. Query oficial de validação shadow

```sql
SELECT id, tenant_id, status, cost_owner, service_key, category, provider,
       origin_function, units_json, metadata, created_at
FROM service_usage_events
WHERE status = 'shadow'
  AND metadata->>'motor_version' = 'v2'
  AND category = 'ai_image'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 8. Query anti-erro

> **Esta query abaixo NÃO deve ser usada para validar shadow.** Serve apenas para confirmar que **não houve lançamento financeiro indevido** no `credit_ledger`.

```sql
SELECT transaction_type, credits_delta, service_key, category, metadata, created_at
FROM credit_ledger
WHERE tenant_id = '<tenant_id>'
ORDER BY created_at DESC
LIMIT 20;
```

Resultado esperado em shadow: **nenhuma linha relacionada ao job shadow**.

---

## 9. Pendência separada — pipeline_version (corrigido tecnicamente; pendente validação)

**Histórico da divergência:**

- Frontend (`ImageGenerationTabV3`) enviava `pipeline_version: '10.0'` no payload.
- Backend (`creative-image-generate`) sobrescrevia e persistia `pipeline_version = '9.0.0'` em `creative_jobs`.
- O backend corretamente não aceita versão arbitrária vinda do cliente — o valor persistido é definido por constante interna.

**Causa raiz:**

- Constante `VERSION = '9.0.0'` **hardcoded** no edge `creative-image-generate`, desalinhada do rótulo `10.0` declarado pelo frontend.

**Correção aplicada:**

- Constante backend atualizada para `VERSION = '10.0'`.
- Edge `creative-image-generate` redeployada.
- **Jobs antigos não foram migrados** — o histórico permanece com `pipeline_version = '9.0.0'` por design (sem reescrita de auditoria passada).
- A correção afeta **apenas novos jobs** gerados a partir do redeploy.

**Classificação:** bug **não bloqueador** — apenas rótulo de auditoria.

**Impacto:**

- ❌ Não afetou shadow.
- ❌ Não afetou cobrança.
- ❌ Não afetou geração visual.
- ❌ Não tocou em `credit_wallet`, `credit_ledger`, `service_usage_events`, `service_pricing` ou `tenant_credit_motor_config`.
- ✅ Afeta apenas o rótulo de auditoria/observabilidade em `creative_jobs.settings->>'pipeline_version'`.

**Validação pendente:**

- O próximo job real de IA Imagem deve gravar `creative_jobs.settings->>'pipeline_version' = '10.0'`.
- Até que esse job exista e seja conferido, a correção permanece **pendente de validação**.

**Status:** 📌 **corrigido tecnicamente; pendente validação no próximo job real.**

---

## 10. Status

📌 **STATUS DA ENTREGA:** Fase 3B IA Imagem — **validada end-to-end em shadow mode**. Cutover para live **não autorizado** e **não executado**.
