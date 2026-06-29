## Revisão do diagnóstico

### Pedido #658 — Alexandre Araúna
- NF nº 442 **autorizada na SEFAZ em 27/06 13:30** (chave + protocolo gravados em `fiscal_invoice_events`).
- O side-effect de e-mail **rodou com sucesso** logo depois (`event_type=email_sent` às 13:30:43).
- Mas o `UPDATE fiscal_invoices SET status='authorized', chave_acesso, focus_ref...` **nunca persistiu**: linha segue `draft` / `pronta_emitir` / sem chave.
- A regra `fiscal-emit-persist-authorized-before-side-effects` (v2026-06-11) já cobre `fiscal-emit`. Como o e-mail rodou e o UPDATE não, o caminho que autorizou **não foi o `fiscal-emit`** ou um caminho paralelo (`fiscal-check-status` polling, `fiscal-webhook` da Focus) registrou o evento sem aplicar a mesma ordem segura. **Os logs já expiraram (2 dias)** — confirmação exata virá auditando os arquivos.
- Reconciliador `fiscal-reconcile-authorized` das 8h–16h **não cobriu** este caso: a query atual provavelmente filtra por `status=authorized AND chave_acesso IS NULL`, não por "evento authorized presente + linha draft".

### Mercado Livre — Respeite o Homem
- Token OAuth **expirou em 29/06 05:05 UTC**. Webhooks chegam (último 19:46) mas qualquer chamada à API ML retorna 401 e o sync aborta. Sem refresh proativo.
- Cancelamentos dos #662/#663 e o novo pedido **não foram processados**.
- Mesmo com token recuperado, o sync atual **vai falhar ao cancelar** os #662/#663 porque o trigger `trg_guard_order_cancellation_metadata` exige `cancelled_at` + `cancellation_reason` na mesma UPDATE — regra rígida do banco (`mem://constraints/order-cancellation-requires-metadata-guard`). O adapter ML precisa preencher esses campos.

## Onda 1 — Persistência fiscal universal (raiz do #658)

1. **Estender a regra "persistir antes dos side-effects" a TODOS os caminhos** que recebem resposta de autorização da Focus: `fiscal-emit`, `fiscal-submit`, `fiscal-check-status`, `fiscal-webhook`. Extrair a função `applyAuthorizationResult(invoice_id, focusResponse)` em `supabase/functions/_shared/fiscal/applyAuthorization.ts` (responsável por: UPDATE da linha → `event=authorized` → enfileirar side-effects). Os 4 caminhos passam a chamar exclusivamente esse helper. Side-effects (e-mail, WMS, link-remessa) ficam em `try/catch` individual e nunca bloqueiam.

2. **Reconciliador `fiscal-reconcile-authorized` ampliado** para o cenário real do #658: detecta linhas `fiscal_invoices.status='draft'` cujos `fiscal_invoice_events` já têm `event_type='authorized'` com `event_data->>'focus_response'->>'status'='autorizado'`. Quando detecta, reaplica `applyAuthorizationResult()` a partir do `event_data` — sem rechamar a SEFAZ. Mantém o cron 8h–16h existente.

3. **Auditoria pós-deploy** (uma vez): rodar o reconciliador ampliado contra todo o tenant `respeite-o-homem` para cobrir órfãos legados além do #658.

## Onda 2 — Token ML resiliente (raiz do "pedidos não entram")

1. **Helper compartilhado `getValidMeliToken(tenant_id)`** em `supabase/functions/_shared/meli/token.ts`. Refaz refresh se `expires_at - now() < 10 min`. Lock via `pg_try_advisory_xact_lock(hashtext(tenant_id||'meli-refresh'))` para evitar refresh concorrente. Atualiza `marketplace_connections.last_error` em falha. Todas as edge functions ML (`meli-sync-orders`, `meli-fetch-shipment`, `meli-send-invoice`, `meli-resolve-attributes`, `meli-publish-listing`, `meli-fetch-listing`) passam a chamar esse helper antes de qualquer fetch ML.

2. **Cron `meli-refresh-tokens`** a cada 30 min: refresca toda conexão `is_active=true` com `expires_at < now() + 1h`. Se o refresh token expirar/falhar, grava `last_error` e cria notificação na Central de Execuções com texto "Conexão Mercado Livre expirou — reconectar".

