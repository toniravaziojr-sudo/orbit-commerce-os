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

## 6. Estado por Edge (após F2.13.2.A)

| Edge | Status |
|---|---|
| `meta-whatsapp-webhook` | ✅ Sanitizado em F2.13.2.A |
| `agenda-process-command` | ✅ Sanitizado em F2.13.2.A |
| `agenda-dispatch-reminders` | ✅ Sanitizado em F2.13.2.A |
| `agenda-submit-template` | ✅ Sem PII relevante (auditado) |

## 7. Fora do escopo desta fase (F2.13.2.A)

- `meta_webhook_audit_raw.body_preview` — sanitização e redução para 512B → **F2.13.2.B**
- `meta_webhook_audit_raw.headers_json` — aplicar `safeHeaders` (allowlist) → **F2.13.2.B**
- TTL/retenção de `body_preview` (sugestão 30d) → **F2.13.2.B**
- `whatsapp_inbound_messages.raw_payload` retenção (sugestão 90d, depois NULL) → **F2.13.2.C**
- `agenda_command_log.content/from_phone` — manter; revisar RLS service-role-only

## 8. Regra de fechamento

Todo PR que adicionar `console.log/warn/error` em edge function deve:
1. Importar de `_shared/pii.ts` quando logar telefone, erro ou conteúdo.
2. Não introduzir nenhum padrão da §5.
3. Atualizar este doc se criar nova categoria de dado sensível.
