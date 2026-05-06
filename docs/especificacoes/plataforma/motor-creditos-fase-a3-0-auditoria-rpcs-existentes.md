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
