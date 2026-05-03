# Turn Orchestrator (Reg #2.13) — Especificação

**Status:** Ativo no piloto Respeite o Homem (`d1a4d0ed-…`).
**Flag:** `ai_support_config.metadata.turn_orchestrator_enabled` (kill switch).

## Objetivo
Garantir que a IA responda **um turno lógico consolidado** do cliente — não cada mensagem bruta — em rajadas no WhatsApp, sem perder fragmentos, sem responder com snapshot velho e sem duplicar respostas.

## Componentes
- `ai_turn_buffers` — buffer por (`tenant_id`, `conversation_id`) com `logical_turn_id`, `claim_token`, `snapshot_message_ids`, `attempts`, `next_retry_at`, `failed_reason`.
- RPCs SECURITY DEFINER: `enqueue_turn_message`, `claim_turn`, `check_turn_freshness`, `reopen_turn`, `complete_turn`, `fail_turn`, `get_stuck_turn_buffers`, `mark_dead_turn_buffers`.
- Edge Functions: `turn-orchestrator-processor` (caminho único de processamento) e `turn-orchestrator-watchdog` (cron 1min).
- Integração: `meta-whatsapp-webhook` (enqueue + waitUntil) e `ai-support-chat` (logical_turn_id + freshness + complete/fail).

## Status canônicos
`open` (aguardando quiet window) → `claimed` (worker pegou) → `processed` (resposta persistida) | `send_failed` (falha de envio, retry com backoff) | `dead` (>5 tentativas) | `aborted`.

Índice ativo único por conversa cobre `open|claimed|send_failed`.

## Fluxo end-to-end
1. **Webhook** persiste inbound + conversation message → classifica completude → `enqueue_turn_message` (cria/atualiza buffer com `process_after = now() + debounce_ms`) → `EdgeRuntime.waitUntil(POST processor)` → responde **200 rápido para a Meta**.
2. **Processor** (`source: webhook`):
   - `waitQuietWindow` (cap 7s, repolla `process_after` para detectar extensão por novas mensagens),
   - `claim_turn` (atômico — só 1 worker vence),
   - chama `ai-support-chat` com `{conversation_id, tenant_id, logical_turn_id, claim_token}` (timeout 55s).
3. **ai-support-chat**:
   - antes de cada side-effect tool → `freshnessGate("pre_tool")`,
   - antes do save final → `freshnessGate("pre_send")`,
   - persiste bot com `metadata.logical_turn_id` (índice único força 1 bot/turno),
   - `complete_turn` ao final OK; `fail_turn` (com backoff 2/5/15/45/120s) em erro.
4. **Freshness failure** → `reopen_turn` + dispatch processor (`source: freshness_reopen`) + retorna 200 sem responder.
5. **Watchdog** (cron 1min): `mark_dead_turn_buffers(5)` + `get_stuck_turn_buffers` + dispatch batch ao processor (`source: watchdog`, skip_quiet_window).

## Limites técnicos
- Quiet window cap: **7s** (`MAX_QUIET_WINDOW_MS`).
- AI invocation timeout: **55s** (`AI_INVOCATION_TIMEOUT_MS`).
- Processor hard timeout: **65s** (`PROCESSOR_HARD_TIMEOUT_MS`).
- Claim stale: **90s** (após isso watchdog reclama).
- Max attempts: **5** → status `dead`.
- Backoff progressivo: 2s, 5s, 15s, 45s, 120s.

## Idempotência
- `claim_turn` atômico (UPDATE com FOR UPDATE) — múltiplos `waitUntil` para o mesmo buffer convergem em 1 worker.
- `messages_unique_bot_per_logical_turn` impede duas respostas para o mesmo turno.
- Em duplicate (23505) → completa o turno sem erro ao usuário.

## Como desligar (kill switch)
```sql
UPDATE public.ai_support_config
SET metadata = metadata || '{"turn_orchestrator_enabled": false}'::jsonb
WHERE tenant_id = '<TENANT>';
```
Webhook detecta a flag a cada inbound e cai automaticamente no caminho legado (`enqueueInboundForDebounce` + invoke direto). Buffers já existentes seguem sendo drenados pelo watchdog.

## Logs esperados
- `[meta-whatsapp-webhook][...] [TURN-ORCH] enqueued logical_turn=… buffer_size=N created=true|false`
- `[meta-whatsapp-webhook][...] [TURN-ORCH] processor dispatched status=200`
- `[turn-orchestrator-processor][webhook][<turn8>] quiet_window result: {ready:true,reason:quiet_window_elapsed,…}`
- `[turn-orchestrator-processor][...] claimed token=… attempts=1 completeness=…`
- `[ai-support-chat] [TURN-ORCH] orchestrator call logical_turn=… claim=…`
- `[ai-support-chat] [TURN-ORCH][pre_tool] STALE reason=new_messages tool=add_to_cart → reopen+dispatch`
- `[ai-support-chat] [TURN-ORCH] complete_turn OK bot_msg=…`
- `[turn-orchestrator-watchdog] found N stuck buffers` (a cada minuto; 0 é normal)

## Riscos remanescentes
- `EdgeRuntime.waitUntil` ainda é não-documentado oficialmente como "garantido"; o watchdog é a rede de segurança.
- `ai-support-chat` é grande; 3 inserts auxiliares (handoff_ambíguo, ask_rephrase, media_wait) **não** carregam `logical_turn_id` — eles agem em early-returns ANTES de o orquestrador chegar; o índice único só atinge o save principal. Em rajada extrema com handoff é teoricamente possível 1 dessas mensagens + 1 bot final convencional. Aceito (não causa duplicidade visível ao cliente, são tipos diferentes).
- Backoff hardcoded; pode virar config futura.
