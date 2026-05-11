# Fluxo de Recepção WhatsApp (Meta) — Especificação Formal

**Versão:** 1.0 — abr/2026
**Camada:** Layer 3 (especificação funcional do módulo WhatsApp)
**Documentos relacionados:**
- `mem://constraints/whatsapp-inbound-pipeline-must-never-be-silent`
- `mem://infrastructure/whatsapp-meta-webhook-troubleshooting-runbook`
- `docs/tecnico/base-de-conhecimento-tecnico.md`

---

## 1. Objetivo

Garantir que **toda** mensagem que entra pelo webhook da Meta tenha desfecho registrado em `whatsapp_inbound_messages` em até 5 minutos, eliminando a categoria de "mensagem silenciosa" que originou os incidentes de jan/2026 (1.980 órfãs) e abr/2026 (2.657 órfãs).

## 2. Princípio Inviolável — "Pipeline Nunca Silencia"

> Toda execução do webhook deve terminar com **uma das duas opções**:
> 1. `processed_at` preenchido + `processing_status` definido + `processed_by` explícito.
> 2. Incidente aberto automaticamente por `whatsapp-orphan-watcher`.
>
> **Nunca** uma mensagem pode ficar com `processed_at IS NULL` e `processing_status = 'received'` por mais de 5 minutos sem gerar alerta.

## 3. Arquitetura de 5 Camadas Anti-Regressão

### Camada 1 — Garantia de Status no INSERT (BD)
- Trigger `trg_whatsapp_inbound_default_status` (BEFORE INSERT) força `processing_status = 'received'` se vier NULL.
- Índice parcial `idx_whatsapp_inbound_pending` em `(tenant_id, timestamp DESC) WHERE processed_at IS NULL` acelera varredura.

### Camada 2 — Desfecho Universal no Webhook (`meta-whatsapp-webhook`)
- Todo bloco de processamento de mensagem é envolvido em `try/catch/finally`.
- Variáveis de outcome (`outcomeStatus`, `outcomeProcessedBy`, `outcomeError`, `outcomeConversationId`) começam pessimistas (`failed` / `silent_exit`).
- O `finally` **sempre** grava o desfecho final em `whatsapp_inbound_messages`, mesmo em:
  - Falha no INSERT da conversa (`convError`)
  - Falha no INSERT da mensagem (`msgError`)
  - Conversa não localizada/criada
  - Falha do agente Agenda
  - Exceção não tratada em qualquer ponto
- Códigos canônicos de `processed_by`:
  - `agenda_agent` / `agenda_failed` (rota admin)
  - `ai_support` / `ai_failed` (rota suporte com IA)
  - `gate:<motivo>` (IA bloqueada por shared gate)
  - `debounce_merged(N)` (mesclado em janela de debounce)
  - `conversation_create_failed`, `message_persist_failed`, `no_conversation` (falhas estruturais)
  - `pipeline_exception` (exceção não capturada)
  - `silent_exit` (default — **não deve aparecer em produção**; presença = bug novo)

### Camada 3 — Visão de Órfãs em Tempo Real (BD)
- View `whatsapp_inbound_orphans_v` lista mensagens com >5min sem desfecho, classificadas por `orphan_reason`:
  - `never_processed` — `received` sem `processed_at` (silêncio total)
  - `silent_partial_update` — `processed_by` preenchido mas `processing_status` NULL (UPDATE incompleto)
  - `unknown_silent` — sem `processed_at` e sem status
  - `explicit_failure` — `processing_status='failed'`

### Camada 4 — Watcher Automático (`whatsapp-orphan-watcher`)
- Cron a cada 15 minutos.
- Conta órfãs nas últimas 2h por tenant Meta ativo.
- Abre/atualiza incidente `orphan_messages` em `whatsapp_health_incidents` (severity `critical`).
- Resolve incidente automaticamente quando todas as mensagens recentes têm desfecho.

### Camada 5 — Health Check da Assinatura (`meta-whatsapp-monitor-all`)
- Cron diário re-posta `subscribed_apps` com `subscribed_fields=[messages, ...]` em todos os tenants.
- Healthcheck de token (`/me`) **não substitui** a verificação da assinatura.
- Token vivo + assinatura morta = pipeline silencioso (cenário jan/2026).

