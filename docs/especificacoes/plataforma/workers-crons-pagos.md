# Política de Workers, Crons e Filas Pagos — Comando Central

> **Camada:** Layer 2/3 — Especificação de Plataforma  
> **Status:** Ativo (Fase 0)  
> **Última atualização:** 2026-05-04  
> **Fonte de verdade para:** classificação de custos consumidos por workers, crons e filas; herança de `tenant_id`; bloqueio de custos invisíveis.

---

## 1. Princípio fundamental

Nenhum custo externo pode ser consumido sem **classificação explícita**. Toda execução assíncrona (worker, cron, fila) que faça chamada a provedor pago deve declarar:

- `cost_owner = 'tenant'` → débito na carteira do tenant.
- `cost_owner = 'platform'` → custo absorvido pela plataforma, registrado em estrutura separada.

**Custo invisível é proibido.** Função paga sem classificação fica bloqueada para deploy (ver `funcoes-pagas.md`).

## 2. Classificação obrigatória

### 2.1 `tenant_inherited`

Worker/cron carrega `tenant_id` confiável do job de origem (fila, webhook, schedule por tenant).

Requisitos:

1. Job (linha da tabela de fila ou payload do schedule) **deve** carregar `tenant_id NOT NULL`.
2. Worker valida o `tenant_id` antes de chamar provedor.
3. Débito segue o fluxo normal do Motor de Créditos com `cost_owner='tenant'`.
4. Idempotency_key prefixado com `tenant_id` + `job_id`.

Exemplos:
- `ai-snapshot-queue-worker` consumindo IA para gerar snapshot do tenant X.
- `email-dispatcher` enviando campanha agendada do tenant Y.
- `media-process-generation-queue` gerando vídeo solicitado pelo tenant Z.

### 2.2 `platform_absorbed`

Worker/cron roda para a plataforma (não para um tenant específico) ou tem `tenant_id` ambíguo.

Requisitos:

1. Função declara explicitamente que custo é da plataforma.
2. Custo registrado em estrutura separada (decisão estrutural na Fase 1: tabela `platform_cost_ledger` ou `cost_owner='platform'` no `credit_ledger` com `tenant_id NULL` e RLS estrita).
3. **Não** debita carteira de nenhum tenant.
4. **Não** aparece no extrato visível ao tenant.

Exemplos:
- `command-insights-generate` — insights agregados de plataforma.
- `meta-token-health-check` — monitoramento global.
- `platform-costs-sync` — sync de saldos de provedores.
- E-mails de auth/onboarding via `send-auth-email`, `resend-signup-email`.

### 2.3 `bloqueado`

Função paga sem classificação. **Não pode** ser plugada no motor nem deployada após Fase 12. Decisão de produto obrigatória antes.

## 3. Regras estruturais

1. **Filas devem persistir `tenant_id`.** Tabelas de fila como `ai_media_queue`, `ai_snapshot_regen_queue`, `ai_signal_capture_queue` devem ter `tenant_id NOT NULL` em jobs que disparam custo.
2. **Schedule por tenant ≠ schedule global.** Cron que executa por tenant deve receber `tenant_id` como parâmetro e fazer loop por tenant. Cron global é `platform_absorbed`.
3. **Worker que descobre `tenant_id` em runtime** (ex.: a partir de evento) deve abortar e logar incidente se descoberta falhar — nunca seguir e consumir provedor.
4. **Webhook de provedor externo** (ex.: `meta-whatsapp-webhook`, `gateway-webhook`) que dispara processamento pago deve resolver `tenant_id` via lookup determinístico antes de chamar IA/serviço pago.

## 4. Auditoria obrigatória antes da Fase 7

Antes de plugar workers/crons no motor (Fase 7 do roadmap), executar auditoria 1×1 de cada função listada em `funcoes-pagas.md` §3.11:

- [ ] Função tem fonte confiável de `tenant_id`?
- [ ] Se sim, classificar como `tenant_inherited` e validar herança no código.
- [ ] Se não, classificar como `platform_absorbed` e adicionar à lista de custos da plataforma.
- [ ] Se ambíguo, marcar `bloqueado` e levar para decisão de produto.

Resultado da auditoria deve ser registrado em `funcoes-pagas.md` antes do plug.

## 5. Estrutura futura para `cost_owner='platform'`

**Decisão pendente para abertura da Fase 1.** Duas opções:

