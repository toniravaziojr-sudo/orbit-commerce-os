# Política de PII em Logs (transversal)

**Versão:** 1.0 — 11/05/2026 (F2.13.2.A)
**Camada:** Layer 3 transversal
**Helper canônico:** `supabase/functions/_shared/pii.ts`
**Docs relacionados:**
- `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md`
- `docs/especificacoes/plataforma/motor-creditos-fase-f2-platform-cost-ledger.md`

---

## 1. Objetivo

Reduzir exposição de PII e segredos em logs runtime (`console.log/warn/error`) das Edge Functions sem comprometer rastreabilidade, dedupe de redelivery, diagnóstico de mensagens órfãs ou auditoria do Motor de Créditos.

## 2. Princípios

1. **Persistência operacional ≠ logs.** Tabelas de auditoria/operação podem conter dados sensíveis sob RLS service-role. Logs são canal aberto e devem ser sanitizados.
2. **Rastreabilidade preservada.** `traceId`, `tenant_id.slice(0,8)`, `external_message_id`/`wa_id`, `phone_number_id`, contadores e hashes técnicos sempre podem ser logados.
3. **Nunca logar segredo, mesmo parcial.** `Authorization`, `Bearer`, `access_token`, `refresh_token`, `verify_token`, `webhook_secret`, `service_role_key` — nunca, nem prefixo/substring.
4. **Telefone sempre mascarado.** Padrão `5573****1425` via `maskPhone()`.
5. **Texto de cliente nunca em log.** Mensagem inbound, prompt, resposta IA, payload Meta cru, dados de tarefa — não vão para `console.*`. Persistência fica nas tabelas operacionais.
6. **Erros truncados.** Usar `safeError(err, 200)` para evitar stack/payload em log padrão.

## 3. Helpers oficiais (`_shared/pii.ts`)

| Helper | Uso | Exemplo |
|---|---|---|
| `maskPhone(value)` | Telefone em log | `maskPhone("5573991681425") → "5573****1425"` |
| `safeTruncate(value, n)` | Texto/objeto longo em contexto | `safeTruncate(body, 120)` |
| `safeError(err, n)` | Erros em catch | `console.error(..., safeError(err))` |
| `hashForLog(value)` | Correlacionar sem expor (sha256[:12]) | rastrear o "mesmo conteúdo" entre 2 logs |
| `safeHeaders(headers)` | **Allowlist** para auditoria raw (preparado para F2.13.2.B; não usar ainda em persistência) | — |

## 4. O que pode ir para log

- `traceId`, `requestId`
- `tenant_id.slice(0,8)`
- `external_message_id` / `wa_id` (necessário para dedupe Camada 6)
- `phone_number_id` (Meta — não é PII de cliente final)
- Status HTTP, `success`, contadores (`entries`, `messages`, `statuses`)
- Tipos (`message_type`, `intent`)
- Tokens de uso da IA (`prompt_tokens`, `completion_tokens`)
- `body_sha256`, `content_length`
- Decisões do gate IA (motivo)
- `processed_by`, `processing_status`

## 5. O que NUNCA pode ir para log

- Telefone cru (sempre `maskPhone()`)
- Conteúdo de mensagem inbound/outbound
- Prompt do sistema, resposta da IA, JSON bruto do agente
- Payload Meta bruto (`JSON.stringify(payload)`)
- `toolArgs`/`result` brutos (use `Object.keys(args)`)
- `profile.name` do contato
- Headers de Authorization/Cookie
- Substring de qualquer segredo
- IP/User-Agent fora de auditoria persistida sob RLS

## 6. Estado por Edge / persistência

