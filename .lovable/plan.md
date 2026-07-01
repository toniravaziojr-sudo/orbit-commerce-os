## Objetivo

Nenhuma integração externa (Mercado Livre, Meta, Google, Correios, gateways…) pode ser desativada pelo nosso sistema por erro **temporário** do provedor. Hoje o ML foi desativado internamente porque o nosso código interpretou "espera um pouco" (HTTP 429) como "acabou". Isso é bug estrutural, não regra do ML.

O plano tem duas partes: **(A) padrão transversal** com regra oficial + helper compartilhado, e **(B) aplicação imediata no Mercado Livre**, incluindo reativar o tenant afetado e reingerir o pedido perdido.

Aproveitamento importante da revisão: `meli-sync-orders`, `meli-orders-reconcile` e os crons já existem — o problema real é que **todos filtram `is_active=true`**, então quando o refresh derrubou a conexão às 11h, o fallback também ficou cego. Não vou criar cron novo nem função nova; vou corrigir os filtros e o classificador de erro.

---

## Parte A — Padrão "Conexão Externa Sólida"

### A1. Regra oficial nova (transversal)

Adicionar como **seção 8** de `docs/especificacoes/transversais/padroes-operacionais.md`: **"Resiliência de Conexões Externas"**. Referência cruzada em `docs/REGRAS-DO-SISTEMA.md`. Espelhar como Core memory `mem://constraints/external-connection-resilience` no `mem://index.md`.

Texto da regra:

> Uma conexão com sistema externo (Mercado Livre, Meta, Google, Correios, gateways) **só pode ser marcada como inativa em dois casos**:
> 1. O provedor respondeu explicitamente que o vínculo foi revogado / o refresh token é inválido (`invalid_grant`, `invalid_token`, `revoked_token`, `unauthorized_client`).
> 2. O lojista pediu para desconectar no painel.
>
> Qualquer outro erro — HTTP 429, 5xx, timeout, falha de rede, `internal_error` do provedor — é **transitório**. Neste caso o sistema deve: manter a conexão ativa, incrementar contador de falhas, agendar retry com backoff e registrar o incidente. Nunca desativar.

### A2. Helper compartilhado único

Criar `supabase/functions/_shared/external-connection-health.ts` com:

- `classifyProviderError(status, body) → 'fatal' | 'transient'` — dicionário centralizado das mensagens fatais conhecidas por provedor.
- `computeNextRetry(consecutiveFailures) → Date` — backoff exponencial 1m→5m→15m→1h→6h→24h (teto).
- `markSuccess(supabase, table, id)` — zera contador, atualiza `last_success_at`, marca `health_status='healthy'`.
- `markTransientFailure(supabase, table, id, reason)` — incrementa contador, agenda `next_retry_at`, marca `health_status='degraded'` (mantém `is_active=true`).
- `markFatal(supabase, table, id, reason)` — marca `is_active=false`, `health_status='needs_reauth'`, grava causa.

Provider-agnostic — mesmo helper serve Meta, Google, gateways etc. nas próximas ondas (aplicação neles fica **fora** deste plano).

### A3. Migration mínima em `marketplace_connections`

Adicionar (todas idempotentes, defaults seguros para não regredir):
- `consecutive_failures int not null default 0`
- `next_retry_at timestamptz`
- `last_success_at timestamptz`
- `health_status text not null default 'healthy'` (CHECK `in ('healthy','degraded','needs_reauth')`)
- índice em `(marketplace, health_status, next_retry_at)`

Sem GRANT novo (tabela já tem policies). Sem impacto em quem lê hoje — colunas novas ignoráveis.

### A4. Observabilidade

- Toda transição de estado escreve em `marketplace_sync_logs` (hoje vazio — bug). Tipos: `token_refresh`, `webhook_receive`, `orders_sync`.
- Ao atingir `consecutive_failures >= 5` **ou** entrar em `needs_reauth`: registrar em `ai_critical_alerts` (sistema já existe) para o painel mostrar o aviso ao lojista. **Sem criar UI nova** — usa o pipeline de alertas atual.

---

## Parte B — Aplicação imediata no Mercado Livre

### B1. Refactor `meli-token-refresh`
- Usar `classifyProviderError` na resposta do ML.
- Fatal (`invalid_grant` etc.) → `markFatal`.
- Transiente (429, 5xx, timeout) → `markTransientFailure`, **mantém `is_active=true`**.
- Sucesso → `markSuccess`.

