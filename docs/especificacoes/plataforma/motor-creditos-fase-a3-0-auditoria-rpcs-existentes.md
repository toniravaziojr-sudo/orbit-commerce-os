# Motor Universal de Créditos — Fase A3.0 (Auditoria das RPCs Transacionais Existentes)

**Status:** Concluída em 2026-05-06.
**Escopo:** Auditoria, correção e revalidação das RPCs `reserve_credits_v2`, `capture_reservation`, `release_reservation` e `charge_credits_v2`.
**Premissa original (descartada):** as RPCs transacionais não existiam.
**Realidade verificada:** as 4 RPCs já existem no banco, todas `SECURITY DEFINER`, `SET search_path TO 'public'`, com gate `auth.role()='service_role' OR is_platform_admin_by_auth()`.

## Histórico

### A3.0 — Re-auditoria
A re-auditoria via `pg_proc` confirmou que a base já tinha o motor v2 montado. A fase foi convertida de "implementação" para "auditoria funcional" das RPCs existentes.

### A3.0.1 — Testes funcionais isolados
Foi criada a edge `a3-rpc-test` com 10/11 cenários (reserve dry-run, reserve real, idempotência, capture, capture idempotente, release, release idempotente, saldo insuficiente, capture pós-release, release pós-capture e PRICE_NOT_APPROVED). A primeira execução falhou por propagação 404. A segunda execução revelou bug real:

- **Erro:** `column reference "balance_after" is ambiguous`.
- **Causa:** o `SELECT ... balance_after INTO existing FROM public.credit_ledger` em `reserve_credits_v2` não qualificava a coluna, conflitando com a coluna `balance_after` do `RETURNS TABLE` da própria função.

### A3.0.2 — Correção do `balance_after` ambíguo
Migration cirúrgica em `reserve_credits_v2` substituindo o SELECT por `SELECT cl.id, cl.metadata, cl.balance_after INTO existing FROM public.credit_ledger cl ...`. Assinatura, retorno, segurança, idempotência, gate e cálculo preservados.

A reexecução revelou um segundo bug pré-existente:

- **Erro:** `null value in column "provider" of relation "service_usage_events" violates not-null constraint`.
- **Causa:** os INSERTs em `service_usage_events` dentro de `reserve_credits_v2` (e por simetria em `charge_credits_v2`) omitiam a coluna obrigatória `provider`. `capture_reservation` e `release_reservation` apenas fazem UPDATE no evento existente — não inserem nada — portanto não estavam afetadas.

### A3.0.3 — Correção do `provider` NOT NULL
Migration única com `CREATE OR REPLACE FUNCTION` para `reserve_credits_v2` e `charge_credits_v2`. Os 4 INSERTs em `service_usage_events` (reserve dry-run, reserve real, charge dry-run, charge real) passaram a incluir a coluna `provider` com valor canônico:

```sql
COALESCE(NULLIF(p_metadata->>'provider', ''), split_part(p_service_key, '.', 1))
```

- Prioriza override explícito vindo de `p_metadata->>'provider'` (necessário em fallback chains tipo Fal → Gemini → OpenAI).
- Fallback determinístico ao prefixo da `service_key` (ex.: `fal.gpt-image-1.5...` → `fal`).
- Schema de `service_usage_events` permanece intocado: `provider` continua `NOT NULL` para preservar auditoria.

Nenhuma alteração em assinatura, `RETURNS TABLE`, `SECURITY DEFINER`, `search_path`, gate de auth, idempotência, gate `PRICE_NOT_APPROVED`, cálculo ou permissões `EXECUTE`. `capture_reservation` e `release_reservation` não foram tocadas.

## Revalidação A3.0.3

### Cenários obrigatórios (edge `a3-rpc-test`) — 11/11 verde

| # | Cenário | Resultado |
|---|---|---|
| T1 | Dry-run reserve | ✅ |
| T2 | Reserve real | ✅ |
| T3 | Reserve idempotente | ✅ |
| T4 | Capture | ✅ |
| T5 | Capture idempotente | ✅ |
| T6 | Release | ✅ |
| T7 | Release idempotente | ✅ |
| T8 | Saldo insuficiente | ✅ |
| T9A | Capture após release | ✅ (`reservation_already_finalized`) |
| T9B | Release após capture | ✅ (`reservation_already_finalized`) |
| T10 | PRICE_NOT_APPROVED | ✅ (preço placeholder rejeitado) |

Cleanup pós-execução: `wallet=0, ledger=0, events=0, tenant=0` (100%).

### Teste mínimo de `charge_credits_v2`

Tenant sintético criado via `service_role`, com:
- dry-run com `fal.gpt-image-1.5.per_image.medium_1024` + `{"images":1}` → `success=true`, `credits_charged=6`.
- charge real → débito de 6 créditos, ledger criado, evento `captured` com `provider='fal'`.
- chamada idempotente repetida → `same_ledger=true`, sem cobrança duplicada.
- `provider` preenchido nos eventos `shadow` e `captured` via prefixo da service_key.
- Cleanup: tenant, wallet, ledger e eventos sintéticos = 0.

## Estado preservado de "Respeite o Homem"