| Alvo | Status |
|---|---|
| `meta-whatsapp-webhook` (logs) | ✅ Sanitizado em F2.13.2.A |
| `agenda-process-command` (logs) | ✅ Sanitizado em F2.13.2.A |
| `agenda-dispatch-reminders` (logs) | ✅ Sanitizado em F2.13.2.A |
| `agenda-submit-template` (logs) | ✅ Sem PII relevante (auditado) |
| `whatsapp_webhook_raw_audit.body_preview` | ✅ Sanitizado em F2.13.2.B (resumo estrutural JSON, cap 2 KB) — efetivo em produção a partir de F2.13.2.B-FIX (redeploy 11/05/2026, validado com payload sintético) |
| `whatsapp_webhook_raw_audit.headers_json` | ✅ Sanitizado em F2.13.2.B (`safeHeaders` allowlist canônica) — efetivo em produção a partir de F2.13.2.B-FIX |

> Correção de nomenclatura (F2.13.2.B): a tabela alvo se chama
> **`whatsapp_webhook_raw_audit`** no banco — não `meta_webhook_audit_raw`.
> Versões anteriores deste doc usavam o nome incorreto.

### Formato canônico de `body_preview` (F2.13.2.B)

Coluna `text`, contendo `JSON.stringify(...)` válido com:

```json
{
  "object": "whatsapp_business_account",
  "entries": 1,
  "messages": 1,
  "statuses": 0,
  "msg_types": ["text"],
  "phone_number_ids": ["108512..."],
  "wa_message_ids": ["wamid..."],
  "wa_id_hashes": ["32d0d28f1ed2"],
  "from_hashes": ["32d0d28f1ed2"],
  "recipient_id_hashes": [],
  "text_lengths": [42],
  "has_media": false,
  "parse_error": null
}
```

Em payload não-JSON / parse falho: `{ "parse_error", "content_type", "byte_length" }`. `body_sha256` permanece em coluna própria como chave forense.

### Hash de PII no `body_preview` (Correção F2.13.2.B — PII-Hash)

`wa_id_hashes`, `from_hashes` e `recipient_id_hashes` são gerados por `summarizeWebhookBody()` usando hash **criptográfico determinístico**, truncado a 12 hex chars:

1. Se a env var `LOG_HASH_SECRET` estiver presente → **HMAC-SHA256(LOG_HASH_SECRET, valor)**.
2. Caso contrário → **SHA-256(valor)** puro como fallback temporário.

**FNV-1a foi removido** desta função: hash não criptográfico é correlacionável/bruteforçável trivialmente para PII previsível como telefone E.164. **Nunca usar `META_APP_SECRET` como pepper de logs** — finalidades distintas (verificação Meta vs. observabilidade interna) não devem compartilhar segredo.

**Pendência futura:** provisionar secret dedicado `LOG_HASH_SECRET` (pepper de observabilidade) e migrar definitivamente para HMAC-SHA256. Enquanto não existir, o fallback SHA-256 truncado está em uso.

### Allowlist canônica de `headers_json` (F2.13.2.B)

`x-hub-signature-256`, `x-hub-signature`, `content-type`, `content-length`, `user-agent`, `x-request-id`, `cf-ray`, `cf-ipcountry`, `cf-connecting-ip`, `x-forwarded-for`, `x-forwarded-proto`, `host`, `sb-request-id`, `traceparent`, `x-amzn-trace-id`. Qualquer outro header é descartado.

## 7. Retenção e TTL — `whatsapp_webhook_raw_audit` (F2.13.2.B2)

Aplicado em 11/05/2026 (opção D híbrida):

- **Limpeza imediata de PII em backlog:** `UPDATE` único em registros com `received_at < now() - interval '7 days'` setando `body_preview = NULL` e `headers_json = '{}'::jsonb`.
  - Snapshot pré: 5.936 linhas, 5.679 alvo, 257 preservadas (últimos 7d).
  - Snapshot pós: 0 linhas antigas com PII residual; 257 linhas recentes intactas.
- **Campos forenses preservados em todas as linhas:** `id`, `received_at`, `trace_id`, `method`, `remote_ip`, `user_agent`, `signature_header`, `content_length`, `body_sha256`, `query_string`.
- **TTL prospectivo de 30 dias:** cron `cleanup_whatsapp_webhook_raw_audit_30d` (jobid 53), schedule `0 6 * * *` (= 03:00 BRT), executa `DELETE FROM public.whatsapp_webhook_raw_audit WHERE received_at < now() - interval '30 days'`. Apaga a linha inteira.
- **Não foi feita** re-sanitização retroativa com hashes nem aplicação de `LOG_HASH_SECRET` nesta fase.