### Camada 6 — Dedupe de Redelivery da Meta (`meta-whatsapp-webhook`)
- Cenário (descoberto abr/2026): a Meta reentrega mensagens não confirmadas em <30s. A 2ª execução faz novo INSERT (novo id, mesmo `external_message_id`), entra no fluxo de IA, gasta >30s no debounce + `ai-support-chat`, e o runtime do edge function mata a execução **antes do `finally`** rodar — deixando a linha-filha em `received` para sempre. Resultado: 93% das órfãs eram redeliveries de mensagens já respondidas (cliente NÃO ficou sem resposta, mas o painel inflava).
- Solução: **antes** do bloco `try` do pipeline, o webhook consulta se já existe outra linha com mesmo `(tenant_id, external_message_id)` e `processed_at IS NOT NULL`. Se existir, marca a redelivery como `skipped/redelivery_dedup` em ~50ms e faz `continue` — sem entrar no debounce nem chamar IA.
- Suportada por índice `idx_whatsapp_inbound_external_msg_id` em `(tenant_id, external_message_id, processed_at)`.
- Adiciona `redelivery_dedup` aos códigos canônicos de `processed_by`.
- **Proibido remover** essa checagem: sem ela, qualquer pico de redelivery da Meta volta a inflar órfãs.

## 4. Estados Canônicos de `processing_status`

| Status      | Significado                                                                |
|-------------|----------------------------------------------------------------------------|
| `received`  | Inserido pelo webhook, ainda não processado (transitório, deve durar < 5s) |
| `processed` | IA respondeu ou Agenda processou com sucesso                               |
| `skipped`   | Decisão consciente de não responder (gate, debounce_merged)                |
| `failed`    | Tentativa explícita falhou (IA, conversa, mensagem, exceção)               |

## 5. Política de Reprocessamento

**Proibido reprocessamento automático** de órfãs. Visibilidade é obrigatória; ação é decisão humana caso a caso. Mensagens que entram após o ajuste seguem o fluxo correto; backlog antigo permanece como evidência histórica.

## 6. Auditoria e Diagnóstico

Para investigar silêncio em produção:

```sql
-- Órfãs nas últimas 24h por categoria
SELECT orphan_reason, COUNT(*)
FROM public.whatsapp_inbound_orphans_v
GROUP BY 1 ORDER BY 2 DESC;

-- Distribuição de desfechos nos últimos 7 dias
SELECT processing_status, processed_by, COUNT(*)
FROM whatsapp_inbound_messages
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY 1, 2 ORDER BY 3 DESC;

-- Detectar aparição de silent_exit (bug novo no webhook)
SELECT COUNT(*) FROM whatsapp_inbound_messages
WHERE processed_by = 'silent_exit' AND timestamp > NOW() - INTERVAL '24 hours';
```

## 7. Histórico de Incidentes

| Data        | Sintoma                                            | Causa raiz                                      | Camada que cobre |
|-------------|----------------------------------------------------|-------------------------------------------------|------------------|
| jan/2026    | 1.980 mensagens com `processed_at NULL`            | Assinatura `messages` perdida na Meta           | Camada 5         |
| abr/2026 (1)| 2.657 mensagens em `received` sem desfecho         | Early returns/exceções no webhook sem update    | Camadas 1, 2, 3  |
| abr/2026 (2)| 367 órfãs, 93% sendo redeliveries duplicadas       | Timeout do edge function antes do `finally` em redeliveries da Meta | Camada 6 |

## 8. Política de PII em Logs

A partir de 11/05/2026 (F2.13.2.A), todos os logs `console.*` deste pipeline seguem a política transversal definida em `docs/especificacoes/transversais/politica-pii-logs.md`:

- Telefone só aparece mascarado (`5573****1425`) via `maskPhone()` de `_shared/pii.ts`.
- Payload Meta cru não vai para log — apenas contadores (`entries`, `messages`, `statuses`, `msg_types`).
- `verify_token` nunca é logado, nem parcialmente — apenas `token_present=true/false`.
- Resposta da IA, resultado do agente Agenda e respostas de tools entram como `status` + `body_len`/`ok`, nunca como conteúdo.
- `external_message_id`/`wa_id` é preservado cru pois é necessário para a Camada 6 (dedupe de redelivery).

A tabela de auditoria raw chama-se **`whatsapp_webhook_raw_audit`** (versões anteriores citavam incorretamente `meta_webhook_audit_raw`). A partir de **F2.13.2.B (11/05/2026)** novos registros gravam `body_preview` como **resumo estrutural JSON sanitizado** (cap 2 KB) via `summarizeWebhookBody()` e `headers_json` com **allowlist canônica** via `safeHeaders()` — ambos em `_shared/pii.ts`. **Correção PII-Hash:** `wa_id_hashes`/`from_hashes`/`recipient_id_hashes` usam HMAC-SHA256(`LOG_HASH_SECRET`,…) truncado 12 hex quando o secret existir, ou SHA-256 truncado 12 hex como fallback temporário; FNV-1a foi removido por ser fraco para PII previsível. `body_sha256`, `signature_header`, `content_length`, `remote_ip`, `user_agent` e `wa_message_ids` permanecem para forense e dedupe.

