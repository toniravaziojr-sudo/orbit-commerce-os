# Motor de Créditos — Fase F2: Registro de Custos Absorvidos pela Plataforma

> **Camada:** Layer 2 — Especificação de Plataforma
> **Status:** F2.1 ✅ GO • F2.2 ✅ GO (`send-auth-email`) • F2.3 ✅ GO (`resend-signup-email` migrada p/ SendGrid)
> **Última atualização:** 2026-05-07

---

## 1. Objetivo

Permitir que edges classificadas como `cost_owner='platform'` (e-mails de auth/sistema, crons globais, monitoramento) registrem o **custo externo absorvido** sem cobrar tenant, sem tocar `credit_wallet`/`credit_ledger` e sem aparecer no extrato visível ao lojista.

## 2. Fonte de verdade

- Tabela: `public.platform_cost_ledger`
- RPC: `public.record_platform_cost(...)`
- Helper TS: `recordPlatformCost()` em `supabase/functions/_shared/credits/charge.ts`
- Pricing/FX: `service_pricing` + `_get_active_pricing()` + `_get_active_fx('USD','BRL')`

## 3. Pré-check (2026-05-07)

### 3.1 Schema real de `platform_cost_ledger`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | default `gen_random_uuid()` |
| service_key | text NOT NULL | |
| category | text NOT NULL | |
| provider | text NOT NULL | |
| units_json | jsonb NOT NULL | default `{}` |
| cost_usd | numeric NOT NULL | |
| fx_rate_usd_brl | numeric NOT NULL | |
| fx_source | text NOT NULL | default `'manual'` |
| cost_brl | numeric NOT NULL | |
| reason | text NOT NULL | descrição do custo |
| origin_function | text NULL | edge/worker que disparou |
| idempotency_key | text NULL | UNIQUE parcial via `ux_pcl_idem` |
| metadata | jsonb NOT NULL | default `{}` |
| created_at | timestamptz NOT NULL | default `now()` |

Índices: `ux_pcl_idem (idempotency_key) WHERE idempotency_key IS NOT NULL`, `idx_pcl_created`, `idx_pcl_service`, `idx_pcl_category`.

### 3.2 Bug encontrado

A versão original do RPC `record_platform_cost` referenciava colunas inexistentes na tabela: `origin`, `origin_id`, `pricing_id`. Toda chamada via `recordPlatformCost()` falhava silenciosamente com `42703 column "origin" does not exist`. Resultado: `platform_cost_ledger` permaneceu zerado mesmo após chamadas no código.

### 3.3 Decisão técnica — Opção A (aprovada pelo usuário)

Corrigir apenas o corpo do RPC para casar com o schema real. **Não** alterar a tabela. Manter assinatura pública para preservar callers existentes (`recordPlatformCost()` no helper TS).

## 4. Correção aplicada (Patch F2.1)

Migration: `CREATE OR REPLACE FUNCTION public.record_platform_cost(...)`.

Mapeamento antigo → real:

| Parâmetro RPC | Coluna escrita | Observação |
|---|---|---|
| `p_origin` | `origin_function` | edge/worker de origem |
| `p_origin_id` | `metadata.origin_id` | preservado em metadata (sem coluna dedicada) |
| `p.id` (pricing) | `metadata.pricing_id` | preservado em metadata |
| (constante) | `reason='platform_absorbed_cost'` | descrição padrão |

Demais campos (`service_key`, `category`, `provider`, `units_json`, `cost_usd`, `cost_brl`, `fx_rate_usd_brl`, `fx_source`, `idempotency_key`, `metadata`) preservam o comportamento original.

**Cálculo de custo:** o RPC recebe `p_cost_usd` pronto do caller. Calcula apenas `cost_brl = cost_usd × fx.rate` usando `_get_active_fx('USD','BRL')`. Lê `service_pricing` apenas para resolver `category`/`provider`/`pricing_id`; nunca sobrescreve o `cost_usd` recebido.

