---
name: pre_send freshness split + media_wait_reply guard (Reg #2.13 Fase C)
description: pre_send diferencia conteúdo stale (new_messages) de claim_lost puro; media_wait_reply não pode engolir turno com texto comercial
type: constraint
---

## pre_send freshness — split obrigatório

`freshnessGate("pre_send")` em `ai-support-chat/index.ts` deve interpretar 3 razões distintas:

- **`new_messages`** → cliente mandou novo input que o snapshot da resposta NÃO considera. Sempre abortar + reopen + dispatch (resposta velha).
- **`claim_lost`** → outro worker reclamou o turno mas o snapshot/conteúdo é o mesmo. Em `pre_send`, **NÃO abortar**. A idempotência (índice único `messages_unique_bot_per_logical_turn` + `complete_turn` checa claim_token) garante 1 envio. Em `pre_tool` (side-effect), continua abortando.
- **`buffer_missing`** → turno já fechado/abortado. Abort sem reopen.

**Por quê:** incidente real 03/05/2026 (Respeite o Homem, conversa `ab3d720d`, buffer `94f870a3`). Cada nova mensagem fragmentada do cliente rotaciona `claim_token`. Antes do split, o pre_send abortava por `claim_lost` puro mesmo com snapshot estável → resposta comercial gerada nunca chegou ao WhatsApp. Cliente recebeu apenas o `media_wait_reply` da imagem subsequente.

## media_wait_reply guard

`media_wait_reply` em `ai-support-chat/index.ts` SÓ pode disparar quando o turno consolidado **não tem texto comercial** (lex `entrada|coroa|falha|shampoo|kit|tratamento|...` + token de pergunta). Detecção via `turnHasCommercialText` que lê `snapshot_message_ids` do buffer e filtra mensagens `content_type='text'`.

Quando há texto comercial + mídia pendente sem vision tool:
- Não enviar `media_wait_reply`.
- Injetar nota `[Sistema] O cliente enviou uma imagem mas não temos análise visual disponível ... Responda normalmente à pergunta textual e mencione brevemente que não conseguiu avaliar a imagem em detalhes` em `lastMessageContent` antes da consolidação.
- Resposta final é comercial + linha curta de limitação visual.

**Quando media_wait_reply pode rodar:** mídia é o conteúdo principal do turno, sem dor/produto/pergunta textual relevante.

## Timeout do processor

`turn-orchestrator-processor`: `AI_INVOCATION_TIMEOUT_MS=90s` e `PROCESSOR_HARD_TIMEOUT_MS=100s` (subiu de 55s/65s). Só foi liberado APÓS o split do pre_send e o media guard — antes, o timeout mascararia loop lógico.

## Buffer afetado

`94f870a3-8ecf-4275-bcd9-22b8a432d63b`: status `processed`, `metadata.audit_incident='phaseC_pre_send_media_swallow_2026_05_03'`. Watchdog não toca (filtra `open|claimed|send_failed`).
