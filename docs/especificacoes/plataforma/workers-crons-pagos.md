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
