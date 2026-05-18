---
name: WhatsApp notification self-send guard + Meta error semantic classification
description: run-notifications precisa bloquear envio para o próprio número da loja antes de chamar a Meta e classificar erros Meta como terminal vs recuperável para não queimar tentativas em falhas definitivas.
type: constraint
---

# Guarda de envio-para-si-mesmo e classificação semântica de erro Meta

## Contexto
Pedido manual aprovado disparou notificações de WhatsApp para o próprio número da loja (test contact que era também o número conectado da Meta). Meta devolveu `#100 Invalid parameter` em todas as 5 tentativas, queimando o ciclo de retentativas e poluindo métricas como falha técnica quando, na verdade, era uma regra de negócio da Meta (`cannot send a message to itself`).

## Regra
1. **Pré-flight self-send**: antes de chamar `graph.facebook.com/.../messages`, comparar `recipient_phone` normalizado (só dígitos, sem código do país duplicado) com `whatsapp_configs.phone_number` do tenant. Se igual:
   - Registrar `whatsapp_messages.status = 'skipped_self_send'`.
   - Retornar erro com prefixo `__TERMINAL__:self_send:<mensagem amigável>`.
   - NUNCA chamar a API da Meta.
2. **Classificação semântica do erro Meta** (`classifyMetaError`):
   - **terminal** (não retentar, fechar como falha imediatamente): self_send, invalid_recipient (#131026), window_24h_expired (#131047), template_paused (#132001/132005/132007/132012/132015), auth_revoked (#190/#200/#10).
   - **recoverable** (manter o ciclo de retentativas com backoff): rate_limit (#4/#80007/#130429/#80004), `unknown` (default), e os históricos #100/#132000 (que já têm retry estrito com sanitização).
3. **Convenção de sinalização entre senders e o loop principal**: erros terminais retornam `error` no formato `__TERMINAL__:<reason>:<userMessage>`. O loop em `run-notifications` faz parse, marca `notifications.status='failed'` mesmo se `attempt_count < max_attempts`, e grava `notification_attempts.error_code = TERMINAL_<REASON>`.
4. **Mensagem ao operador**: timeline e `notification_logs` devem exibir SEMPRE a `userMessage` amigável (sem códigos Meta crus). O código Meta original fica em `metadata.meta_error_code` para auditoria.

## Anti-regressão
- NUNCA reverter a guarda self-send para depois da chamada à API — Meta cobra request e queima tentativa.
- NUNCA tratar erro terminal como recuperável (especialmente self_send, template_paused, auth_revoked).
- NUNCA expor mensagem crua da Meta (ex.: "(#100) Invalid parameter") ao usuário final — usar `classified.userMessage`.
- Se a Meta adicionar novo subcode relevante, atualizar `classifyMetaError` e esta memória no mesmo PR.
- Vale para AMBOS os caminhos: `sendWhatsAppViaMetaTemplate` E `sendWhatsAppViaMeta` (free-form).

## Validação obrigatória pós-mudança
1. Disparar notificação para um destinatário igual ao `phone_number` do tenant → deve registrar `whatsapp_messages.status='skipped_self_send'` sem nenhuma chamada à Graph API e fechar `notifications.status='failed'` na 1ª tentativa.
2. Simular template pausado → fechar como `failed` em 1 tentativa, com `metadata.error_reason='template_paused'`.
3. Simular `#100` genérico → manter retry estrito + entrar no ciclo de backoff até max_attempts.

## Arquivos
- `supabase/functions/run-notifications/index.ts` (`isSelfSend`, `classifyMetaError`, parsing `__TERMINAL__:`)
- Aplica-se tanto a notificações de pedido aprovado (manual ou automático via gateway) quanto a qualquer outra regra de WhatsApp.
