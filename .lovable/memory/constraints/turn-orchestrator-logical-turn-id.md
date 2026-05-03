---
name: turn-orchestrator-logical-turn-id
description: Toda escrita de bot pelo ai-support-chat sob orquestrador deve carregar metadata.logical_turn_id; freshness check é obrigatório antes de side-effect tools e do envio final.
type: constraint
---

# Turn Orchestrator — `logical_turn_id` é obrigatório

Quando `ai-support-chat` é invocado pelo `turn-orchestrator-processor` (com `logical_turn_id` + `claim_token` no body), valem estas regras INVIOLÁVEIS:

1. **Idempotência forte:** a mensagem `bot` final DEVE conter `metadata.logical_turn_id`. O índice único `messages_unique_bot_per_logical_turn` garante 1 resposta por turno lógico. Tentativas de duplicar caem em 23505 e o handler completa o turno sem reenviar.
2. **Freshness pré-tool:** ANTES de executar qualquer tool de side-effect (`add_to_cart`, `remove_from_cart`, `update_cart_item`, `apply_coupon`, `remove_coupon`, `generate_checkout_link`, `create_checkout_link`, `request_human_handoff`, `transfer_to_human`, `create_order`, `send_payment_link`) — chamar `check_turn_freshness`. Se stale: `reopen_turn` + dispatch `turn-orchestrator-processor` (`source: freshness_reopen`) + `return` 200.
3. **Freshness pré-envio:** ANTES de persistir o bot final — repetir o gate.
4. **Status final:** ao salvar bot, chamar `complete_turn`. Em erro de save (não-duplicate), chamar `fail_turn` para permitir retry idempotente.
5. **Status canônicos do buffer:** `open | claimed | processed | aborted | send_failed | dead`. Watchdog procura `open|claimed|send_failed` com `attempts < 5`. Após 5 tentativas → `dead` (sem retry).
6. **Despacho do processor:** `webhook` usa `EdgeRuntime.waitUntil` (200 rápido para Meta); `freshness_reopen` usa `waitUntil` interno; `cron watchdog` chama processor em batch a cada 1min como rede de segurança.

**Why:** sem essas regras, ou o cliente recebe 2 respostas para o mesmo turno (índice único quebra), ou o processor responde com base em snapshot velho (race condition GPT-5 vs nova mensagem). O incidente que motivou Reg #2.13 foi exatamente isso: respostas duplicadas e/ou desalinhadas em rajadas WhatsApp.

**How to apply:**
- Mexeu em `ai-support-chat` save/tool path? Releia `freshnessGate` e o bloco `STEP 9: SAVE MESSAGE`.
- Adicionou tool nova com efeito colateral? Inclua em `SIDE_EFFECT_TOOLS_LOCAL`.
- Mudou status do buffer? Atualize `get_stuck_turn_buffers`, `mark_dead_turn_buffers` e o índice parcial `ai_turn_buffers_active_per_conv` em conjunto.