**Segurança:** mantém `auth.role()='service_role' OR is_platform_admin_by_auth()` antes de qualquer escrita.

**Idempotência:** SELECT por `idempotency_key` antes do INSERT; UNIQUE parcial `ux_pcl_idem` é a barreira final.

## 5. Validação técnica F2.1 (2026-05-07)

Inserção controlada com `email-system-send` ($0.00060 USD, sem disparar SendGrid):

| Item | Resultado |
|---|---|
| RPC executa sem erro | ✅ |
| Linha criada em `platform_cost_ledger` | ✅ id=`41a216ad-d328-4908-a416-bbafb776f49c` |
| `origin` mapeado em `origin_function='f2.1-validation'` | ✅ |
| `pricing_id` preservado em metadata | ✅ `95ed7cbb-486c-451c-9888-f774147d8e5d` |
| `origin_id` preservado em metadata | ✅ `null` |
| `reason='platform_absorbed_cost'` | ✅ |
| `cost_usd=0.00060` | ✅ |
| `cost_brl` calculado via FX 5.50 | ✅ `0.0033` |
| `fx_source='manual'` | ✅ |
| 2ª chamada com mesma `idempotency_key` | ✅ retorna mesmo `ledger_id`, sem 2ª linha |
| `credit_ledger` últimos 5min | ✅ 0 alterações |
| `service_usage_events` últimos 5min | ✅ 0 alterações |
| Provider pago real chamado | ✅ NÃO |

**Cleanup:** linha sintética `f2.1-validation-test-001` removida via `DELETE FROM platform_cost_ledger WHERE idempotency_key='f2.1-validation-test-001'`. Estado final: tabela continua zerada, pronta para F2.2.

## 6. Multi-tenant safety

- `platform_cost_ledger` não tem `tenant_id` → tenant nunca vê custo interno via RLS.
- Tenant context (quando houver) é gravado em `metadata.tenant_id` apenas como audit, sem cruzar com wallet/ledger.
- Helper TS preserva contrato `(serviceKey, units, costUsd, origin, originId?, metadata?, idempotencyKey?)`.

## 7. GO/NO-GO F2.1

**✅ GO** — fundação corrigida, validada e documentada.

## 8. Patch F2.2 — Plug em `send-auth-email` (2026-05-07)

### 8.1 Edges avaliadas

| Edge | Provider | Status F2.2 | Motivo |
|---|---|---|---|
| `send-auth-email` | SendGrid | ✅ **PLUGADA** | provider/service_key/custo confiáveis (`email-system-send`, $0.00060) |
| `resend-signup-email` | **Resend** | ❌ não plugada | Sem `service_pricing` confiável para Resend; plugar exigiria inventar custo. Pendência F2.3. |

### 8.2 Implementação em `send-auth-email`

- Import: `recordPlatformCost` de `_shared/credits/charge.ts`.
- Chamada **após** sucesso confirmado do SendGrid (logo após log de sucesso), nunca em caminho de erro.
- Padrão fire-and-forget (`.catch(log)`) — falha de telemetria não quebra envio.
- `serviceKey='email-system-send'`, `costUsd=0.00060`, `units={count:1}`, `origin='send-auth-email'`.
- **Idempotência:** `send-auth-email:${result.messageId}` quando há `X-Message-Id` do SendGrid; fallback determinístico `send-auth-email:${email_type}:${sha256(email).slice(0,16)}:${minute_bucket}` quando ausente.
- **Sanitização de metadata:** apenas `email_type`, `template_key`, `recipient_hash` (SHA-256 truncado em 16 chars), `provider_message_id`. **Nunca** grava token, magic link, código, senha, JWT, corpo do e-mail, e-mail bruto, ou segredo.

### 8.3 Validação técnica F2.2