### Opção A — Coluna no `credit_ledger`

Adicionar `cost_owner text NOT NULL DEFAULT 'tenant'` e permitir `tenant_id NULL` quando `cost_owner='platform'`. RLS impede leitura tenant para linhas `platform`.

**Prós:** uma única tabela de ledger.  
**Contras:** quebra invariante atual (`tenant_id NOT NULL`), exige migration cuidadosa.

### Opção B — Tabela separada `platform_cost_ledger`

Estrutura espelhada sem `tenant_id`. Visível apenas para platform_admin.

**Prós:** isolamento total, ledger tenant continua tenant-only.  
**Contras:** duplicação de schema, dois lugares para query global.

**Recomendação técnica (sujeita a aprovação):** **Opção B** — evita risco de vazamento por RLS mal configurada e mantém a invariante `tenant_id NOT NULL` no ledger atual.

## 6. Regras anti-vazamento

1. RLS do `credit_ledger` **nunca** retorna linha sem `tenant_id` para usuário tenant.
2. Queries do extrato do tenant (`/account/credits`) **nunca** retornam custos `platform`.
3. Relatórios admin têm view dedicada que une ambas as fontes para visão consolidada.
4. Auditoria periódica: `SELECT count(*) FROM credit_ledger WHERE tenant_id IS NULL` deve sempre retornar 0 (se Opção A for adotada, regra muda para "tenant_id NULL ⟺ cost_owner='platform'").

## 7. Documentos relacionados

- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`

---

## 8. Cron de reservas órfãs v2 (Fase 2A)

### 8.1 Edge function

- **Nome:** `credits-release-orphan-reservations`
- **Agendamento:** a cada 15 minutos (`pg_cron` job `credits-release-orphan-reservations-15m`).
- **Acesso:** invocada pelo cron via `service_role`.

### 8.2 Critérios de identificação de reserva órfã

Uma linha de `credit_ledger` é considerada reserva órfã quando **todas** as condições abaixo são verdadeiras:

1. `transaction_type = 'reserve'`.
2. `metadata->>'motor_version' = 'v2'`.
3. `reservation_expires_at < now()` **OU** (`reservation_expires_at IS NULL` E `created_at < now() - interval '30 minutes'`).
4. **Não existe** linha em `credit_ledger` com `reference_ledger_id = <id da reserva>` e `transaction_type IN ('capture','release')`.
5. **Não existe** registro em `service_usage_events` com `reservation_ledger_id = <id da reserva>` e `status = 'in_progress'` atualizado nos últimos 30 minutos.

### 8.3 Regras críticas (anti-regressão)

- O cron **nunca** toca reservas v1. Filtro `metadata->>'motor_version' = 'v2'` é obrigatório em toda query.
- O cron **nunca** usa apenas `transaction_type = 'reserve'` como critério.
- O cron **nunca** opera em reservas sem `metadata.motor_version = 'v2'`.
- O cron **nunca** chama provedor externo. Ele apenas libera crédito reservado.

### 8.4 Ação executada

- Chama `release_reservation(reservation_id, reason='orphan_auto_release', metadata={...})` via helper universal.
- Linha de `release` resultante carrega `reference_ledger_id` apontando para a reserva original.
- `service_usage_events` correspondente é atualizado para refletir liberação.
- Volume anormal (`released > 10` em uma execução) gera log de alerta para revisão admin.

### 8.5 Validação esperada

- Reserva v2 fake com `reservation_expires_at` no passado deve ser liberada na próxima execução.
- Reserva v1 (sem `metadata.motor_version='v2'`) deve ser ignorada, mesmo que tenha mesma idade.
- Reserva v2 com `service_usage_events.status='in_progress'` recente deve ser ignorada.

### 8.6 Documentos relacionados

- `docs/especificacoes/plataforma/motor-creditos.md` §14.4, §14.9
- `docs/especificacoes/plataforma/funcoes-pagas.md`

---

## 9. Cron `weekly-command-insights` (Insights da Central de Comando)

### 9.1 Identidade

| Campo | Valor |
|-------|-------|
| **Nome canônico do job** | `weekly-command-insights` |
| **Schedule** | `0 11 * * 1` (segunda-feira 08:00 BRT / 11:00 UTC) |
| **Edge function chamada** | `command-insights-generate` (POST, body `{}`) |
| **Classificação** | `platform_absorbed` (custo registrado em `platform_cost_ledger` via `recordPlatformCost`) |
| **Cobertura** | Todos os tenants ativos (até 200 por execução) |

### 9.2 Padrão de autenticação

A edge `command-insights-generate` aceita modo cron (lote de tenants) **somente** quando o header `Authorization` carrega o **service_role** do projeto:

```
if (authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) { /* modo cron */ }
```

Com chave anon a edge cai no ramo "manual" e devolve `401 Não autorizado`. O `pg_cron`/`net.http_post` não enxerga esse 401 (a request é aceita pelo gateway), o que produz **falha silenciosa**.

> **Padrão obrigatório:** o cron deve enviar `Authorization: Bearer <service_role>`. O segredo **não** pode ser commitado em migration versionada nem exposto em logs. Quando o projeto adotar Vault para `service_role`, este job deve passar a ler via `current_setting('app.settings.service_role_key', true)` ou equivalente. **Hoje (2026-05) não há padrão seguro confirmado** para service_role em cron deste projeto — pendência bloqueante registrada na Onda 1.

### 9.3 Onda 1.5 (2026-05-12) — corrigida e documentada

- **Job antigo removido:** `generate-weekly-insights` (jobid 22, header com chave anon → 401 silencioso) foi desagendado.
- **Job canônico ativo:** `weekly-command-insights` (jobid 56), schedule `0 11 * * 1`, alvo `command-insights-generate`, header `Authorization: Bearer ***MASKED***` carregando o `SUPABASE_SERVICE_ROLE_KEY` operacional.
- **Caminho técnico de correção:** edge bootstrap temporária `bootstrap-insights-cron` + RPC temporária `public._bootstrap_reschedule_cron` (SECURITY DEFINER restrita a `service_role`) executaram o `cron.unschedule`/`cron.schedule` em uma única invocação. **Ambos os artefatos temporários já foram removidos** (arquivo deletado e `DROP FUNCTION` aplicado por migration). Nenhuma rota, função ou RPC temporária permanece ativa.
- **Motivo da abordagem:** Lovable Cloud não expõe o `service_role` ao operador e este projeto **não possui Vault, helper ou GUC seguro** para injetar o segredo no `cron.job.command`. A bootstrap one-shot foi a única forma de gravar o Bearer correto sem versionar o segredo em migration nem expor no chat.

### 9.4 Regras de segurança (permanentes)

- O `SUPABASE_SERVICE_ROLE_KEY` **nunca** pode ser versionado em migration, código, comentário, doc ou log.
- Qualquer exibição operacional do `cron.job.command` deve mascarar o token: `Bearer ***MASKED***`.
- É proibido recriar `bootstrap-insights-cron` ou `_bootstrap_reschedule_cron` fora de uma nova janela de correção autorizada.

### 9.5 Risco remanescente

- **Rotação do `SUPABASE_SERVICE_ROLE_KEY`:** o Bearer está embutido em `cron.job.command`. Se a chave for rotacionada, o cron passa a devolver 401 silencioso. Mitigação: reagendar o job (nova janela bootstrap one-shot) imediatamente após qualquer rotação. Mitigação estrutural futura: migrar `command-insights-generate` para o padrão "anon hardcoded + validação interna" (ver `mem://constraints/cron-service-role-key-guc-prohibition`) e remover a dependência do service_role no header do cron.

### 9.6 Validação desta onda

- Auditoria final read-only (2026-05-12): `generate-weekly-insights` ausente; `weekly-command-insights` ativo com schedule e alvo corretos; header sem chave anon; bootstrap e RPC temporárias confirmadas como inexistentes.
- **Smoke real não executado** nesta etapa: `command-insights-generate` não possui modo confirmado sem efeito colateral (escreve em `command_insights` e em `platform_cost_ledger`). A primeira execução real ocorrerá na próxima segunda-feira 11:00 UTC ou em janela de smoke autorizada explicitamente.

### 9.7 Critérios de aceite (em aberto, dependem de execução real)

- [ ] Execução real (cron ou curl autorizado) retorna `success: true` ou justificativa sem erro silencioso.
- [ ] `command_insights` recebe nova linha quando há tenant elegível.
- [ ] `platform_cost_ledger` recebe linha com `service_key='command-insights-generate'` quando o LLM é efetivamente chamado.
- [ ] Logs do edge não mostram `Não autorizado` em execuções do cron.