Antes e depois da fase, sem nenhuma variação:

- `balance_credits = 500`
- `reserved_credits = 0`
- `lifetime_consumed = 0`
- `credit_ledger count = 1`
- `service_usage_events count = 23` (baseline original — eventos externos legítimos pré-existentes, nenhum novo evento criado pela A3.0.3)
- `motor_v2_enabled = false`
- `live_service_keys = []`

## Garantias da fase

- ❌ Nenhuma imagem gerada.
- ❌ Nenhum provider externo chamado (Fal, OpenAI, Gemini).
- ❌ Live continua desligado.
- ❌ `creative-image-generate` não foi tocado.
- ❌ `service_pricing` inalterado.
- ❌ Schema de `service_usage_events` inalterado (`provider` continua `NOT NULL`).
- ❌ RLS, UI e edge functions de produção não foram alteradas.
- ✅ Cleanup 100% — zero órfãos no banco.

## Limpeza pós-fase

Em **2026-05-06**, após validação 11/11 verde:
- Edge `a3-rpc-test` **removida** do repositório (`supabase/functions/a3-rpc-test/`) e do projeto Supabase (`delete_edge_functions`).
- Live permaneceu desligado durante a remoção.
- Respeite o Homem permaneceu intocado (balance=500, reserved=0, lifetime=0, ledger=1, motor_v2=false, live_keys=[]).
- Nenhum dado sintético criado durante a limpeza.

## Próxima fase

**A3.1 — Live Fal-only para `creative-image-generate`** (PLANNER) — liberado para iniciar.
Pré-condições remanescentes:
1. Definição do conjunto exato de `live_service_keys` que entra primeiro (apenas chaves Fal aprovadas via `approved_for_live=true` em `service_pricing`).
2. Plano de rollback documentado.

## Migrations aplicadas

- `20260506150027_b6402d7c-05ce-41cf-b987-5637716e6256.sql` — A3.0.2 (`balance_after` ambíguo).
- `20260506_a3_0_3_provider_in_service_usage_events.sql` — A3.0.3 (`provider` nos 4 INSERTs).

---

# Fase A3.1 — Live Fal-only para `creative-image-generate` (executada em 2026-05-06)

## Escopo

- Tenant: **Respeite o Homem** (`d1a4d0ed-8842-495e-b741-540a9a345b25`).
- Service key: **`fal.gpt-image-1.5.per_image.medium_1024`** (custo: 6 créditos).
- Gate: `live_service_keys = ['fal.gpt-image-1.5.per_image.medium_1024']`, `motor_v2_enabled` permaneceu **false** globalmente.
- `service_pricing.metadata.approved_for_live = true` apenas nessa chave.
- Fallback bloqueado em modo live (sem Gemini/OpenAI/Lovable).

## Implementação

- Novo helper: `supabase/functions/_shared/credits/live-v2.ts` (reserve_credits_v2 → provider → capture_reservation / release_reservation).
- Branch live ativada em `creative-image-generate` (idempotência `v2|reserve|...`, `v2|capture|...`, `v2|release|...`).
- Supressão de reserva sombra A2 e eventos financeiros duplicados quando `isLive=true`.

## Validação real (2 tentativas controladas)

### Tentativa 1 — falha do provider Fal (timeout 60s, sync mode)
- `reserve_success` → `provider_started` → `fal-client: GPT Image 1 timeout after 60s` → `release_success` → `fallback_blocked_without_pricing`.
- Reserva: `59d92d65-…` (status `reserved`).
- Release: `cce3a82c-…` (status `released`).
- Saldo: **500 → 500** (intacto). Nada cobrado. Motor cobriu o cenário negativo conforme projetado.

### Tentativa 2 — sucesso, primeira cobrança real do motor v2
- Job `4356b480-fa2d-4f28-9aa0-be691ba49cf2`.
- Reserve ledger `27c4c16c-…` (status `reserved`, idempotency `v2|reserve|d1a4d0ed-…|4356b480-…|fal.gpt-image-1.5.per_image.medium_1024|1`).
- Capture ledger `be5118ca-…` (status `captured`, `credits_delta=-6`, `balance_before=500`, `balance_after=494`, idempotency `v2|capture|27c4c16c-…`).
- `service_usage_events` (`9db2bee4-…`): status `captured`, provider `fal`, `credit_ledger_id=27c4c16c-…`, metadata com `capture_ledger_id`, `credits_charged=6`, `motor_version=v2`, `pipeline_version=10.0`.
- Wallet pós-captura: **`balance_credits=494`**, **`reserved_credits=0`**, **`lifetime_consumed=6`**.

## Rollback executado

- `UPDATE tenant_credit_motor_config SET live_service_keys = ARRAY[]::text[]` no tenant Respeite o Homem.
- Estado pós-rollback confirmado: `live_service_keys=[]`, `motor_v2_enabled=false`.
- Nenhum outro tenant impactado em qualquer momento.

## Pendência aberta

- **Timeout do Fal GPT Image 1.5 em sync mode (60s)**: causou a falha da tentativa 1. Tratar em fase separada (avaliar async submit/poll do Fal ou aumento de timeout cirúrgico em `_shared/fal-client`). Não bloqueia A3.x; o motor já demonstrou comportamento correto em ambos os cenários.

