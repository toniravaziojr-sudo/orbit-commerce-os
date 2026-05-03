---
name: Turn Orchestrator Early-Return Contract (Reg #2.13 Fase C)
description: Todo early-return de ai-support-chat sob orquestrador deve passar pelo helper finalizeOrchestratedTurn com outcome send/no_send/abort
type: constraint
---

Em chamada orquestrada (`logical_turn_id` + `claim_token` no body), NENHUM ramo do `ai-support-chat` pode retornar sem encerrar o buffer. É proibido deixar bot message com `delivery_status='queued'` sem chamar envio + `complete_turn`/`fail_turn`. Watchdog reprocessa até `dead` (incidente real 03/05/2026, conversa `ab3d720d`, 5 attempts).

**Helper único:** `finalizeOrchestratedTurn({outcome, botMessageId?, botContent?, kind?, reason?, conversationRef?})`. 3 outcomes:

- **send** — INSERT bot já feito; helper envia (meta-whatsapp-send / chat / email) e roda complete_turn no sucesso ou fail_turn na falha. Idempotência por índice único `messages_unique_bot_per_logical_turn`.
- **no_send** — sem mensagem ao cliente, mas turno resolvido. `complete_turn(bot_message_id=null)`. Casos: `processing_lock_alive`, `media_pending_already_notified`.
- **abort** — estado terminal sem retry. `complete_turn(null)` (não `fail_turn`, que recoloca em `send_failed` e o watchdog reprocessa). Casos: `handoff_terminal_lock`.

**Early-returns cobertos:** `handoff_terminal_lock` (abort), `processing_lock_alive` (no_send), `media_wait_reply` (send), `media_pending_already_notified` (no_send), `ambiguous_input_ask_rephrase` (send), `ambiguous_input_handoff` (send + status waiting_agent).

**Classificação de ambiguidade em turno orquestrado:** usar texto consolidado das últimas mensagens do cliente (snapshot do buffer), não apenas `lastMessageContent`. Heurística comercial: se contém léxico (entradas, coroa, falhas, calvície, shampoo, kit, produto, serve, recomenda, preço…) + token de pergunta/intenção, NÃO marcar como degenerado.

**Idempotência do contador:** `conversations.metadata.last_ambiguous_logical_turn_id`. Se o reprocessamento do mesmo `logical_turn_id` cair em ambiguidade de novo, NÃO incrementa `ambiguous_input_count` — usa o valor existente.

**Schema:** `support_tickets` NÃO tem coluna `channel`. Persistir em `metadata.channel`. Insert obrigatoriamente sem `channel:` no top-level (incidente schema cache 03/05/2026).

**Why:** sem o helper, qualquer branch novo que insira bot message reabre o bug do watchdog loop e contador de ambiguidade duplicado. Spec: `docs/especificacoes/whatsapp/turn-orchestrator.md` §"Early-Return Contract".
