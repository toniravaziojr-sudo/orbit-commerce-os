
# Correção estrutural do fluxo de notificações por template + filtro "Não lidos" + docs

## Diagnóstico fechado (o que de fato está acontecendo)

O fluxo é: `evento → process-events → notifications (fila) → run-notifications → canal real (WhatsApp/Email) + timeline em /support`.

Hoje existem **três falhas convivendo**, e nenhuma é "regressão de hoje":

1. **Origem do payload incompleta.** `process-events` monta as variáveis do template lendo `payload.product_names` e `payload.store_name` direto do evento `order.paid`. Esses dois campos não vêm no evento — então sempre saem vazios. Resultado: template parcial ("Produto:" em branco e "A   agradece a compra") desde 22/04.
2. **Saldo SendGrid esgotado.** Todos os envios de e-mail estão `failed` com `401 Maximum credits exceeded`. É erro de provedor, não de pipeline — mas o pipeline trata como falha permanente e fica calado.
3. **Timeline com conteúdo cru no histórico antigo.** Mensagens anteriores a 21/04 (legacy, antes do Phase 3 do `template-renderer`) foram gravadas em `messages.content` com `[Template: ...] {{customer_first_name}}…` literais. O Phase 3 já bloqueia novos casos, mas o que ficou no banco continua visível no /support — é o que você viu no print.

A pergunta "estava funcionando até ontem" não se sustenta nos dados: as 28 notificações de `pagamento_aprovado` desde 22/04 estão todas como `failed` (3/3 tentativas), com erro idêntico. O sintoma é antigo; só não estava sendo percebido porque a UI não destaca falhas.

## Princípio da correção (não-pontual)

Em vez de só "preencher product_names no order.paid", vamos **fechar o contrato em três camadas** para que nenhuma notificação por template possa nunca mais sair (ou aparecer) incompleta:

- **Camada 1 — Origem garantida:** `process-events` enriquece o payload de qualquer regra com pedido/cliente/loja a partir do banco, com fallbacks determinísticos. Nunca confia só no que veio no evento.
- **Camada 2 — Render strict universal:** o `template-renderer` fica em modo `strict` para todo template, e qualquer variável referenciada é resolvida (ou explicitamente declarada opcional). Nada sai com `{{ }}` cru e nada sai com `[Template:]`.
- **Camada 3 — Timeline limpa:** o /support nunca exibe `messages.content` cru. Há um sanitizador na bolha de mensagem; o backfill do histórico legado também é feito.

Sobre saldo SendGrid: vira **alerta operacional explícito** (badge no Notifications + insight na Central de Comando), não erro silencioso na fila.

## Mudanças por área

### 1. `process-events` — enriquecimento determinístico do payload (Camada 1)

Antes de montar `templateVars`, para qualquer regra que tenha `order_id` resolvido, fazer um único `enrichOrderContext(orderId, tenantId)` que devolve um bloco normalizado com:

- `store_name` ← `tenants.name` (ou `tenants.slug` como fallback) — já consultamos `tenants` para `storeUrl`, vai junto.
- `product_names` ← agregação de `order_items` no formato `"Produto A (2x), Produto B (1x)"`.
- `customer_first_name` ← derivado de `customers.full_name` quando `payload.customer_name` for vazio.
- `order_number`, `order_total` ← garantia de fallback em `orders` se faltar no payload.

Para `abandoned_checkout` e `post_sale`, o mesmo helper roda com a entidade correspondente (sessão / cliente). Variáveis sem fonte conhecida ficam declaradas como **opcionais explícitas** no template, não vazias por acidente.

Bloco final: `templateVars = { ...payloadVars, ...enrichedVars }` — enriquecido sempre vence o payload cru.

### 2. `_shared/template-renderer.ts` — contrato strict universal (Camada 2)

- Modo `strict` passa a ser default em todo render de notificação.
- Cada `notification_rules` ganha (em runtime, não em schema) uma lista derivada de variáveis **opcionais conhecidas** (ex.: `tracking_url` em `payment_approved`); o resto é obrigatório.
- Render falha → marca `notifications.status='blocked_render'` (status novo, distinto de `failed`) com `last_error` claro listando as variáveis que faltaram, e **não conta como retry consumido**. Operador vê o motivo na UI.
- Mantém o `assertNoPlaceholders` final (já existe). Se mesmo assim algo passar, nunca chega ao canal nem à timeline — é registrado como evento interno.

### 3. `run-notifications` — disciplina de erro e canal (Camada 2 + saúde)

- Erro de provedor distinguido do erro de render: `provider_error` vs `render_blocked` em `notifications.last_error_kind`. Retry só faz sentido para `provider_error` transitório.
- SendGrid 401 "Maximum credits exceeded" → marca tenant em `tenant_health` com `email_provider_credits_exhausted=true`, dispara um único insight no Central de Comando, e **não retenta** (poupa fila).
- WhatsApp template não aprovado ainda → marca `awaiting_template_approval` em vez de `failed`, sem queimar tentativa (alinha com o cron horário de `whatsapp-check-templates`).

### 4. Timeline do /support — nada cru (Camada 3)

