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

---

# Fase A3.2 — Etapa 1A — RPC `get_credit_history` (executada em 2026-05-06)

## Escopo

Criar somente a função de leitura `public.get_credit_history`, sem UI, sem hook, sem alteração no motor v2 e sem ativação live. Fonte canônica de movimentos: `credit_ledger`. Enriquecimento: `service_usage_events` + `creative_jobs`. Saldo continua sendo lido de `credit_wallet` por `useCreditWallet` — **não** é responsabilidade desta RPC.

## Auditoria prévia

- Não existia função `get_credit_history` nem equivalente. ✅ Sem duplicação.
- `credit_ledger` (29 colunas) confirmado como fonte canônica financeira (`balance_before`, `balance_after`, `transaction_type ∈ {reserve,capture,release,adjust}`, `operation_status ∈ {reserved,released,captured,completed}`).
- `service_usage_events` (15 colunas) confirmado: vínculo via `credit_ledger_id`, `reservation_ledger_id`, `metadata->>'capture_ledger_id'`. `cost_owner ∈ {tenant,platform}`, `status ∈ {captured,released,shadow}`.
- `creative_jobs` enriquecimento por `id` ↔ `credit_ledger.job_id`, expondo `product_name`.
- Helpers existentes reutilizados: `is_platform_admin_by_auth()`, `user_has_tenant_access(uuid)`.

## Contrato final

```sql
get_credit_history(
  p_tenant_id uuid,
  p_start_date timestamptz default null,
  p_end_date   timestamptz default null,
  p_transaction_type text default null,
  p_operation_status text default null,
  p_category   text default null,
  p_service_key text default null,
  p_provider   text default null,
  p_job_id     uuid default null,
  p_include_platform boolean default false,
  p_limit      int default 50,    -- clampado entre 1 e 100
  p_offset     int default 0
) RETURNS TABLE (
  event_id, ledger_id, tenant_id, created_at,
  transaction_type, operation_status, category,
  service_key_public, service_key, provider, feature,
  credits_delta, balance_before, balance_after, description,
  job_id, creative_job_id, creative_product_name,
  source_function,
  cost_usd, sell_usd, markup_pct_snap, cost_brl, sell_brl, fx_rate_usd_brl,
  metadata_public, metadata_admin,
  total_count
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
```

`GRANT EXECUTE` apenas para `authenticated`. `REVOKE` de `PUBLIC` (anon não pode executar — confirmado: chamada anônima retorna `42501 permission denied`).

## Estratégia de deduplicação

1 linha por movimento de `credit_ledger`. Enriquecimento via `LATERAL` com `LIMIT 1`, prioridade determinística:

1. `service_usage_events.credit_ledger_id = ledger.id`
2. `service_usage_events.reservation_ledger_id = ledger.id`
3. `metadata->>'capture_ledger_id' = ledger.id`
4. `created_at DESC` como desempate

Movimentos `purchase`/`adjust`/`bonus`/`release` sem evento associado retornam normalmente, com colunas operacionais nulas.

## Tenant Identity Guard e mascaramento

- Não-admin sem `user_has_tenant_access(p_tenant_id)` → `RAISE EXCEPTION 'forbidden' (42501)`.
- Não-admin: `p_include_platform` forçado a `false`; eventos `cost_owner='platform'` ou `status='shadow'` filtrados.
- Não-admin: `service_key`, `provider`, `cost_usd`, `sell_usd`, `markup_pct_snap`, `cost_brl`, `sell_brl`, `fx_rate_usd_brl`, `source_function`, `metadata_admin` retornam **NULL server-side**.
- `service_key_public` sempre disponível (categoria amigável: `category` ou primeiro segmento de `service_key`, ex.: `fal`).
- Admin: enxerga campos crus + `metadata_admin` agregando `ledger.metadata` e `service_usage_events.metadata`.

## Validação executada (Respeite o Homem `d1a4d0ed-...`)

Simulação direta da query interna (admin) retornou 5 linhas, exatamente correspondentes ao `credit_ledger` do tenant, sem multiplicação:

| transaction_type | operation_status | credits_delta | balance_after | sue vinculado | sue_status |
|---|---|---:|---:|---|---|
| capture  | captured  | -6  | 494 | `9db2bee4` (via `capture_ledger_id`) | captured |
| reserve  | reserved  |  0  | 500 | `9db2bee4` (via `reservation_ledger_id`) | captured |
| release  | released  |  0  | 500 | (sem evento — release sem SUE) | — |
| reserve  | reserved  |  0  | 500 | `55cb4c4c` | released |
| adjust   | completed | +500| 500 | (sem evento — purchase manual) | — |

`total_count = 5` consistente.

**Saldo:** validado **fora da RPC** via `credit_wallet`: `balance=494`, `reserved=0`, `lifetime_consumed=6` ✅ (responsabilidade segue de `useCreditWallet`).

## Validações de segurança

- ✅ Chamada anônima (sem JWT) → `42501 permission denied for function get_credit_history` (REVOKE FROM PUBLIC funcionando).
- ✅ Não-admin sem acesso ao tenant → `forbidden` (Tenant Identity Guard).
- ✅ Não-admin com `p_include_platform=true` → forçado a `false` internamente; nenhum evento `cost_owner='platform'` ou `status='shadow'` retornado.
- ✅ Campos sensíveis mascarados server-side (não dependem do frontend).
- ✅ `LIMIT` clampado em 100, `OFFSET` ≥ 0.

## Garantias de não-impacto

- Nenhuma alteração em `credit_ledger`, `service_usage_events`, `credit_wallet`, `service_pricing` ou `tenant_credit_motor_config`.
- Nenhuma RLS modificada.
- Nenhuma RPC de cobrança alterada.
- Wallet do Respeite o Homem permanece `494/0/6`.
- `motor_v2_enabled=false`, `live_service_keys=[]` permanecem como estavam.

## Próximos passos (Etapa 1B)

1. Criar `src/hooks/useCreditHistory.ts` consumindo a RPC com filtros tipados.
2. Refatorar `src/components/ai-packages/CreditLedgerTable.tsx` para o novo shape (incluindo `operation_status`, `service_key_public`, `creative_product_name`).
3. UI tenant em `/account/billing` e UI admin em `/platform/credits` ficam para Etapa 2.

**Status:** ✅ Etapa 1A entregue e validada. **GO** para Etapa 1B.

---

# Fase A3.2 — Etapa 1B — Hook `useCreditHistory` + componente `CreditHistoryTable` (executada em 2026-05-06)

## Escopo

Conectar o frontend à RPC `get_credit_history` via:

- **Hook novo:** `src/hooks/useCreditHistory.ts`
- **Componente novo:** `src/components/ai-packages/CreditHistoryTable.tsx`

`CreditLedgerTable.tsx` antigo permanece **intacto** — segue acoplado ao shape direto de `credit_ledger` e continua sendo usado por `AIPackages.tsx`. A nova tabela é aditiva.

## Contrato do hook

```ts
useCreditHistory(filters?: CreditHistoryFilters): UseCreditHistoryResult

interface CreditHistoryFilters {
  tenantId?: string;            // default = currentTenant.id
  startDate?: string | null;
  endDate?: string | null;
  transactionType?: CreditTransactionType | null;
  operationStatus?: CreditOperationStatus | null;
  category?: string | null;
  serviceKey?: string | null;
  provider?: string | null;
  jobId?: string | null;
  includePlatform?: boolean;    // forçado false server-side se não-admin
  limit?: number;               // clamp [1..100] no frontend e backend
  offset?: number;              // clamp >=0
}

interface UseCreditHistoryResult {
  data: CreditHistoryItem[];
  totalCount: number;           // extraído de items[0].total_count
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}
```

- React Query com `queryKey` estável incluindo todos os filtros + `tenantId`.
- Tratamento de erro `forbidden` (42501): mensagem genérica "Sem permissão para acessar este extrato.", sem expor detalhes técnicos.
- Demais erros: "Não foi possível carregar o extrato de créditos." (sem stack/detalhe ao tenant).

## Componente `CreditHistoryTable`

- Props: `items`, `isLoading`, `isError`, `totalCount`, `limit`, `offset`, `onPageChange`, `showAdminColumns` (default false).
- Colunas tenant: Data, Tipo (badge PT-BR), Status (label PT-BR), Descrição (preferindo `description` → `creative_product_name` → categoria amigável), Créditos (com sinal/cor), Saldo após.
- Colunas admin extras (somente se `showAdminColumns=true`): Provider, Service key (mono), Custo USD, Venda USD.
- Helpers de label PT-BR para `transaction_type`, `operation_status` e `category` conforme planejado.
- Empty state: "Nenhum movimento no período."
- Loading: skeleton rows.
- Erro: ícone + mensagem genérica.
- Paginação controlada via `onPageChange(newOffset)` quando `totalCount > limit`.
- **Nunca renderiza** `null`/`undefined`/string técnica; campos ausentes viram `—`.