## 8. Retenção e TTL — `whatsapp_inbound_messages.raw_payload` (F2.13.2.C)

Aplicado em 11/05/2026 (opção E híbrida — somente parte de dados/retenção):

- **Auditoria prévia:** `raw_payload` duplica `from`/`id`/`type`/`text.body` que já estão em colunas estruturadas (`from_phone`, `external_message_id`, `message_type`, `message_content`). Nenhum edge function, componente SPA, watcher, dedupe, AI Support, Agenda ou cobrança lê `raw_payload`. Único escritor: `meta-whatsapp-webhook`.
- **Cutoffs fixos:** `cleanup_cutoff = now() − 7 days`; `ttl_cutoff = now() − 30 days`.
- **Snapshot pré:** 4.077 linhas; 4.077 com `raw_payload` não-nulo; 3.894 alvo do cleanup imediato; 183 preservadas (últimos 7d); 1.468 com `conversation_id`; 0 com `media_url`.
- **Limpeza imediata:** `UPDATE whatsapp_inbound_messages SET raw_payload = NULL WHERE timestamp < cleanup_cutoff AND raw_payload IS NOT NULL` → **3.894 linhas** atualizadas.
- **Snapshot pós:** 4.077 linhas (sem deleção); 183 com `raw_payload` ainda preenchido (todas dos últimos 7d); 0 linhas antigas com `raw_payload` residual; `from_phone`, `message_content`, `external_message_id`, `message_type`, `timestamp`, `conversation_id` 100% intactos.
- **TTL prospectivo de 30 dias:** cron `cleanup_whatsapp_inbound_raw_payload_30d` (jobid 54), schedule `15 6 * * *` (= 03:15 BRT, deslocado 15 min do cron de `whatsapp_webhook_raw_audit` para evitar contenção). Ação: `UPDATE … SET raw_payload = NULL WHERE timestamp < now() − interval '30 days' AND raw_payload IS NOT NULL`. **A linha inteira é preservada** — não há `DELETE`.
- **Preservados indefinidamente:** `id`, `tenant_id`, `provider`, `external_message_id`, `from_phone`, `to_phone`, `message_type`, `message_content`, `media_url`, `timestamp`, `processed_at`, `processed_by`, `processing_status`, `processing_error`, `conversation_id`, `created_at` — registro permanente do atendimento.

## 9. Stop-write em `whatsapp_inbound_messages.raw_payload` (F2.13.2.C-CODE)

Aplicado em 11/05/2026:

- **Mudança cirúrgica** em `supabase/functions/meta-whatsapp-webhook/index.ts:318` — `raw_payload: message` → `raw_payload: null`.
- Demais campos do INSERT preservados; edge function redeployada.
- Cron `cleanup_whatsapp_inbound_raw_payload_30d` (jobid 54) **mantido** como rede de segurança contra regressão futura.
- Sem alteração de dados antigos, schema, RLS, RPC ou UI.
- **Backlog futuro:** se Click-to-WhatsApp Ads, botões IA, replies contextuais ou reactions virarem feature, extrair `referral`/`interactive`/`context`/`reaction` para colunas próprias **antes** do consumo — esses dados deixaram de existir a partir do go-live.

## 10. Fora do escopo desta fase

- `agenda_command_log.content/from_phone` — manter; revisar RLS service-role-only.
- Provisionamento futuro de `LOG_HASH_SECRET` para HMAC-SHA256 definitivo (ver §6).

## 8. Regra de fechamento

Todo PR que adicionar `console.log/warn/error` em edge function deve:
1. Importar de `_shared/pii.ts` quando logar telefone, erro ou conteúdo.
2. Não introduzir nenhum padrão da §5.
3. Atualizar este doc se criar nova categoria de dado sensível.