- Componente da bolha de mensagem em `/support` passa a usar um helper `sanitizeForDisplay(content)` que: detecta `[Template: ...]` e `{{ }}` em `messages.content`, e substitui por evento interno cinza "Notificação enviada (conteúdo legado oculto — ver detalhes)" com link para abrir o JSON em modal técnico (mesma camada usada hoje para "Notificação não enviada").
- Backfill único: marcar todas as `messages` do tenant que casem o padrão legado com `metadata.legacy_template_leak=true` (não apaga o conteúdo, só sinaliza para a UI esconder).
- O contrato `messages.content` para futuras notificações já é o `renderedVisibleText` final (`run-notifications` v1.5.0 faz isto). Nada novo entra cru.

### 5. Filtro "Não lidos" no Atendimento

- Em `src/lib/support-queues.ts`: nova função `hasUnread(c)` baseada em `conversations.unread_count > 0`.
- Em `src/components/support/ConversationList.tsx`: adicionar **toggle** "Não lidos" (chip ao lado do filtro de canal, não uma 4ª aba — preserva as 3 filas oficiais). Quando ativo, filtra a lista atual por `unread_count > 0`. Persistir preferência em `localStorage` por tenant.
- Badge de contagem no toggle.

### 6. Observabilidade e dashboards

- Painel novo em `/notifications` (aba Saúde): contagem de `notifications` por status nos últimos 7 dias (`sent / failed / blocked_render / awaiting_template_approval`), com drill-down por regra.
- Insight automático na Central de Comando quando: (a) saldo SendGrid esgotado, (b) >5 `blocked_render` da mesma regra em 24h, (c) template WhatsApp em `pending` há >24h.

### 7. Documentação (obrigatória — atualização na mesma entrega)

- `docs/especificacoes/crm/crm-atendimento.md`: nova seção **"Pipeline de Notificações — Contrato de Render (v8.3.0)"** com as 3 camadas, status `blocked_render` e `awaiting_template_approval`, lista oficial de variáveis garantidas e opcionais por `rule_type`.
- `docs/especificacoes/transversais/mapa-ui.md`: registrar o filtro "Não lidos" em `/support` e a aba Saúde em `/notifications`.
- `mem://constraints/notification-template-render-contract` (novo): regra anti-regressão proibindo (a) leitura direta de `payload.product_names`/`payload.store_name` em qualquer caller, (b) gravação de `messages.content` com `[Template:]` ou `{{ }}`, (c) novo render fora de strict mode.
- `mem://index.md`: indexar a nova constraint.

## Validação técnica obrigatória antes de declarar fechado

Após implementar, executo nesta ordem (e te entrego o resultado):

1. Inserir um evento `order.paid` simulado para `respeiteohomem` (script idempotente).
2. Confirmar em `notifications`: `status='sent'`, `last_error=null`, `attempt_count=1`.
3. Confirmar em `notification_logs`: `content_preview` com `Produto: X (2x)` e `A Respeite o Homem agradece`.
4. Confirmar em `messages`: nova linha sem `[Template:]` e sem `{{ }}`, exibida limpa no /support.
5. Forçar uma regra com variável obrigatória ausente → deve marcar `blocked_render`, não consumir tentativa, gerar evento interno na timeline.
6. Validar que a aba "Não lidos" filtra corretamente uma conversa com `unread_count>0`.

## Arquivos que serão tocados

```text
supabase/functions/process-events/index.ts             [enriquecimento + helper]
supabase/functions/_shared/template-renderer.ts        [strict universal + opcionais]
supabase/functions/_shared/enrich-order-context.ts     [novo helper compartilhado]
supabase/functions/run-notifications/index.ts          [classificar erro, não retentar 401]
src/components/support/ConversationList.tsx            [filtro "Não lidos"]
src/components/support/MessageBubble.tsx (ou equiv.)   [sanitizeForDisplay]
src/lib/support-queues.ts                              [hasUnread]
src/lib/sanitizeNotificationContent.ts                 [novo]
src/pages/Notifications.tsx                            [aba Saúde]
docs/especificacoes/crm/crm-atendimento.md
docs/especificacoes/transversais/mapa-ui.md
.lovable/memory/constraints/notification-template-render-contract.md (novo)
.lovable/memory/index.md
```

## O que eu vou poder afirmar tecnicamente no fim

Após a validação técnica acima passar, vou afirmar que o fluxo está **sólido, seguro e à prova de erros nos seguintes termos**:

- Nenhuma notificação por template pode sair com variável vazia (Camada 2 bloqueia).
- Nenhum conteúdo cru pode chegar à timeline do atendente nem ao cliente (Camada 1 evita, Camada 2 bloqueia, Camada 3 limpa o legado).
- Falhas de provedor (SendGrid sem saldo, template WhatsApp não aprovado) viram alertas operacionais, não erros silenciosos.
- Atendente vê exatamente o que o cliente vê, sempre.
- O filtro "Não lidos" usa a fonte de verdade `unread_count` que já é mantida pelos triggers.

O que **não** posso garantir só com código: que o saldo SendGrid esteja recarregado e que os templates WhatsApp estejam aprovados — isso é operacional. Mas o sistema avisa quando não está.