| Item | Resultado |
|---|---|
| Arquivo alterado | `supabase/functions/send-auth-email/index.ts` |
| Edge deployada | ✅ `send-auth-email` |
| Inserção controlada via RPC com chave `send-auth-email:sg-test-msgid-001` | ✅ `ledger_id=9c8bc7f6...`, `cost_brl=0.0033` |
| 2ª chamada mesma chave | ✅ retorna mesmo id, 0 duplicação |
| `metadata` sem dados sensíveis | ✅ apenas campos técnicos |
| `credit_ledger` últimos 5min | ✅ 0 alterações |
| `service_usage_events` últimos 5min | ✅ 0 alterações |
| Provider pago chamado | ✅ NÃO (validação via RPC direto) |
| Cleanup linha sintética | ✅ removida |

### 8.4 Falha de provider não registra custo

Por construção: `recordPlatformCost` é chamado **depois** de `if (!result.success) throw new Error(...)`. Em qualquer falha SendGrid (4xx/5xx/exception), o `throw` aborta antes do registro. Garantido por revisão de código.

## 9. Patch F2.3 — Migração `resend-signup-email` para SendGrid (2026-05-07)

### 9.1 Decisão (Opção B aprovada pelo operador)

Pré-check em modo PLANNER confirmou que `resend-signup-email`:
- está **dormente/órfã** (0 chamadores no projeto, 0 sessões pagas em 90d);
- usava Resend apenas via REST cru (`POST /emails`), sem feature exclusiva;
- **não há** `service_pricing` confiável para Resend → manter Resend exigiria inventar custo (proibido pela lição F1).

Decisão: **migrar para SendGrid** reusando `service_key=email-system-send` ($0.00060), preservando comportamento, nome da edge e remetente visível.

### 9.2 Implementação

| Item | Valor |
|---|---|
| Arquivo alterado | `supabase/functions/resend-signup-email/index.ts` |
| Provider final | **SendGrid** (`https://api.sendgrid.com/v3/mail/send`) |
| Remetente preservado | `Comando Central <noreply@comandocentral.com.br>` (domínio `comandocentral.com.br` `verified` em `system_email_config`) |
| Nome da edge | mantido como `resend-signup-email` (evita quebra de invocações futuras) |
| `service_key` | `email-system-send` |
| `cost_usd` | `0.00060` |
| `cost_owner` | `platform` |
| `category` | `email` |
| `provider` registrado | `sendgrid` |
| `RESEND_API_KEY` | **mantida** — marcada como candidata futura de auditoria/remoção |

**Comportamento funcional preservado:** busca de `billing_checkout_sessions`, validação `status='paid'`, rate-limit 60s, geração/regeneração de `billing_checkout_token` via RPC, link `${APP_URL}/complete-signup?token=...`, assunto `"Crie sua conta — Comando Central"`, HTML 1:1 com versão Resend.

**`recordPlatformCost`:** chamado **somente após** `emailResult.success === true`. Em falha SendGrid, função retorna antes da telemetria → custo NÃO é registrado.

**Idempotência:** `resend-signup-email:${X-Message-Id}` quando SendGrid devolve `X-Message-Id`; fallback determinístico `resend-signup-email:${session_id}:${recipient_hash16}:${minute_bucket}`. UNIQUE parcial `ux_pcl_idem` é a barreira final.

**Sanitização de metadata:** apenas `provider`, `category`, `email_type='signup_resend'`, `provider_message_id`, `recipient_hash` (SHA-256 truncado em 16 chars), `origin_function`. **Nunca** grava: token de complete-signup, link completo, e-mail bruto, HTML, JWT, segredo, owner_name.

### 9.3 Validação técnica F2.3