3. **`meli-webhook` à prova de token expirado**: hoje já existe; garantir que sempre grava o payload em `events_inbox` antes de tentar processar e que a falha de processamento não devolve 5xx pro ML (já é 200, mas o evento precisa ficar enfileirado para reprocesso). Cron `meli-reconcile-orders` (já existente, validar frequência ≤15 min) drena `events_inbox` pendentes.

4. **Adapter de cancelamento ML compatível com o guard do banco**: ao detectar pedido cancelado no ML, o sync monta o UPDATE com `status='cancelled'`, `cancelled_at = ml.date_closed || now()`, `cancellation_reason = 'Cancelado no Mercado Livre: ' || ml.cancel_detail.description` (PT-BR) na mesma operação. Depois chama `order-regression-handler` (já idempotente) para marcar `requires_action=true` na NF autorizada do #662 e nos envios pendentes.

## Onda 3 — Backfill seguro

1. **#658**: rodar o reconciliador ampliado → NF 442 vira `authorized` com chave/protocolo/XML/DANFE do evento. Sem reenvio de e-mail (já foi). Validar consistência `orders.status` = `fiscal_invoices.status`.
2. **ML — Respeite o Homem**: refresh manual do token, depois `meli-sync-orders` em modo backfill 7 dias. Resultado esperado: novo pedido importado com PV; #662/#663 cancelados via novo adapter, com `requires_action=true` nas NFs/envios e banner de regressão visível em `OrderDetail`.
3. Conferir: sem cliente duplicado, sem alteração em NFs autorizadas (cancelamento de NF segue sendo ação humana).

## Onda 4 — Anti-regressão

- Atualizar `mem://constraints/fiscal-emit-persist-authorized-before-side-effects` cobrindo explicitamente os 4 caminhos e o reconciliador como rede de segurança.
- Nova memory `mem://constraints/marketplace-token-proactive-refresh`: toda função que chama API de marketplace DEVE usar helper de token com refresh < 10 min; cron de refresh < 1h; webhook enfileira em `events_inbox` mesmo em falha.
- Nova memory `mem://constraints/marketplace-cancellation-must-fill-metadata`: adapter de marketplace que sincroniza cancelamento DEVE preencher `cancelled_at` + `cancellation_reason` no mesmo UPDATE (cumprindo `order-cancellation-requires-metadata-guard`).
- Atualizar `docs/especificacoes/erp/erp-fiscal.md` (§ Persistência transacional + reconciliador), `docs/especificacoes/marketplaces/mercado-livre.md` (§ Resiliência de token + cancelamento) e `docs/especificacoes/transversais/assuntos-em-andamento.md`.

## Validação técnica obrigatória

```text
SELECT status, chave_acesso FROM fiscal_invoices WHERE numero=442
  AND source_order_invoice_id IS NOT NULL;  -- esperar: authorized + chave
SELECT expires_at FROM marketplace_connections
  WHERE tenant_id=(tenant respeite-o-homem);  -- esperar: > now()+5h
SELECT order_number, status, cancelled_at, cancellation_reason
  FROM orders WHERE order_number IN ('#662','#663');  -- esperar: cancelled + metadata
SELECT order_number FROM orders WHERE marketplace_source='mercadolivre'
  AND created_at > now()-interval '2 day';  -- esperar: novo pedido presente
```
Logs de `meli-sync-orders` sem 401; banners de regressão visíveis nos pedidos cancelados.

## Fora de escopo / decisões

- **Sem mudança de UI** além do texto/cor dos badges e banners já existentes (regressão e status de conexão ML).
- **Cancelamento automático de NF autorizada continua proibido** — ação humana via `fiscal-cancel`. Marketplace só sinaliza `requires_action=true`.
- Helper de token fica preparado para outros marketplaces mas só ML usa nesta entrega.
- Não vou tocar em `fiscal-cancel`, fluxo de devolução nem cron de expiração.

## Dúvida que preciso confirmar com você

Para o **novo pedido do ML** que entrou depois do cancelamento: importo automaticamente no backfill ou prefere validar caso a caso antes? Minha recomendação é importar automaticamente — é o mesmo fluxo dos #662/#663 e deixar manual cria risco de perder pedido real.