### B2. Refactor `meli-webhook`
- Remover filtro `is_active=true` da busca da conexão.
- Se conexão em `needs_reauth`: enfileirar em `events_inbox` (tabela existente) para reprocesso pós-reconexão. Responder 200 pro ML normalmente.
- Se token expirado mas conexão saudável: chamar refresh sob demanda antes de processar. Registrar em `marketplace_sync_logs`.

### B3. Refactor `meli-orders-reconcile` + `meli-sync-orders`
- Remover filtro `is_active=true` nos dois; considerar `health_status != 'needs_reauth'`.
- Registrar cada execução em `marketplace_sync_logs`.
- Auditar chamada do cron `meli-token-refresh-30min` (nos logs só rodou 1x em 24h — provavelmente falta `refreshAll: true` no body). Corrigir SQL do cron via `insert tool`.
- Redeploy `meli-orders-reconcile` (chamada de hoje retornou 404).

### B4. Reativar Respeite o Homem + reingerir pedido perdido
- `UPDATE marketplace_connections SET is_active=true, health_status='healthy', consecutive_failures=0, last_error=null WHERE id='91cb152c-...'` (refresh token ainda vale — a rejeição era rate-limit).
- Invocar `meli-token-refresh` manualmente para gerar access token novo.
- Invocar `meli-sync-orders` no range das últimas 24h. O pedido `2000017192996616` entra pelo fluxo normal (order → fiscal → logística → etiqueta). Sem SQL manual em `orders`.

### B5. Fechar tema no doc do ML
Atualizar `docs/especificacoes/marketplaces/mercado-livre.md` seção de conexão: registrar o novo comportamento (classificação de erro, backoff, `health_status`) e referenciar a seção 8 dos padrões operacionais.

---

## Escopo — o que fica DE FORA

- Refatorar Meta, Google, gateways, Correios, Pratika para usar o helper novo → onda seguinte. O helper nasce provider-agnostic, mas hoje só o ML consome.
- Central de "Conexões Externas" no painel → não pedido. Vamos reusar o `ai_critical_alerts` já existente para avisar o lojista quando `needs_reauth`. Se você quiser uma tela dedicada depois, abrimos plano separado.
- Reprocessar retroativamente webhooks descartados antes desta correção (só o pedido de hoje é conhecido — os outros já teriam sido pegos pelo reconcile após B4).

---

## Riscos e mitigação

- **Regressão do fluxo consolidado de webhook**: mitigada porque a única mudança semântica é "não descartar quando `is_active=false`". Sucesso 200 continua sendo devolvido ao ML como hoje.
- **Retry cauda-longa sobrecarregar o ML**: mitigado pelo backoff exponencial e teto de 24h.
- **Migration em tabela viva**: colunas novas com default seguro e nullable — nenhum código atual quebra.
- **Doc + memória de governança**: seção 8 do padrão + Core memory → futuros agentes obrigados a seguir.

---

## Detalhes técnicos (apêndice)

- **Migration**: 1 arquivo, altera `marketplace_connections`. Sem GRANT novo.
- **Novo shared**: `supabase/functions/_shared/external-connection-health.ts`.
- **Edge functions refatoradas**: `meli-token-refresh`, `meli-webhook`, `meli-orders-reconcile`, `meli-sync-orders`.
- **Crons**: nenhum novo. Correção do body do `meli-token-refresh-30min` via `insert tool`.
- **Docs**: `padroes-operacionais.md` (seção 8), `REGRAS-DO-SISTEMA.md` (referência), `mercado-livre.md` (aplicação), `assuntos-em-andamento.md` (fechar tema).
- **Memória**: criar `mem://constraints/external-connection-resilience` + linha Core no `mem://index.md`.
- **Validação técnica pós-execução (obrigatória)**: (a) rodar refresh manual e confirmar `expires_at` novo; (b) simular resposta 429 com fixture e confirmar que `is_active` permanece `true`; (c) confirmar pedido `2000017192996616` presente em `orders`; (d) checar linha nova em `marketplace_sync_logs`.

---

Duas dúvidas antes de eu executar:

1. **Alerta ao lojista quando `needs_reauth`**: OK reusar `ai_critical_alerts` (canal já existente) ou você quer um banner novo dedicado no módulo do ML? A opção "reusar" é mais leve e evita mudança de UI.
2. **Reingestão do pedido perdido**: OK deixar o próprio `meli-sync-orders` trazer via fluxo natural (recomendado — nada de SQL manual em `orders`)?

Se as duas forem "sim", executo tudo em uma passada.