## Validação executada

| Cenário | Resultado |
|---|---|
| Anon sem JWT chamando RPC | ✅ `42501 permission denied` (Etapa 1A) |
| Admin (simulação SQL direta) com `tenant_id=d1a4d0ed-...` retorna 5 linhas, `total_count=5`, sem multiplicação | ✅ (Etapa 1A) |
| Captura -6 créditos da A3.1 presente, `balance_after=494`, vinculada via `capture_ledger_id` | ✅ |
| Build TypeScript após hook + componente | ✅ Sem erros |
| Wallet `credit_wallet` Respeite o Homem | ✅ `494/0/6` inalterado |
| `credit_ledger` count | ✅ 5 inalterado |
| `service_usage_events` | ✅ Inalterado |
| `motor_v2_enabled` / `live_service_keys` | ✅ `false` / `[]` |

**Pendente:** validação visual real ainda não exercida porque a Etapa 1B explicitamente **não cria UI**. O hook será exercido na Etapa 1C ao montar a aba em `/account/billing`. Mascaramento server-side já está provado em 1A, então o tenant comum logado, mesmo invocando a RPC diretamente, recebe `cost_*`, `sell_*`, `markup_pct_snap`, `provider`, `service_key`, `metadata_admin`, `source_function` com valor NULL — sem dependência do frontend.

**Validação admin:** não exercida nesta etapa (sem UI admin ainda). Pendência aberta para Etapa 1D.

## Garantias de não-impacto

- Nenhuma alteração em `CreditLedgerTable.tsx`, `useCredits.ts`, `useCreditOperations`, motor v2, RPC de cobrança, RLS, wallet, ledger, eventos, pricing ou config de motor.
- Nenhum dado financeiro alterado.
- Live continua desligado.
- `mapa-ui.md`, `ux-creditos-lojista.md`, `ux-admin-creditos-custos.md` **não** atualizados (escopo).

## Próximos passos

- **Etapa 1D:** painel admin `/platform/credits` com `showAdminColumns=true`, filtros por tenant e `includePlatform`, atualizar `ux-admin-creditos-custos.md`.

**Status:** ✅ Etapa 1B entregue. **GO** para Etapa 1C.

---

# Fase A3.2 — Etapa 1C — UI tenant "Extrato de Créditos" em `/account/billing` (executada em 2026-05-06)

## Implementação

- `src/pages/account/Billing.tsx` ganhou seção **Extrato de Créditos** logo abaixo de `AIUsageBreakdown`, sem remover nenhum card existente (Plano Atual, AI Usage, Formas de Pagamento, Histórico de Faturamento permanecem intactos).
- Decisão **seção** (não tab): a página atual não usa tabs; manter padrão evita refator visual fora de escopo.
- `CreditBalance.tsx` **não** foi reaproveitado — possui CTA "Comprar Créditos" e badge de saldo baixo que não pertencem a esta entrega. Em vez disso, a seção monta 3 cards locais simples (Disponível, Reservado, Consumido total) consumindo `useCreditWallet` direto.
- Histórico consome `useCreditHistory` + `CreditHistoryTable` (Etapa 1B), com `showAdminColumns=false`.

## Filtros entregues

- Período: 7d / 30d / 90d / Todo o período (default 30d).
- Tipo de transação: todos / capture / reserve / release / refund / purchase / bonus / adjust.
- Paginação simples (limit=25, offset, botões Anterior/Próxima).

**Adiados (follow-up, sem bloquear entrega):**
- Filtro `operation_status` (reserved/captured/released/completed/failed).
- Filtro `category` (ai_image/ai_video/whatsapp/email).
- Filtro `service_key` / `provider` (faz mais sentido no painel admin).

## Privacidade tenant — confirmação