**F2.13.2.B2 — TTL e limpeza de backlog (11/05/2026):** registros com `received_at < now() − 7d` tiveram `body_preview = NULL` e `headers_json = '{}'::jsonb` aplicados em massa (5.679 linhas limpas; 257 dos últimos 7d preservadas; campos forenses intactos). Cron diário `cleanup_whatsapp_webhook_raw_audit_30d` (`0 6 * * *` = 03:00 BRT, jobid 53) apaga linhas inteiras com `received_at < now() − 30d`.

**F2.13.2.C — TTL e limpeza retroativa de `whatsapp_inbound_messages.raw_payload` (11/05/2026):** `raw_payload` duplicava `from`, `id`, `type` e `text.body` que já estão em `from_phone`, `external_message_id`, `message_type` e `message_content`. Nenhum leitor (edge, SPA, watcher, dedupe, AI Support, Agenda, cobrança) depende dele. Aplicado `UPDATE whatsapp_inbound_messages SET raw_payload = NULL WHERE timestamp < now() − 7d` (3.894 linhas limpas; 183 dos últimos 7d preservadas com `raw_payload` intacto; nenhuma linha deletada). Demais colunas (`from_phone`, `message_content`, `external_message_id`, `message_type`, `timestamp`, `conversation_id`, `processed_at/_by/_status/_error`, `media_url`) 100% intactas — registro permanente do atendimento. Cron diário `cleanup_whatsapp_inbound_raw_payload_30d` (`15 6 * * *` = 03:15 BRT, jobid 54) faz `UPDATE … SET raw_payload = NULL WHERE timestamp < now() − 30d`.

**F2.13.2.C-CODE — Stop-write de `raw_payload` (11/05/2026):** alteração cirúrgica em `meta-whatsapp-webhook/index.ts:318` de `raw_payload: message` para `raw_payload: null`. Edge redeployada. Novos inbounds nascem com `raw_payload IS NULL`; demais colunas estruturadas preservadas. Cron de 30d mantido como rede de segurança. **Backlog futuro:** extrair `referral`/`interactive`/`context`/`reaction` para colunas próprias antes de ativar Click-to-WA Ads, botões IA, replies contextuais ou reactions como gatilho. `agenda_command_log` continua fora deste escopo.

## 9. Validação HMAC SHA-256 do POST (Fase A — log-mode)

**F2.13.3-CODE Fase A (11/05/2026):** o webhook agora valida a assinatura HMAC-SHA256 enviada pela Meta no header **`x-hub-signature-256`** (formato `sha256=<hex>`), comparando em **timing-safe** com `HMAC-SHA256(META_APP_SECRET, rawBody)`.

- **Secret:** `META_APP_SECRET` lido de `platform_credentials` (fallback `Deno.env`). **Nunca logado.**
- **Header aceito:** apenas `x-hub-signature-256`. O legado `x-hub-signature` (SHA-1) **não é aceito** como validação nova — segue armazenado em `whatsapp_webhook_raw_audit.signature_header` apenas para forense/dedupe.
- **GET verification:** continua usando `META_WEBHOOK_VERIFY_TOKEN` — **não compartilha segredo com HMAC**.
- **Ordem de execução:** raw audit → HMAC check → `req.json()` → roteamento. Raw body cru (`req.clone().text()`) é o input exato do HMAC, sem trim/reserialização.
- **Status logados (sanitizados):** `hmac_status ∈ { valid | invalid | missing | malformed | secret_missing }`. Se houver assinatura, loga apenas `sig_prefix=<8 primeiros hex>` para correlação — **nunca a assinatura completa**.
- **Modo atual:** `enforce=false`. Nenhum POST é rejeitado nesta fase. Falsos negativos são medidos por 72h.
- **Pendência F2.13.3-B (enforcement):** após 72h sem falso negativo, a edge passará a retornar **HTTP 401** quando `hmac_status ∈ { missing, malformed, invalid, secret_missing }`, abortando inserção em `whatsapp_inbound_messages` e qualquer roteamento (Agenda / AI Support / cobrança). Raw audit permanece anterior à validação para preservar forense de tentativas inválidas.