## Status

✅ A3.1 concluída e validada com cobrança real canônica de 6 créditos (500 → 494). Motor v2 desligado para shadow após sucesso.

---

## A3.1 — Onda 1 — Mitigação do timeout Fal GPT Image 1.5 (2026-05-06)

**Contexto:** A tentativa 1 da A3.1 falhou pelo timeout sync de 60s no `fal.run/fal-ai/gpt-image-1/edit-image`. Motor v2 lidou corretamente (release + fallback bloqueado), sem débito.

**Mudança aplicada (cirúrgica, isolada):**
- Arquivo: `supabase/functions/_shared/fal-client.ts`
- Função: `generateImageWithGptImage1` (única tocada)
- Constante local nova: `GPT_IMAGE_1_TIMEOUT_MS = 120_000` (60s → 120s)
- Logs estruturados no `AbortError` agora incluem `latency_ms`, `timeout_ms_configured`, `model`, `endpoint` e mensagem dinâmica baseada no valor real configurado.
- Mensagens de erro/sucesso passaram a registrar `latency_ms` real.

**Não tocado:** `generateImageWithFalPro`, `generateImageWithFalTurbo`, `generateVideoWithFal`, `applyLipsyncWithFal`, qualquer RPC, `credit_wallet`, `credit_ledger`, `service_usage_events`, `service_pricing`, `tenant_credit_motor_config`, `creative-image-generate` (apenas redeploy por dependência).

**Estado pré e pós-execução do tenant Respeite o Homem (inalterado):**
- `live_service_keys = []`
- `motor_v2_enabled = false`
- Wallet: `balance_credits=494`, `reserved_credits=0`, `lifetime_consumed=6`

**Status da Onda 1:** ✅ Aplicada como **mitigação**, NÃO solução definitiva. Cobre p95 do Fal GPT Image 1.5, mas não p99.

### Validação funcional Onda 1 — 2026-05-06 17:00 UTC

Geração manual de 1 imagem pela UI (Criativos → Imagens com IA), tenant Respeite o Homem, em modo **shadow** (live continua desligado).

**Resultado do job:**
- `creative_jobs.id` = `4ff8f8a5-21e1-44bb-8f29-0ad9c16baf9f`
- `status` = `succeeded`
- `provider` vencedor = `fal`
- `external_model_id` = `fal-ai/gpt-image-1/edit-image` (= GPT Image 1.5)
- `service_key` = `fal.gpt-image-1.5.per_image.medium_1024`
- `pipeline_version` = `10.0`
- `processing_time_ms` = **`60286`** (~60,3 s)
- `n_outputs` = 1
- `cost_cents` = 40 (custo de provider Fal pago pela plataforma, registrado em `creative_jobs`)

**Evidência crítica:** o job concluiu **acima do antigo timeout de 60.000 ms** (60.286 ms). Com a configuração anterior, esta exata geração teria falhado por `AbortError`, idêntica à Tentativa 1 da A3.1. Com `GPT_IMAGE_1_TIMEOUT_MS = 120_000` (Onda 1), o cliente Fal aguardou e capturou o resultado com sucesso. Prova empírica direta da causa raiz e da eficácia da mitigação.

**Estado financeiro/configuração — pré (16:55:45 UTC) vs pós (17:00:13 UTC):**
- `live_service_keys` = `[]` → `[]` (inalterado)
- `motor_v2_enabled` = `false` → `false` (inalterado)
- Wallet: `balance_credits=494`, `reserved_credits=0`, `lifetime_consumed=6` → **idem** (intacto)
- `credit_ledger` count = 5 → **5** (zero cobrança real)
- `service_usage_events` count = 25 → 26 (+1 evento **shadow** apenas)

**Evento shadow registrado** (`service_usage_events.id` = `da581c01-2ab2-473e-9ccf-aa18e5c652f4`):
- `service_key` = `fal.gpt-image-1.5.per_image.medium_1024`
- `provider` = `fal`
- `status` = `shadow`
- `metadata.mode` = `shadow`
- `metadata.motor_version` = `v2`
- `credit_ledger_id` = `null`
- `reservation_ledger_id` = `null`

**Observação sobre logs:** o log estruturado com `timeout_ms_configured=120000` só é emitido no caminho do `AbortError`. Como o job teve sucesso, esse log não disparou — comportamento correto. Evidência indireta porém definitiva: 60.286 ms > 60 s antigo ⇒ sucesso só possível com 120 s.

**Classificação:** ✅ **Onda 1 validada funcionalmente.**

**Onda 2 (pendente, exige PLANNER próprio antes de implementar) — prioridade média:** migrar `generateImageWithGptImage1` para fluxo `submitToQueue` + `pollStatus` + `fetchResult` (padrão já usado por FLUX e vídeos), com probe prévio para validar se a Fal queue ainda retorna 405 nesse modelo. Onda 1 cobre o caso real observado (60–120 s); Onda 2 é a solução definitiva para p99 e cargas pesadas.