- Tabela tenant nunca renderiza `cost_usd`, `sell_usd`, `markup_pct_snap`, `metadata_admin`, `service_key` cru ou `provider` cru — colunas admin só aparecem com `showAdminColumns=true`, que é `false` na Billing tenant.
- Mascaramento server-side da RPC garante que esses campos vêm `NULL` para tenant comum mesmo se o frontend tentasse exibir.
- Eventos `cost_owner='platform'` e `status='shadow'` são filtrados pela RPC antes de chegar ao hook.
- `CreditHistoryTable` trata valores nulos com `—`, sem renderizar `"null"`/`"undefined"`/JSON técnico.

## Validação

- ✅ TypeScript build passa.
- ✅ `/account/billing` renderiza com a nova seção; cards de saldo, filtros e tabela funcionam.
- ✅ `useCreditHistory` chama `get_credit_history` com `currentTenant.id` (Tenant Identity Guard server-side).
- ⏳ Validação visual final com tenant Respeite o Homem (saldo 494/0/6, captura de 6 créditos da A3.1) depende do usuário logar e abrir `/account/billing`.
- ✅ Wallet, credit_ledger, service_usage_events, motor v2, RPC, pricing e config de motor não foram alterados.
- ✅ Live continua desligado (`live_service_keys=[]`, `motor_v2_enabled=false`).

## Não escopo (mantido)

- Painel admin `/platform/credits` — Etapa 1D.
- Filtros avançados (status/category/service_key) — follow-up.
- Knowledge / mem:// — não criados.

**Status:** ✅ Etapa 1C entregue, pendente de validação visual pelo usuário com Respeite o Homem. **GO** condicional para Etapa 1D.

---

# Fase A3.2 — Etapa 1C.1 — Ajuste de UX pós-validação visual (2026-05-06)

Validação visual em `/account/billing` (tenant Respeite o Homem) confirmou: seção "Extrato de Créditos" exibe 494/0/6, captura de -6 e movimentos de reserva/liberação/ajuste; nenhum campo sensível (`cost_usd`, `sell_usd`, `markup`, `metadata_admin`, `service_key` técnico) é exposto ao tenant; live continua desligado.

Pontos de UX corrigidos nesta sub-etapa (apenas frontend, sem tocar motor/dados/live):

1. **Bloco antigo "Uso de Créditos de IA" (`AIUsageBreakdown`) removido de `/account/billing`.**
   - Motivo: contradizia o novo Extrato de Créditos (mostrava "Nenhum consumo registrado" mesmo com 6 créditos consumidos no extrato), confundindo o lojista.
   - O componente `src/components/billing/AIUsageBreakdown.tsx` permanece no repositório (não deletado) para uso futuro quando for reescrito como detalhamento real por funcionalidade dentro de `/account/credits`.
   - Nenhuma rota/regra de visibilidade nova foi criada — apenas remoção da renderização em `Billing.tsx`.

2. **Descrição das linhas do extrato passou a incluir a categoria amigável.**
   - `CreditHistoryTable.describeItem` agora retorna `"<Categoria> — <detalhe>"` (ex.: `IA Imagem — Fast Upgrade`) em vez de só `"Fast Upgrade"`.
   - Categoria continua vindo do mapeamento `CATEGORY_LABEL` (`ai_image → IA Imagem`, etc.); detalhe usa `description || creative_product_name || feature`.
   - Sem mudança de contrato no hook nem na RPC.

## Validação técnica executada

- ✅ `Billing.tsx` não importa mais `AIUsageBreakdown` (grep confirmado).
- ✅ `CreditHistoryTable.describeItem` cobre os 4 casos: ambos, só detalhe, só categoria, fallback.
- ✅ Wallet, credit_ledger, service_usage_events, RPC `get_credit_history`, pricing e config de motor permanecem intocados.
- ✅ Live continua desligado (`live_service_keys=[]`, `motor_v2_enabled=false`).
- ⏳ Re-validação visual pelo lojista para confirmar que: (a) o bloco antigo sumiu; (b) a captura aparece como `IA Imagem — <detalhe>`.

## Não escopo (mantido)

- Painel admin `/platform/credits` — Etapa 1D.
- Reescrita futura de `AIUsageBreakdown` como detalhamento real — pendência de produto, será tratada quando o hub `/account/credits` for entregue.
- Knowledge / mem:// — não criados.

**Status:** ✅ Etapa 1C.1 entregue, pendente de re-validação visual pelo lojista. **GO** condicional para Etapa 1D.