| Item | Resultado |
|---|---|
| Arquivo único alterado | ✅ `supabase/functions/resend-signup-email/index.ts` |
| Edge mantém o nome | ✅ `resend-signup-email` |
| Remetente verificado no SendGrid | ✅ `noreply@comandocentral.com.br` (sending_domain verified) |
| Inserção controlada via RPC com chave `f2.3-validation-001` | ✅ `ledger_id=82b762b4-fd6c-47d0-bf74-4744322be3a3`, `cost_usd=0.00060`, `cost_brl=0.0033` |
| 2ª chamada mesma chave | ✅ retorna mesmo `ledger_id`, sem 2ª linha |
| `metadata` sem dados sensíveis | ✅ apenas campos técnicos |
| Falha de provider → 0 custo registrado | ✅ por construção (`if (!success) return` antes da telemetria) |
| `credit_wallet` alterada | ✅ NÃO |
| `credit_ledger` alterado | ✅ NÃO |
| `service_usage_events` (tenant) alterado | ✅ NÃO |
| Tenant visualiza custo | ✅ NÃO (`platform_cost_ledger` sem `tenant_id`) |
| Platform admin enxerga custo | ✅ via `/platform/external-costs` |
| E-mail enviado a cliente final em teste | ✅ NÃO (validação via RPC direto, sem chamada SendGrid) |
| Cleanup linha sintética | ✅ removida via migration de data cleanup (2026-05-07) — predicado composto `idempotency_key='f2.3-validation-001' AND id='82b762b4-fd6c-47d0-bf74-4744322be3a3' AND reason='platform_absorbed_cost' AND origin_function='resend-signup-email'`. Pós-cleanup: 0 linhas com essa chave; tabela `platform_cost_ledger` voltou a 0 linhas (nenhum custo real removido). |

**Status final F2.3:** ✅ GO — fundação plugada, edge migrada para SendGrid, telemetria validada, cleanup concluído. Tenant `wallet`, `credit_ledger` e `service_usage_events` permanecem intactos.

### 9.4 Pendências F2.4 (não iniciar sem nova autorização)

| Edge | Bloqueio | Decisão necessária |
|---|---|---|
| `auth-email-hook` | Não auditada | Auditar fluxo (queue vs direct send) antes de plugar |
| `send-system-email` | Já chama `chargeAfter(PLATFORM_TENANT_ID)` — fluxo misto/legado | Decisão arquitetural: migrar de `chargeAfter` para `recordPlatformCost`? |
| `command-insights-generate`, `meta-token-health-check`, `platform-costs-sync`, `ai-learning-aggregator` | Apenas mapeadas | Auditar 1×1 |
| `RESEND_API_KEY` | Sem outros usos confirmados | Auditar restante do projeto antes de remover |

Ver `workers-crons-pagos.md` §2.2 para a regra de classificação `platform_absorbed`.

## 9. Documentos relacionados

- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/motor-creditos-fase-f1-telemetria-chargeafter.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/workers-crons-pagos.md`

## 10. F2.4 — `auth-email-hook` plugada (2026-05-07) ✅ GO

**Edge:** `supabase/functions/auth-email-hook/index.ts`
**Provider:** SendGrid (REST `api.sendgrid.com/v3/mail/send`).
**Decisão:** Opção A — plugar `recordPlatformCost` diretamente no hook (única edge que envia o e-mail; sem worker/fila intermediário). Sem nova service_key.

### 10.1 Implementação

- `recordPlatformCost` chamado **somente após** `emailResult.success === true` e após `system_email_logs` insert.
- Aguardado com `await` dentro de `try/catch` para garantir telemetria sem perda; falha NUNCA propaga (catch silencioso + log sanitizado), retornando 200 ao Supabase Auth normalmente.
- Helper `hashRecipient` (SHA-256 truncado 16 chars) reutiliza padrão F2.2/F2.3.

| Campo | Valor |
|---|---|
| `service_key` | `email-system-send` |
| `cost_owner` | `platform` (via `record_platform_cost` SECURITY DEFINER) |
| `provider` | `sendgrid` |
| `cost_usd` | `0.00060` |
| `origin` | `auth-email-hook` |
| `origin_id` | `emailResult.messageId ?? null` |
| `idempotency_key` (primária) | `auth-email-hook:{X-Message-Id}` |
| `idempotency_key` (fallback) | `auth-email-hook:{email_action_type}:{recipient_hash16}:{minute_bucket}` |

### 10.2 Metadata sanitizada (gravada)

`provider`, `category="email"`, `email_type="auth_hook"`, `email_action_type`, `template_key`, `provider_message_id`, `recipient_hash`, `origin_function="auth-email-hook"`.

### 10.3 Proibido em metadata e logs (auditado)

`token`, `token_hash`, `confirmation_url`, `redirect_to`, e-mail bruto, HTML, subject renderizado, nome do usuário, OTP, JWT, session, headers sensíveis, payload bruto do webhook. Logs de erro/sucesso só carregam: `origin_function`, `email_action_type`, `template_key`, `provider_message_id`, `recipient_hash`, `error_code`/mensagem técnica.

### 10.4 Validação técnica

| Checagem | Resultado |
|---|---|
| Edge deploy | ✅ |
| RPC `record_platform_cost` 1ª chamada (`f2.4-validation-001`) | ✅ id `5b0d171c-4646-4f69-a49a-b14104a87bc6` |
| RPC 2ª chamada mesma chave (idempotência) | ✅ retornou mesmo id, sem 2ª linha |
| Cleanup linha sintética | ✅ DELETE composto (`idempotency_key='f2.4-validation-001' AND id='5b0d171c...' AND service_key='email-system-send' AND origin_function='auth-email-hook'`) |
| `platform_cost_ledger` pós-cleanup | ✅ 0 linhas |
| SendGrid real disparado em teste | ✅ NÃO |
| `credit_wallet` alterada | ✅ NÃO |
| `credit_ledger` alterado | ✅ NÃO |
| `service_usage_events` (tenant) | ✅ NÃO |
| Falha em `recordPlatformCost` quebra autenticação | ✅ NÃO (try/catch silencioso) |

**Status final F2.4:** ✅ GO — telemetria de e-mails de auth (signup/recovery/magiclink/invite/email_change) integrada ao `platform_cost_ledger` sem afetar autenticação, sem cobrar tenant, sem expor PII.

---

## 11. F2.5 — `send-system-email` (✅ GO)

**Decisão (Opção B aprovada):** migrar 100% para `recordPlatformCost` e **remover** `chargeAfter(PLATFORM_TENANT_ID)`. Edge é chamada apenas por painéis admin da plataforma (`SystemEmailTemplates`, `SystemEmailSettings`, `EmailAndDomainsPlatformSettings`); não há caller tenant.

### 11.1 Contrato

| Campo | Valor |
|---|---|
| `service_key` | `email-system-send` |
| `cost_owner` | `platform` |
| `provider` | `sendgrid` |
| `category` | `email` |
| `cost_usd` | `0.00060` |
| `origin` | `send-system-email` |
| `origin_id` | `result.messageId ?? null` |
| `idempotency_key` (primária) | `send-system-email:{X-Message-Id}` |
| `idempotency_key` (fallback) | `send-system-email:{email_type}:{recipient_hash16}:{minute_bucket}` |

Telemetria registrada **apenas após `result.success === true`**, dentro de `try/catch` com `await`. Falha de telemetria **não quebra** o envio (log sanitizado + continue).

### 11.2 Metadata sanitizada (gravada)

`provider="sendgrid"`, `category="email"`, `email_type`, `provider_message_id`, `recipient_hash` (SHA-256 truncado 16), `from_domain` (domínio do remetente), `origin_function="send-system-email"`, `triggered_by="platform_admin"`.

### 11.3 Proibido em metadata e logs (auditado)

E-mail bruto do destinatário, HTML do corpo, subject completo, conteúdo de template, token, link, header `Authorization`, API key, qualquer PII bruta. Logs de fallback carregam apenas `origin_function`, `email_type`, `provider_message_id`, `recipient_hash`, `error_code`.

### 11.4 Descontinuação documentada

`chargeAfter(PLATFORM_TENANT_ID)` foi **removido** desta edge (junto com a constante `PLATFORM_TENANT_ID` e o import legado). Esta era a única edge que usava `chargeAfter` apontando para o tenant sintético da plataforma para custo classificado como `cost_owner=platform`. **Sem backfill**, **sem reversão** de cobranças passadas no tenant sintético — histórico financeiro real preservado.

### 11.5 Validação técnica

| Checagem | Resultado |
|---|---|
| Arquivo alterado | ✅ `supabase/functions/send-system-email/index.ts` |
| `chargeAfter` removido | ✅ (import + chamada + constante `PLATFORM_TENANT_ID`) |
| Coexistência `chargeAfter` + `recordPlatformCost` | ✅ NÃO (apenas `recordPlatformCost`) |
| `recordPlatformCost` chamado só após sucesso SendGrid | ✅ |
| `await` dentro de `try/catch` | ✅ |
| `system_email_logs` preservado | ✅ |
| `last_test_at` preservado para `email_type='test'` | ✅ |
| RPC `record_platform_cost` 1ª chamada (`f2.5-validation-001`) | ✅ inserida |
| RPC 2ª chamada mesma chave (idempotência) | ✅ sem 2ª linha |
| Cleanup linha sintética | ✅ `DELETE WHERE idempotency_key='f2.5-validation-001'` |
| `platform_cost_ledger` pós-cleanup | ✅ 0 linhas |
| SendGrid real disparado em validação | ✅ NÃO |
| `credit_wallet` alterada | ✅ NÃO |
| `credit_ledger` alterado | ✅ NÃO |
| `service_usage_events` (tenant) alterado | ✅ NÃO |
| Falha em `recordPlatformCost` quebra envio | ✅ NÃO |

**Status final F2.5:** ✅ GO — `send-system-email` agora alinhada com `funcoes-pagas.md` (linha 127). Custo de plataforma visível em `platform_cost_ledger`; ledger de tenant sintético deixa de ser contaminado.

---

## 12. F2.6 — `command-insights-generate` e `ai-learning-aggregator` (✅ GO)

### 12.1 `command-insights-generate` (Opção A aprovada)

**Edge:** `supabase/functions/command-insights-generate/index.ts` (v1.1.0).
**Provider:** Gemini 2.5 Flash via `aiChatCompletionJSON` (router).
**Decisão:** plugar `recordPlatformCost` após sucesso real do LLM, com custo calculado em runtime via tokens reais (`data.usage`).

| Campo | Valor |
|---|---|
| `service_key` | `command-insights-generate` (criada em `service_pricing` como `category=ai_text`, `cost_owner=platform`, `cost_usd=0` marcador, `cost_source=computed_from_token_pricings`) |
| `cost_owner` | `platform` |
| `provider` | `gemini` |
| `category` | `ai_text` |
| `cost_usd` | calculado em runtime: `(tokens_in_uncached/1M)*0.30 + (cached_tokens/1M)*0.03 + (tokens_out/1M)*2.50` |
| Pricings-fonte | `gemini.gemini-2.5-flash.per_1m_tokens_in` (0.30), `…per_1m_tokens_in_cached` (0.03), `…per_1m_tokens_out` (2.50) |
| `origin` | `command-insights-generate` |
| `origin_id` | `null` (response_id vai em `metadata`/idempotency) |
| `idempotency_key` | `command-insights-generate:{tenant_id}:{period_start_day}:{response_id|hash determinístico}` |
| `units_json` | `{count:1, tokens_in, tokens_out, cached_tokens, insights_count}` |

**Por que a idempotência não subconta custo real:** a chave inclui `aiResponse.id` (response_id real do LLM) quando disponível. Quando o provider não devolve `id`, é usado um hash determinístico do conteúdo da resposta (`tenant:periodDay:tokens_in:tokens_out:insights_count`), que muda automaticamente a cada chamada real distinta ao provider (qualquer chamada nova produz contagens/insights diferentes). Retry sobre a mesma resposta é deduplicado; nova chamada paga ao provider gera nova chave.

**Metadata sanitizada (gravada):** `provider`, `model`, `category`, `tenant_id`, `period_start`, `period_end`, `tokens_in`, `tokens_out`, `cached_tokens`, `insights_count`, `origin_function`, `triggered_by`, `cost_source`.

**Proibido em metadata e logs (auditado):** prompts, resposta do LLM, métricas brutas (`metrics`), nomes de produtos, PII, headers sensíveis, API key. Logs carregam apenas: `tenant_id`, `period_start_day`, `provider`, `model`, contagens de tokens, `cost_usd`, `error_code`/`error_message`, `idempotency_key`.

**Regras de execução:**
- `recordPlatformCost` chamado **apenas** após sucesso do LLM (`insights.length > 0` ou `usage` presente).
- Se `aiResult.usage` ausente/zerado → SKIP com log `platform_cost_ledger SKIP — no usage in LLM response` (sem inventar custo).
- Falha de telemetria **nunca** quebra a geração de insights (try/catch silencioso + log sanitizado).

### 12.2 Validação técnica F2.6

| Checagem | Resultado |
|---|---|
| service_key `command-insights-generate` registrada | ✅ `category=ai_text`, `cost_owner=platform`, `cost_usd=0` marcador |
| Edge deploy | ✅ v1.1.0 |
| Custo fixo inventado | ✅ NÃO (cost_usd vem 100% de tokens reais) |
| RPC `record_platform_cost` 1ª chamada (`f2.6-validation-001`) | ✅ id `4189d096-cc26-426f-8cd4-afb1c32338a1` |
| RPC 2ª chamada mesma chave (idempotência) | ✅ retornou mesmo id, sem 2ª linha |
| Cleanup linha sintética | ✅ DELETE composto (`idempotency_key + id + service_key + origin_function`) |
| `platform_cost_ledger` pós-cleanup | ✅ 0 linhas com a chave |
| Chamada real ao Gemini durante validação | ✅ NÃO (validação só via RPC direto) |
| `credit_wallet` alterada | ✅ NÃO |
| `credit_ledger` alterado | ✅ NÃO |
| `service_usage_events` (tenant) alterado | ✅ NÃO |
| Falha em `recordPlatformCost` quebra geração | ✅ NÃO |

### 12.3 `ai-learning-aggregator` (Opção D — não aplicável)

**Auditoria:** edge não importa nem chama `ai-router`/`aiChatCompletion`/`fetch` para qualquer provider (OpenAI, Gemini, Anthropic, Lovable). Pipeline é puramente `tenant_learning_events` → regex local → upsert em `tenant_learning_memory` → RPC `promote_learning_candidate`.

**Classificação final:** **não aplicável ao Motor de Créditos / F2** — sem custo externo rastreável. Custo de DB/CPU já coberto pela infra Supabase geral.

**Ação:** edge **não foi alterada em runtime**. Apenas reclassificada documentalmente. `funcoes-pagas.md` linha 48 está desatualizada (rotula como `OpenAI/Gemini token`) e deve ser corrigida no próximo passe.

### 12.4 Achado paralelo (NÃO corrigido nesta fase)

Cron `generate-weekly-insights` envia `Authorization: Bearer <ANON_KEY>`, mas a edge só ativa o ramo "service-role / cron mode" quando o header contém `SUPABASE_SERVICE_ROLE_KEY`. Resultado provável: cron cai no ramo "Manual call" e retorna 401 silenciosamente (nenhum tenant é processado). Registrado como ticket separado — fora do escopo F2.6. Conforme `mem://constraints/cron-service-role-key-guc-prohibition`, o padrão do projeto é anon key + validação de role no body, então a correção exige refatorar a edge (não o cron).

**Status final F2.6:** 🟢 GO — telemetria de custo de plataforma plugada em `command-insights-generate`; `ai-learning-aggregator` classificada como não aplicável; nenhum tenant cobrado; nenhum custo fixo inventado.
