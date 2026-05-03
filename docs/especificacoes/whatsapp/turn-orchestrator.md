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
- AI invocation timeout: **90s** (`AI_INVOCATION_TIMEOUT_MS`) — subiu de 55s em 03/mai/2026 (Reg #24 do changelog) APÓS correção do pre_send/media guard. Não usar timeout maior como muleta de loop lógico.
- Processor hard timeout: **100s** (`PROCESSOR_HARD_TIMEOUT_MS`).
- Claim stale: **90s** (após isso watchdog reclama).
- Max attempts: **5** → status `dead`.
- Backoff progressivo: 2s, 5s, 15s, 45s, 120s.

## Pre_send freshness — split obrigatório (Reg #2.13 Fase C — Reg #24)
`freshnessGate("pre_send")` distingue 3 razões de "não fresh":
- **`new_messages`** → cliente mandou input novo fora do snapshot. Sempre abortar + `reopen_turn` + dispatch processor (`source: freshness_reopen`). Resposta velha.
- **`claim_lost`** puro (snapshot inalterado, claim_token rotacionou) → **não abortar em `pre_send`**. A idempotência (índice único `messages_unique_bot_per_logical_turn` + `complete_turn` valida claim_token + handler de 23505 cobre `duplicate_bot_already_sent` / `_in_flight`) garante exatamente 1 envio. Em `pre_tool` (side-effect) continua abortando.
- **`buffer_missing`** → turno já encerrado, abort sem reopen.

Histórico: incidente real 03/mai/2026 (conversa `ab3d720d`, buffer `94f870a3`) — antes do split, `claim_lost` puro matava resposta comercial mesmo com snapshot estável.

## Media inbound + texto comercial (Reg #2.13 Fase C — Reg #24)
`media_wait_reply` SÓ pode rodar quando o turno consolidado **não tem texto comercial** (lex `entrada|coroa|falha|shampoo|kit|tratamento|...` + token de pergunta, calculado a partir de `snapshot_message_ids`).

Quando há texto comercial + mídia pendente sem vision tool:
- Pular `media_wait_reply`.
- Injetar nota `[Sistema] O cliente enviou uma imagem mas não temos análise visual disponível...` em `lastMessageContent`.
- Pipeline gera resposta comercial completa + linha curta de limitação visual.

Reg #15 (`gateMediaInbound`) continua válido para o caso oposto (mídia isolada sem texto útil).

## Idempotência
- `claim_turn` atômico (UPDATE com FOR UPDATE) — múltiplos `waitUntil` para o mesmo buffer convergem em 1 worker.
- `messages_unique_bot_per_logical_turn` impede duas respostas para o mesmo turno.
- Em duplicate (23505) → completa o turno sem erro ao usuário.

## Ordem INSERT → SEND → COMPLETE/FAIL (Reg #2.13 Fase C)
1. `INSERT` da mensagem `bot` com `metadata.logical_turn_id` e `delivery_status='queued'`.
2. `meta-whatsapp-send` (ou chat/email) — chamada síncrona com timeout.
3. **Envio aceito** = `success === true` (Cloud API retornou wamid) **OU** canal `chat`/`email` com sucesso **OU** `dupCheck.duplicate === true` (decisão determinística de não enviar) **OU**, em sandbox, `dry_run:true`.
4. `complete_turn(bot_message_id)` somente se aceito; caso contrário `fail_turn(bot_message_id, error)` com retry idempotente reutilizando o mesmo `bot_message_id` (índice único impede 2ª resposta).
5. Em retry pós `fail_turn`, o claim seguinte detecta a bot já existente e `complete_turn` é chamado sem novo INSERT.

## Sandbox (dry_run) e proteção contra leak para Meta
- `ai-test-sandbox` (action `burst`): `dry_send=true` é o **default**. Conversa carrega `metadata.dry_send=true`, `metadata.real_send=false`, `metadata.delivery_adapter='dry_run'`.
- `meta-whatsapp-send` aplica **GUARD RAIL** ANTES de qualquer formatação de telefone: bloqueia envio real se origem for sandbox/teste/dry_run, exceto se TODOS forem satisfeitos: header `x-allow-real-send: true` + `recipient_override` + número ∈ `TEST_WHATSAPP_RECIPIENT_ALLOWLIST` + `metadata.real_send=true` + `dry_send !== true`.
- Allowlist **vazia hoje** → todo real_send sandbox é negado.
- Sandbox simula falha sem chamar Meta via `force_send_failure=true` → `delivery_status='failed'`, `failure_reason='sandbox_simulated_send_failure'`, `success:false` (dispara `fail_turn` no orquestrador).
- Sandbox sucesso técnico: `delivery_status='dry_run'` (status terminal — NUNCA contar como entrega real).
- Histórico do incidente e lista oficial dos 5 wamids vazados em 02–03/05/2026: ver `mem://constraints/sandbox-real-meta-leak`.

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

## Consolidação obrigatória do turno antes do roteamento (Reg #2.13 Fase C)
Quando `ai-support-chat` é invocado pelo orquestrador (`isOrchestratorCall=true`), o código DEVE consolidar as mensagens do buffer (`snapshot_message_ids` → texto agregado em ordem cronológica) e SOBRESCREVER `lastMessageContent` ANTES de qualquer etapa de roteamento/classificação:

- TPR (`classifyTurn`)
- detector de input degenerado / `ambiguous_input`
- `decideNextState` / state machine
- greeting detection (`isPureGreeting`) e greeting mirror (`detectGreetingEcho`)
- sales trigger / `detectInformationalProductQuestion` / `detectFamilyMentioned`
- product/family focus
- prompt principal e tools (`search_products`)

**Por quê:** sem essa consolidação, o último fragmento da rajada (ex.: `"?"`) determina o roteamento e a IA cai em greeting genérico ignorando dor/produto declarados nos fragmentos anteriores. Incidente real WhatsApp 02–03/mai/2026 (conversa `ab3d720d`). Memória anti-regressão: `mem://constraints/turn-orchestrator-consolidated-text`.

**Sinal de regressão:** bot responde greeting genérico em turno multi-mensagem com dor/produto/pergunta declarados; ou `lastMessageContent` chega ao prompt como apenas o último fragmento (`"?"`, `"ok"`, etc.).

**Placeholders de teste:** `burst`, `sandbox`, `dry_run` estão em `looksGenericOrCorporate` para nunca virarem vocativo.

## Early-Return Contract (Reg #2.13 Fase C)
Todo early-return de `ai-support-chat` em chamada orquestrada PASSA pelo helper `finalizeOrchestratedTurn({outcome, botMessageId?, botContent?, kind?, reason?, conversationRef?})`. 3 outcomes:
- **send** — INSERT bot já feito; helper envia (whatsapp/chat/email) + `complete_turn`/`fail_turn` + atualiza `delivery_status`. Idempotência por índice único `messages_unique_bot_per_logical_turn`.
- **no_send** — sem mensagem; `complete_turn(bot_message_id=null)`. Casos: `processing_lock_alive`, `media_pending_already_notified`.
- **abort** — terminal sem retry; `complete_turn(null)` (não `fail_turn`, que recoloca em `send_failed`). Caso: `handoff_terminal_lock`.

Cobertura atual de early-returns: `handoff_terminal_lock`(abort), `processing_lock_alive`(no_send), `media_wait_reply`(send), `media_pending_already_notified`(no_send), `ambiguous_input_ask_rephrase`(send), `ambiguous_input_handoff`(send + waiting_agent).

Classificação de ambiguidade em turno orquestrado: usa texto consolidado das últimas msgs do cliente + heurística comercial (entradas, coroa, falhas, calvície, shampoo, kit, produto, recomenda, preço…) + token de pergunta. Se comercial → não cai em ambiguous_input.

Idempotência do contador: `conversations.metadata.last_ambiguous_logical_turn_id`. Reprocessamento do mesmo `logical_turn_id` NÃO incrementa `ambiguous_input_count`.

Schema: `support_tickets` NÃO tem coluna `channel`. Sempre persistir em `metadata.channel`.

## Riscos remanescentes
- `EdgeRuntime.waitUntil` ainda é não-documentado oficialmente como "garantido"; o watchdog é a rede de segurança.
- `ai-support-chat` é grande; 3 inserts auxiliares (handoff_ambíguo, ask_rephrase, media_wait) **não** carregam `logical_turn_id` — eles agem em early-returns ANTES de o orquestrador chegar; o índice único só atinge o save principal. Em rajada extrema com handoff é teoricamente possível 1 dessas mensagens + 1 bot final convencional. Aceito (não causa duplicidade visível ao cliente, são tipos diferentes).
- Backoff hardcoded; pode virar config futura.
