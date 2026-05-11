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

---

## 13. Evidência F2.6 — 2026-05-07 (validação funcional real ponta a ponta)

Validação funcional real (Opção A) executada após GO técnico da seção 12. Chamada real à edge `command-insights-generate` com Gemini real, em escopo controlado.

### 13.1 Escopo

| Item | Valor |
|---|---|
| Tenant | Respeite o Homem |
| `tenant_id` | `d1a4d0ed-8842-495e-b741-540a9a345b25` |
| Período analisado | `2026-04-30 00:00:00Z` → `2026-05-07 23:59:59Z` |
| Insights pré-existentes no período | 0 (sem skip, sem overwrite) |
| Provider / Model | `gemini` / `gemini-2.5-flash` |
| Cron tocado? | NÃO |
| Auth tocada? | NÃO |
| UI tocada? | NÃO |
| Tenants processados | 1 (apenas o piloto) |

### 13.2 Resultado da 1ª chamada real

| Item | Valor |
|---|---|
| HTTP | 200 |
| `insights_generated` | 4 |
| `tokens_in` | 564 |
| `tokens_out` | 313 |
| `cached_tokens` | 0 |
| `cost_usd` | `0.00095170` (computed_from_token_pricings) |
| `cost_brl` | `0.0052` (fx 5,50) |
| `pricing_id` | `f64f8049-ced5-4fcb-8c7b-8391844cb2b2` (catálogo, sem custo fixo inventado) |

**Linha real em `platform_cost_ledger`:**

| Campo | Valor |
|---|---|
| `id` | `4f496e29-af52-430b-a64c-2cad148ff69c` |
| `service_key` | `command-insights-generate` |
| `category` | `ai_text` |
| `provider` | `gemini` |
| `idempotency_key` | `command-insights-generate:d1a4d0ed…:2026-04-30:wAv8afqaB5CIvdIP4rbJsAg` (response_id real Gemini) |
| `units_json` | `{count:1, tokens_in:564, tokens_out:313, cached_tokens:0, insights_count:4}` |
| `metadata` | sanitizada — sem prompt, sem resposta LLM, sem métricas brutas, sem PII, sem nomes de produto |

### 13.3 Validação de idempotência (sem custo extra)

2ª chamada real à edge com mesmo tenant/período:
- HTTP 200, `insights_generated: 0`
- Guard `existing insights for period` (linhas 96-106 do `index.ts`) bloqueou **antes** de qualquer chamada ao Gemini.
- `platform_cost_ledger` continuou com **1 linha** (sem duplicação).
- Nenhuma chamada paga ao provider na 2ª invocação.

### 13.4 Isolamento tenant ↔ plataforma

| Verificação | Resultado |
|---|---|
| `credit_wallet` alterada | NÃO |
| `credit_ledger` (tenant) com novas linhas | NÃO (0 nas últimas 10min) |
| `service_usage_events` (tenant) com novas linhas | NÃO (0 nas últimas 10min) |
| Tenant cobrado | NÃO |
| `/platform/credits` enxerga o evento (admin, `includePlatform=true`) | SIM |
| `/platform/external-costs` íntegro | SIM (escopo distinto, sem impacto) |

### 13.5 Confirmações finais

- **`ai-learning-aggregator`** confirmado como **não aplicável** ao Motor de Créditos (sem provider externo). Reclassificação documental, edge sem alteração em runtime.
- **Achado paralelo — cron `generate-weekly-insights`**: anomalia anon key vs service-role permanece como ticket separado. **NÃO corrigido nesta fase.**
- **Achado paralelo — `get_auth_user_email`**: `permission denied` na tela de Templates de E-mail registrado como task separada (`b70aa82b`). **NÃO corrigido nesta fase.**

### 13.6 Status final

🟢 **F2.6 — GO funcional confirmado.**
Telemetria de plataforma real, idempotente, sanitizada, isolada do tenant, com custo calculado por tokens reais e linha rastreável em `platform_cost_ledger`.

---

## 14. F2.7 — `meta-token-health-check` e `platform-costs-sync` (✅ GO documental — 2026-05-08)

### 14.1 Escopo

Auditar 1×1 as duas edges remanescentes mapeadas em §11 (linha "Apenas mapeadas — Auditar 1×1") para definir se entram no Motor de Créditos via `recordPlatformCost`, se ficam pendentes ou se devem ser classificadas como **não aplicáveis**.

Etapa **somente documental** — sem alteração de código, sem chamada a provider real, sem alteração de `platform_cost_ledger`, `credit_ledger`, `credit_wallet`, `service_usage_events`, RPC, RLS, UI, wallet ou qualquer evento financeiro.

### 14.2 `meta-token-health-check` — auditoria

| Item | Resultado |
|---|---|
| O que faz | Itera `tenant_meta_auth_grants` ativos, descriptografa token via RPC, faz GET `/me?fields=id` na Meta Graph API; marca `expired` quando recebe erro 190/102. |
| Caller(s) | Cron `meta-token-health-check-daily` (`0 4 * * *` UTC) + chamada manual admin documentada em `hub-integracoes.md`. **Nenhum caller no front-end.** |
| Tipo | Cron de plataforma global + admin manual. |
| `tenant_id` no fluxo | Sim por grant, mas a operação é da **plataforma** (cron global). Não há tenant a ser cobrado. |
| Provider/API | Meta Graph API — endpoint `/me?fields=id`. |
| Custo monetário | **Zero.** A Graph API não cobra por chamada (rate-limit only). Marketing API/spend de anúncios é outro produto, não usado aqui. |
| `service_pricing` existente | Nenhuma chave aplicável. |
| Helper de cobrança chamado hoje | Nenhum. |
| Registros existentes em ledger | `platform_cost_ledger` count=0 para qualquer chave correlata. |
| Risco se plugar `recordPlatformCost` | Alto — uma execução do cron iteraria N grants e geraria N linhas de custo zero, poluindo o ledger sem benefício. |
| Dados sensíveis | Token é decifrado em memória e enviado na querystring para a Meta. **Logs atuais não imprimem o token** (apenas `grantId`, `tenantId`, `error code/subcode`, mensagem truncada em 500). OK. |

**Classificação final:** **Não aplicável** ao Motor de Créditos.

### 14.3 `platform-costs-sync` — auditoria

| Item | Resultado |
|---|---|
| O que faz | Lê `platform_external_costs` (`is_active=true AND sync_mode='auto'`); para cada serviço com adapter registrado, consulta o saldo. **Hoje único adapter:** `sendgrid` → GET `https://api.sendgrid.com/v3/user/credits`. |
| Caller(s) | Cron `platform-costs-sync-6h` (`0 */6 * * *` UTC) + botão admin no painel `/platform/external-costs` via `usePlatformExternalCosts.ts`. **Nenhum caller tenant.** |
| Tipo | Cron de plataforma + admin manual. |
| `tenant_id` no fluxo | Não — saldo é agregado da conta SaaS na SendGrid. |
| Provider/API | SendGrid `/v3/user/credits` (apenas leitura). |
| Custo monetário | **Zero.** A consulta de saldo SendGrid não é faturada. O custo real do envio de e-mail já é registrado no edge `send-system-email` (F2.5 ✅). |
| `service_pricing` existente | Nenhuma chave para o ato de "sync". E não deve existir — emissão de e-mail tem suas próprias chaves. |
| Helper de cobrança chamado hoje | Nenhum. |
| Registros existentes em ledger | `platform_cost_ledger` count=0 para a chave. |
| Risco se plugar `recordPlatformCost` no orquestrador | Alto — 4 execuções/dia × N adapters = poluição com linhas de custo zero. Risco adicional de dupla cobrança no futuro se algum adapter passar a fazer emissão real. |
| Dados sensíveis | `SENDGRID_API_KEY` no header Authorization. Logs atuais não imprimem a chave. `last_sync_error` recebe `e.message` cru — sem scrub de `Bearer\s+\S+`. Risco baixo hoje; **registrado como melhoria futura** (não aplicar nesta fase). |

**Classificação final:** **Não aplicável** ao Motor de Créditos no nível do orquestrador.

### 14.4 Regra oficial F2.7 — quando NÃO registrar custo no `platform_cost_ledger`

> **Health check, refresh OAuth, sync de saldo e consulta de status NÃO entram em `platform_cost_ledger`** quando forem apenas consulta/renovação/status e não gerarem cobrança monetária do provider.
>
> **O custo deve ser registrado somente no edge/adapter que emite o evento cobrável** — envio de e-mail, mensagem WhatsApp, emissão fiscal, chamada IA paga etc.

### 14.5 Regra oficial F2.7 — adapters futuros de `platform-costs-sync`

> Cada novo adapter de `platform-costs-sync` deve ser **auditado individualmente** antes de ser ativado:
>
> - Se for **apenas consulta de saldo/status**, não registra custo (segue a regra §14.4).
> - Se executar **evento cobrável**, o custo deve ser registrado no **ponto específico do adapter/evento cobrável**, nunca no orquestrador genérico.
>
> O orquestrador `platform-costs-sync` permanece neutro em relação a custo.

### 14.6 Pendências futuras registradas (fora do escopo F2.7)

1. **Auditoria 1×1 dos demais refresh-cron de OAuth** (`meta-token-refresh`, `meli-token-refresh`, `tiktok-token-refresh-cron`, `shopee-token-refresh`, `whatsapp-token-healthcheck-daily`) — provavelmente também não aplicáveis, mas precisam de auditoria formal (sugerido como F2.8 PLANNER).
2. **Novos adapters em `platform-costs-sync`** (ex.: Nuvem Fiscal previsto para Onda 2 do painel external-costs) — abrir auditoria pontual no momento da inclusão.
3. **Melhoria de segurança/logs:** avaliar sanitização adicional de `last_sync_error` em `platform-costs-sync` (scrub de `Bearer\s+\S+` e truncamento explícito ≤500 chars). Não aplicar agora.

### 14.7 Confirmações de não-impacto (validações obrigatórias F2.7)

| Item | Resultado |
|---|---|
| Código alterado | NÃO |
| Migration criada | NÃO |
| RPC alterada | NÃO |
| RLS alterada | NÃO |
| `service_pricing` inserido/alterado | NÃO |
| `platform_cost_ledger` alterado | NÃO |
| `credit_wallet` alterada | NÃO |
| `credit_ledger` alterado | NÃO |
| `service_usage_events` alterado | NÃO |
| UI alterada | NÃO |
| Provider real chamado | NÃO |
| Sincronização real disparada | NÃO |
| `mem://constraint` criada | NÃO (decisão do operador) |
| Docs oficiais atualizados | SIM (`funcoes-pagas.md` §3.11; este doc §14) |

### 14.8 Status final F2.7

🟢 **F2.7 — GO documental confirmado.**

`meta-token-health-check` e `platform-costs-sync` (orquestrador) classificadas como **não aplicáveis** ao Motor de Créditos. Regra "consulta/status não cobra; emissão cobra" registrada como padrão oficial. Pendências futuras catalogadas. Nenhuma alteração de runtime, ledger, wallet, evento ou UI executada.

**Próximo passo recomendado (não executado):** abrir **F2.8 em modo PLANNER** para auditar 1×1 os refresh-cron OAuth restantes (`meta-token-refresh`, `meli-token-refresh`, `tiktok-token-refresh-cron`, `shopee-token-refresh`, `whatsapp-token-healthcheck-daily`).

---

## 15. F2.8 — Refresh OAuth e health check de integrações (✅ GO documental — 2026-05-11)

### 15.1 Objetivo

Auditar 1×1 as 5 edges de refresh/health check de integrações listadas como pendência futura em §14.6, decidindo se entram em `platform_cost_ledger` ou são classificadas como **não aplicáveis**.

Edges auditadas:
- `meta-token-refresh`
- `meli-token-refresh`
- `tiktok-token-refresh-cron`
- `shopee-token-refresh`
- `whatsapp-token-healthcheck` (referido no prompt original como `whatsapp-token-healthcheck-daily`; o nome real no repo é sem sufixo `-daily`)

### 15.2 Evidência por edge

#### 15.2.1 `meta-token-refresh`
| Item | Evidência |
|---|---|
| Função | Renova long-lived token Meta via Graph `fb_exchange_token`; modo single-tenant ou batch (grants expirando em <7 dias). |
| Trigger | Cron diário (`refreshAll: true`) + chamada manual admin/tenant ao reconectar. |
| Provider | Meta Graph API `/oauth/access_token`. |
| Chamada externa | Sim. |
| Cobrança monetária | **Não** — endpoint OAuth Meta é gratuito; consome apenas app-level rate limit. |
| service_key / pricing | Não existe. |
| Helpers de cobrança no código | Nenhum (`recordPlatformCost`/`chargeAfter`/`withCreditMotor` ausentes). |
| Risco se plugar `recordPlatformCost` | Alto — batch diário multiplicaria N tenants × custo zero. |
| Risco logs/secret | Médio — `console.error` registra `errorMsg` Meta sem truncar/scrub; tokens ficam em querystring (não logada explicitamente). |

#### 15.2.2 `meli-token-refresh`
| Item | Evidência |
|---|---|
| Função | Refresh OAuth Mercado Livre (`/oauth/token`, grant_type=refresh_token), single ou batch (expira <2h). |
| Trigger | Cron + chamada manual via `connectionId`. |
| Provider | Mercado Livre OAuth. |
| Chamada externa | Sim. |
| Cobrança monetária | **Não** — OAuth ML é gratuito. |
| service_key / pricing | Não existe. |
| Helpers de cobrança | Nenhum. |
| Risco logs/secret | **Alto** — `last_error` no DB armazena `errorData` integral sem truncar; `console.error('Erro para X:', errorData)` despeja resposta crua da API ML. |

#### 15.2.3 `tiktok-token-refresh-cron`
| Item | Evidência |
|---|---|
| Função | Renova tokens TikTok Ads + Shop + Content que expiram em <6h, em batch (3 tabelas). |
| Trigger | pg_cron a cada 6h. |
| Provider | TikTok Business API + TikTok Shop Auth API. |
| Chamada externa | Sim. |
| Cobrança monetária | **Não** — refresh OAuth gratuito em ambos. |
| service_key / pricing | Não existe. |
| Helpers de cobrança | Nenhum. |
| Risco logs/secret | Baixo-Médio — `last_error` recebe `err.message` cru sem truncar. |

#### 15.2.4 `shopee-token-refresh`
| Item | Evidência |
|---|---|
| Função | Refresh OAuth Shopee (HMAC-SHA256 assinado em `/api/v2/auth/access_token/get`), single ou batch (<2h). |
| Trigger | Cron + manual. |
| Provider | Shopee Open Platform. |
| Chamada externa | Sim. |
| Cobrança monetária | **Não** — OAuth Shopee é gratuito. |
| service_key / pricing | Não existe. |
| Helpers de cobrança | Nenhum. |
| Risco logs/secret | **Alto** — `last_error` armazena `Refresh failed: ${errorData}` integral; URL com `sign=` HMAC é construída mas não logada explicitamente. |

#### 15.2.5 `whatsapp-token-healthcheck`
| Item | Evidência |
|---|---|
| Função | Health check diário de todos `whatsapp_configs` ativos via Meta Graph `/me?access_token=...`; marca `token_invalid` quando código 190. |
| Trigger | Cron diário. |
| Provider | Meta Graph API. |
| Chamada externa | Sim. |
| Cobrança monetária | **Não** — `/me` é gratuito (rate limit app-level). |
| service_key / pricing | Não existe. |
| Helpers de cobrança | Nenhum. |
| Risco logs/secret | **Crítico** — `access_token` vai na querystring do fetch; `details[]` retornado na resposta do cron pode incluir mensagens Meta com contexto sem truncar. |

### 15.3 Tabela comparativa final

| Edge | Trigger | Provider | Cobrado? | service_key | Helpers | Risco log | Classificação |
|---|---|---|---|---|---|---|---|
| meta-token-refresh | Cron + manual | Meta OAuth | Não | — | — | Médio | **D — não aplicável** |
| meli-token-refresh | Cron + manual | ML OAuth | Não | — | — | Alto (last_error cru) | **D — não aplicável** |
| tiktok-token-refresh-cron | Cron 6h | TikTok Biz/Shop | Não | — | — | Baixo-Médio | **D — não aplicável** |
| shopee-token-refresh | Cron + manual | Shopee OAuth | Não | — | — | Alto (last_error cru) | **D — não aplicável** |
| whatsapp-token-healthcheck | Cron diário | Meta Graph `/me` | Não | — | — | Crítico (token na URL) | **D — não aplicável** |

### 15.4 Regra oficial F2.8 (extensão da regra F2.7 §14.4)

> **Refresh OAuth, health check, validação de token, consulta de status e sync de saldo NÃO entram em `platform_cost_ledger`** quando forem apenas consulta/renovação/status/healthcheck e não gerarem cobrança monetária direta do provider em USD/BRL.
>
> O custo deve ser registrado **apenas** no edge/adapter que emite o evento cobrável (envio de e-mail, emissão de NFe, envio de mensagem WhatsApp, geração LLM real, etc.), nunca no fluxo de manutenção/observabilidade da conexão.

Essa regra estende formalmente a regra de §14.4 e §14.5 a todos os fluxos OAuth/healthcheck do sistema.

### 15.5 Riscos de rate limit (observabilidade — não cobrança)

- **Meta (refresh + healthcheck):** mesmo app, somam contra app-level rate limit; risco real se nº de tenants crescer significativamente.
- **Mercado Livre / Shopee / TikTok:** rate limit por app/partner_id; sem custo monetário.
- **Ação:** monitoramento operacional, sem qualquer impacto no Motor de Créditos.

### 15.6 Riscos de log / vazamento de segredo (hardening — backlog separado)

Riscos identificados nesta auditoria **continuam válidos** como backlog de segurança/hardening, mesmo com as 5 edges classificadas como não aplicáveis ao Motor de Créditos. Eles **não foram corrigidos nesta entrega**.

| Edge | Risco | Observação |
|---|---|---|
| meta-token-refresh | `errorMsg` Meta sem truncar/scrub | Médio |
| meli-token-refresh | `last_error` recebe `errorData` cru | Alto |
| tiktok-token-refresh-cron | `last_error` recebe `err.message` cru | Baixo-Médio |
| shopee-token-refresh | `last_error` recebe `errorData` cru | Alto |
| whatsapp-token-healthcheck | `access_token` na URL + `details[]` cru na resposta do cron | Crítico |

**Reforço explícito:** a classificação "não aplicável ao Motor de Créditos" **não foi usada para ignorar** esses riscos. Eles ficam pendentes em backlog de hardening (§15.7) para tratamento separado.

### 15.7 Pendências futuras registradas (fora do escopo F2.8)

1. **Padrão compartilhado de scrub & truncate** em `_shared/` para `last_error` e logs de OAuth (truncar 500 chars + regex de `Bearer\s+\S+`, `access_token=\S+`, `refresh_token=\S+`, `client_secret=\S+`, `sign=\S+`, `partner_key=\S+`).
2. **Sanitização de `last_error`** em `marketplace_connections`, `tiktok_*_connections` e `whatsapp_configs` (aplicar truncate + scrub antes do persist).
3. **`whatsapp-token-healthcheck`:** mover token de querystring para header `Authorization: Bearer` (Meta aceita) e enxugar `details[]` na resposta retornada pelo cron.
4. **Auditoria futura** de `google-token-refresh`, `google-token-refresh-cron` e `health-check-run` (sugerido como **F2.9 PLANNER**). `health-check-run` pode envolver chamadas externas reais e exige auditoria cuidadosa.
5. **Telemetria sem cobrança** opcional: se quisermos métricas de saúde de refresh, criar registros em `service_usage_events` com `cost_usd=0`/`is_billable=false`, **separados** do ledger — decisão futura, não nesta onda.

### 15.8 Confirmações de não-impacto (validações obrigatórias F2.8)

| Validação | Resultado |
|---|---|
| Código de runtime alterado | NÃO |
| Migration criada | NÃO |
| RPC alterado | NÃO |
| RLS alterada | NÃO |
| service_key criada | NÃO |
| Preço aprovado | NÃO |
| Custo registrado em `platform_cost_ledger` | NÃO |
| `credit_ledger` / `credit_wallet` alterado | NÃO |
| `service_usage_events` alterado | NÃO |
| Provider real chamado | NÃO |
| Refresh real executado | NÃO |
| Token alterado | NÃO |
| UI alterada | NÃO |
| `mem://constraint` criada | NÃO (decisão do operador) |
| Sanitização de logs aplicada | NÃO (movida para backlog §15.7) |
| Token do WhatsApp movido para header | NÃO (movida para backlog §15.7) |
| Docs oficiais atualizados | SIM (`funcoes-pagas.md` §3.11; este doc §15) |
| `workers-crons-pagos.md` revisado | SIM — nenhuma das 5 edges estava classificada como paga; sem alteração necessária. |

### 15.9 Status final F2.8

🟢 **F2.8 — GO documental confirmado.**

As 5 edges (`meta-token-refresh`, `meli-token-refresh`, `tiktok-token-refresh-cron`, `shopee-token-refresh`, `whatsapp-token-healthcheck`) classificadas como **não aplicáveis** ao Motor de Créditos. Regra "refresh OAuth / healthcheck / consulta de status não cobra; emissão cobra" registrada como padrão oficial estendendo §14.4. Riscos de log/secret catalogados como backlog separado de hardening (§15.7), sem correção nesta execução. Nenhuma alteração de runtime, ledger, wallet, evento, token, UI, RPC ou RLS executada.

**Próximo passo recomendado (não executado):** abrir **F2.9 em modo PLANNER** para auditar `google-token-refresh`, `google-token-refresh-cron` e `health-check-run`. Atenção especial a `health-check-run`, que pode envolver chamadas externas reais e merece auditoria cuidadosa antes de classificação.

---

## 16. F2.9 — `google-token-refresh`, `google-token-refresh-cron` e `health-check-run` (✅ GO documental — 2026-05-11)

### 16.1 Objetivo

Auditar 1×1 as 3 edges listadas como pendência futura em §15.7, decidindo se entram em `platform_cost_ledger` ou são classificadas como **não aplicáveis**.

### 16.2 Evidências por edge

#### 16.2.1 `google-token-refresh`
- **O que faz:** renova `access_token` Google de **um tenant específico** via `https://oauth2.googleapis.com/token` (`grant_type=refresh_token`). Early-return se token ainda válido por >5 min.
- **Quem chama:** admin/tenant ao reconectar; edges Google internas (Ads, Drive, Calendar, YouTube) que precisam de access_token vivo.
- **Provider externo:** Google OAuth 2.0.
- **Cobrança monetária:** **Não.** Endpoint OAuth Google é gratuito; consome apenas quota OAuth por `client_id`.
- **`service_key` / pricing:** não existem.
- **Helpers de cobrança presentes:** nenhum (`recordPlatformCost`/`chargeAfter`/`withCreditMotor` ausentes).
- **Tokens/secrets no fluxo:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `refresh_token`, `access_token`.
- **Risco de log:** **Alto.** `console.error('Refresh failed:', tokenData)` despeja JSON cru da Google; `last_error = errorMsg` em `google_connections` armazena `error_description` integral sem truncar. Tratado em backlog F2.9.1 (§16.6).
- **Classificação F2.9:** **D — não aplicável** ao `platform_cost_ledger`.

#### 16.2.2 `google-token-refresh-cron`
- **O que faz:** renova `access_tokens` de **todas** as `google_connections` ativas que expiram nos próximos 10 min. Cron a cada 5 min.
- **Quem chama:** scheduler/`pg_cron`.
- **Provider externo:** Google OAuth 2.0 (mesmo endpoint).
- **Cobrança monetária:** **Não.** Consome quota OAuth Google.
- **`service_key` / pricing:** não existem.
- **Helpers de cobrança presentes:** nenhum.
- **Tokens/secrets no fluxo:** idem `google-token-refresh`. Lógica especial: marca `connection_status='expired'` em `invalid_grant`.
- **Risco de log:** **Alto.** `errors[]` retornado integralmente na response do cron contém `errorBody` cru de Google. Tratado em backlog F2.9.1 (§16.6).
- **Classificação F2.9:** **D — não aplicável** ao `platform_cost_ledger`.

#### 16.2.3 `health-check-run`
- **O que faz:** orquestrador de observabilidade. Itera `system_health_check_targets.is_enabled=true` e roda 4 suítes em paralelo por target: `domains`, `checkout_tracking`, `coupons`, `payments` (esta última com `dry_run: true`). Persiste em `system_health_checks`, emite eventos em `events_inbox` quando `fail`.
- **Quem chama:** cron + admin manual.
- **Providers externos chamados (estado atual):**
  - **Suíte A (domains):** `fetch` HTTP GET no `storefront_base_url` e `shops_base_url` (Cloudflare/origin público). Sem cobrança.
  - **Suíte B (checkout_tracking):** chamadas internas a `checkout-session-start`, `-heartbeat`, `-end` (com `cart_id=health-check-${ts}`, `total_estimated=0`, items vazios). Sem provider pago, mas gera linhas reais em `checkout_sessions`. Risco controlado: ver backlog F2.9.2 (§16.6).
  - **Suíte C (coupons):** chamada interna a `discount-validate`. Sem provider externo pago.
  - **Suíte D (payments):** chamada a `reconcile-payments` com `dry_run: true`. Sem cobrança no provider externo, **desde que `dry_run` seja respeitado em todos os caminhos** (a confirmar — backlog F2.9.2).
- **Cobrança monetária no estado atual:** **Não.** Nenhuma chamada a SendGrid, Meta WhatsApp, Focus NFe, LLM, Fal/OpenAI, scraping ou Frenet.
- **`service_key` / pricing:** não existem.
- **Helpers de cobrança presentes:** nenhum.
- **Tokens/secrets no fluxo:** apenas `SUPABASE_SERVICE_ROLE_KEY` em headers Authorization para edges internas; nenhum token de provider externo.
- **Risco de log:** **Baixo.** Não loga Authorization; `events_inbox.payload_raw` contém apenas labels e nomes de suítes.
- **Classificação F2.9:** **D — não aplicável** ao `platform_cost_ledger` **no estado atual das suítes**, com regra de governança vinculante em §16.4.

### 16.3 Tabela comparativa F2.9

| Edge | Trigger | Provider externo | Cobrado? | service_key | Helpers | Risco log | Classificação |
|---|---|---|---|---|---|---|---|
| `google-token-refresh` | Manual + worker | Google OAuth | Não | — | — | Alto (backlog F2.9.1) | **D — não aplicável** |
| `google-token-refresh-cron` | Cron 5 min | Google OAuth | Não | — | — | Alto (backlog F2.9.1) | **D — não aplicável** |
| `health-check-run` | Cron + admin | Storefront público + edges internas | Não (estado atual) | — | — | Baixo | **D — não aplicável (estado atual das suítes)** |

### 16.4 Regra oficial F2.9 — governança específica de `health-check-run`

> **Qualquer nova suíte adicionada ao `health-check-run` deve passar por auditoria F2 antes de merge. É proibido adicionar suíte que chame provider pago, IA, fiscal, WhatsApp, envio real, scraping, gateway, LLM ou qualquer operação cobrável sem auditoria e classificação de custo.**

A classificação D de `health-check-run` vale **somente para o conjunto atual de suítes**. Ampliação de escopo reabre obrigatoriamente a auditoria.

### 16.5 Regra oficial F2.9 — extensão das regras §14.4 e §15.4

A regra "refresh OAuth / healthcheck / consulta de status não cobra; emissão cobra" — formalizada em §14.4 (F2.7) e estendida em §15.4 (F2.8) — **abrange também** os refresh OAuth Google (`google-token-refresh`, `google-token-refresh-cron`) e os orquestradores de observabilidade interna (`health-check-run`), desde que estes últimos não chamem provider externo pago.

### 16.6 Pendências futuras registradas (fora do escopo F2.9)

1. **F2.9.1 — Hardening de logs Google OAuth:** aplicar padrão `scrub & truncate` (§15.7 item 1) em `google-token-refresh` e `google-token-refresh-cron`:
   - truncar `tokenData`/`errorBody` em `console.error`;
   - truncar `last_error` (`slice(0,500)`) em `google_connections`;
   - parar de retornar `errors[]` integral na response do cron (manter apenas counters; persistir detalhes truncados em `last_error`).
2. **F2.9.2 — Auditoria `reconcile-payments` `dry_run` + isolamento `cart_id=health-check-*`:** confirmar que `reconcile-payments` respeita `dry_run` em **todos** os caminhos (sem tocar gateway real); garantir que `cart_id` no padrão `health-check-*` seja excluído de qualquer trigger de carrinho/abandono/abandono-pixel para evitar virar pedido fake.
3. **Auditoria futura (sugerida F2.10 PLANNER):** `health-monitor-admin`, `meta-whatsapp-monitor-all`, `whatsapp-orphan-watcher` e `whatsapp-cross-business-detector` (todos hoje listados em §3.11 de `funcoes-pagas.md` sem auditoria formal completa).

**Reforço explícito:** a classificação "não aplicável ao Motor de Créditos" **não foi usada para ignorar** os riscos de log catalogados acima. Eles ficam pendentes em backlog separado de hardening (§16.6.1) para tratamento posterior.

### 16.7 Confirmações de não-impacto (validações obrigatórias F2.9)

| Item | Status |
|---|---|
| Código de runtime alterado | NÃO |
| Migration criada | NÃO |
| RPC alterada | NÃO |
| RLS alterada | NÃO |
| `service_key` criada | NÃO |
| Preço aprovado | NÃO |
| Custo registrado em `platform_cost_ledger` | NÃO |
| Provider real chamado | NÃO |
| Refresh OAuth Google executado | NÃO |
| Health check real executado | NÃO |
| Token alterado/girado | NÃO |
| Wallet/`credit_ledger`/`service_usage_events` alterados | NÃO |
| UI alterada | NÃO |
| `mem://` ou Knowledge novos criados | NÃO |
| Hardening de logs Google aplicado | NÃO (movido para backlog §16.6 — F2.9.1) |
| Auditoria `reconcile-payments` `dry_run` executada | NÃO (movida para backlog §16.6 — F2.9.2) |
| Docs oficiais atualizados | SIM (`funcoes-pagas.md` §3.11; este doc §16) |
| `workers-crons-pagos.md` revisado | SIM — nenhuma alteração necessária (as 3 edges não estavam classificadas como pagas no doc; os exemplos de `platform_absorbed` em §2.2 permanecem coerentes) |

### 16.8 Status final F2.9

🟢 **F2.9 — GO documental confirmado.**

`google-token-refresh`, `google-token-refresh-cron` e `health-check-run` classificadas como **não aplicáveis** ao Motor de Créditos. Para `health-check-run`, a classificação vale **somente para o conjunto atual de suítes** e fica vinculada à regra de governança §16.4 (suítes futuras exigem auditoria F2 prévia). Riscos de log Google e auditoria de `reconcile-payments dry_run` catalogados como backlog separado (F2.9.1 e F2.9.2 em §16.6), sem correção nesta execução. Nenhuma alteração de runtime, ledger, wallet, evento, token, UI, RPC ou RLS executada.

**Próximo passo recomendado (não executado):** abrir **F2.10 em modo PLANNER** para auditar `health-monitor-admin`, `meta-whatsapp-monitor-all`, `whatsapp-orphan-watcher` e `whatsapp-cross-business-detector` (candidatos hoje listados em `funcoes-pagas.md` §3.11 sem auditoria formal).

---

## 17. F2.10 — Auditoria de monitores administrativos (health + WhatsApp/Meta)

**Data:** 2026-05-11  
**Modo:** PLANNER → EXECUÇÃO documental  
**Edges auditadas:** `health-monitor-admin`, `meta-whatsapp-monitor-all`, `whatsapp-orphan-watcher`, `whatsapp-cross-business-detector`.

### 17.1 Contexto

Encerrando o lote de monitores não aplicáveis ao Motor de Créditos. Todas as 4 edges são observabilidade ou auto-reparo administrativo gratuito: nenhuma chama operação cobrável de provider externo no estado atual.

### 17.2 Evidência por edge

#### 17.2.1 `health-monitor-admin`
- **Tipo:** endpoint admin (validação por `platform_admins`).
- **Provider externo:** nenhum. Apenas `SELECT` em `system_health_checks`, `system_health_check_targets` e `storefront_runtime_violations` via service role.
- **Custo monetário:** zero.
- **Helpers de cobrança:** nenhum.
- **Risco de log:** baixo — loga `user.email` em info/warn (PII operacional admin, não credencial).
- **Classificação:** **D — não aplicável.**
- **Herança de governança:** se um dia ganhar `action=run_now` ou disparar `health-check-run` / outra edge cobrável, exige reauditoria F2 (regra §16.4).

#### 17.2.2 `meta-whatsapp-monitor-all`
- **Tipo:** cron diário.
- **Provider externo:** Meta Graph **administrativo** indireto via `meta-whatsapp-diagnose` (`/me`, `/{phone_number_id}`, `/{app_id}/subscriptions`, `/{waba_id}/subscribed_apps`) e `meta-whatsapp-recover` (`/{waba_id}/subscribed_apps` POST, `/{phone_number_id}/deregister`, `/{phone_number_id}/register`).
- **Operações cobráveis Meta (`/messages`, template, conversa):** **NENHUMA**. Endpoints administrativos Meta Graph são gratuitos.
- **Custo monetário:** zero no estado atual.
- **Helpers de cobrança:** nenhum.
- **Risco de rate limit:** Meta App-level — baixo hoje (cron diário × N tenants); merece atenção em escala.
- **Risco de log:** médio — `summary.details[].result = rec?.data` cru pode vazar IDs Meta. `register_pin` trafega em body service-to-service (baixo risco, não loga).
- **Classificação:** **D — não aplicável (estado atual).**

#### 17.2.3 `whatsapp-orphan-watcher`
- **Tipo:** cron a cada 15 min.
- **Provider externo:** nenhum. Apenas `SELECT/UPDATE/INSERT` em `whatsapp_inbound_messages` e `whatsapp_health_incidents`.
- **Custo monetário:** zero.
- **Helpers de cobrança:** nenhum.
- **Risco de log:** médio — `from_phone` aparece em log e é persistido em `whatsapp_health_incidents.metadata.sample` (PII WhatsApp).
- **Classificação:** **D — não aplicável.**

#### 17.2.4 `whatsapp-cross-business-detector`
- **Tipo:** cron diário.
- **Provider externo:** nenhum. Apenas leitura de `whatsapp_configs` + `whatsapp_inbound_messages` (Sinal 4 hoje no-op) e atualização de `channel_state` / `v2_ui_active_at` em `whatsapp_configs`.
- **Custo monetário:** zero.
- **Helpers de cobrança:** nenhum.
- **Risco de log:** baixo — log final só com agregados (`checked`, `transitions`); sem PII; sem token.
- **Classificação:** **D — não aplicável.**

### 17.3 Tabela comparativa

| Edge | Trigger | Provider externo | Cobrado? | Helpers | Risco log | Classificação |
|---|---|---|---|---|---|---|
| `health-monitor-admin` | Admin (UI) | — | Não | — | Baixo (e-mail admin) | **D — não aplicável** |
| `meta-whatsapp-monitor-all` | Cron diário | Meta Graph (admin endpoints) gratuitos | Não | — | Médio (`rec.data` cru) | **D — não aplicável (estado atual)** |
| `whatsapp-orphan-watcher` | Cron 15 min | — | Não | — | Médio (`from_phone`) | **D — não aplicável** |
| `whatsapp-cross-business-detector` | Cron diário | — | Não | — | Baixo | **D — não aplicável** |

### 17.4 Regra documental — separação obrigatória Meta admin × Meta envio cobrável

> **"Monitoramento administrativo Meta/WhatsApp, leitura de status, diagnóstico, detecção de inconsistência e auto-reparo administrativo gratuito não entram em `platform_cost_ledger` quando não chamam operação cobrável. Envio real de mensagem, template, conversa cobrável ou qualquer chamada a `/messages` deve ser auditado e registrado separadamente."**

Esta regra estende §14.4 (F2.7), §15.4 (F2.8) e §16.5 (F2.9). O custo é registrado **apenas no edge que emite o evento cobrável** (ex.: `meta-whatsapp-send` para template marketing/utility/auth), nunca no monitor administrativo.

### 17.5 Regra preventiva — congelamento de escopo do `meta-whatsapp-monitor-all`

> **"Qualquer ação futura adicionada a `meta-whatsapp-monitor-all` que invoque `/messages`, template pago, conversa cobrável Meta ou qualquer operação monetizável deve reabrir auditoria F2 antes de merge."**

A classificação D desta edge é válida **somente enquanto** o conjunto de ações permanecer restrito a `subscribe_webhook` e `register_phone` (administrativos gratuitos). Adicionar qualquer ação cobrável sem reauditoria F2 é violação direta desta regra.

### 17.6 Backlog de hardening (não aplicado nesta execução)

| ID | Edge | Ação | Severidade |
|---|---|---|---|
| **F2.10.1** | `whatsapp-orphan-watcher` | Mascarar `from_phone` (preservar últimos 4 dígitos) em log e em `whatsapp_health_incidents.metadata.sample`. | Média |
| **F2.10.2** | `meta-whatsapp-monitor-all` | Truncar/sanitizar `rec?.data` em `summary.details` antes de logar/retornar; nunca incluir `register_pin`. | Média |
| **F2.10.3** | `meta-whatsapp-monitor-all` | Registrar formalmente o congelamento de escopo §17.5 como gate de PR (lint/CI ou checklist obrigatório na Fase 12). | Baixa |
| **F2.10.4** | `health-monitor-admin` | Considerar substituir `user.email` em log por hash determinístico em produção. | Baixa |

**Reforço explícito:** a classificação "não aplicável ao Motor de Créditos" **não foi usada para ignorar** os riscos de log catalogados acima. Eles ficam pendentes em backlog separado de hardening (§17.6) para tratamento posterior.

### 17.7 Confirmações de não-impacto (validações obrigatórias F2.10)

| Item | Status |
|---|---|
| Código de runtime alterado | NÃO |
| Migration criada | NÃO |
| RPC alterada | NÃO |
| RLS alterada | NÃO |
| `service_key` criada | NÃO |
| Preço aprovado | NÃO |
| Custo registrado em `platform_cost_ledger` | NÃO |
| Provider real chamado | NÃO |
| Monitor real executado | NÃO |
| Health check real executado | NÃO |
| Token alterado/girado | NÃO |
| Wallet/`credit_ledger`/`service_usage_events` alterados | NÃO |
| UI alterada | NÃO |
| `mem://` ou Knowledge novos criados | NÃO |
| Hardening de logs WhatsApp (`from_phone`) aplicado | NÃO (backlog §17.6 — F2.10.1) |
| Sanitização de `rec?.data` em `meta-whatsapp-monitor-all` | NÃO (backlog §17.6 — F2.10.2) |
| Docs oficiais atualizados | SIM (`funcoes-pagas.md` §3.11; este doc §17) |
| `workers-crons-pagos.md` revisado | SIM — nenhuma alteração necessária (nenhuma das 4 edges estava classificada como paga/cobrável; exemplos de `platform_absorbed` em §2.2 permanecem coerentes) |

### 17.8 Status final F2.10

🟢 **F2.10 — GO documental confirmado.**

`health-monitor-admin`, `meta-whatsapp-monitor-all`, `whatsapp-orphan-watcher` e `whatsapp-cross-business-detector` classificadas como **não aplicáveis** ao Motor de Créditos. Para `meta-whatsapp-monitor-all`, a classificação vale **somente enquanto** não invocar `/messages`, template pago ou conversa cobrável Meta (regra preventiva §17.5). Riscos de log/PII catalogados como backlog separado (F2.10.1 a F2.10.4 em §17.6), sem correção nesta execução. Nenhuma alteração de runtime, ledger, wallet, evento, token, UI, RPC ou RLS executada.

**Próximo passo recomendado (não executado):** abrir **F2.11 em modo PLANNER** para auditar `meta-whatsapp-diagnose`, `meta-whatsapp-recover` (camadas chamadas pelo monitor — confirmar que continuam apenas administrativas) e demais monitores WhatsApp/Meta ainda não auditados.

---

## 18. F2.11 — Auditoria de camadas WhatsApp/Meta (diagnose, recover e monitores remanescentes)

**Data:** 2026-05-11
**Modo:** PLANNER (auditoria) → EXECUÇÃO (atualização documental)
**Escopo:** `meta-whatsapp-diagnose`, `meta-whatsapp-recover`, `whatsapp-health-summary`, `whatsapp-open-validation-window`, `whatsapp-check-templates`.

### 18.1 Contexto

A F2.10 fechou o lote de monitores administrativos (`meta-whatsapp-monitor-all`, `health-monitor-admin`, `whatsapp-orphan-watcher`, `whatsapp-cross-business-detector`). A F2.11 desce para as **camadas chamadas pelo monitor** e para os **monitores WhatsApp/Meta remanescentes** ainda não auditados, fechando o perímetro WhatsApp/Meta de leitura/diagnóstico/recuperação administrativa antes de avançar para onboarding/setup (F2.12 sugerida) e webhook de recepção (F2.13 sugerida).

### 18.2 Edges auditadas — evidência por edge

#### 18.2.1 `meta-whatsapp-diagnose`

- **O que faz:** diagnóstico read-only por tenant. 4 checks Meta Graph: `/me` (token), `/{phone_number_id}?fields=...,health_status` (status do número), `/{app_id}/subscriptions` (webhook do app), `/{waba_id}/subscribed_apps` (vínculo WABA↔app). Persiste resultado em `whatsapp_configs.last_health_payload`, `last_diagnosed_at`, `webhook_subscribed_at`.
- **Trigger:** UI tenant (botão diagnose) **e** `meta-whatsapp-monitor-all` via service_role **e** `meta-whatsapp-recover` quando `actions` vem vazio.
- **Provider externo:** Meta Graph **administrativa, gratuita** (4 GET).
- **Chama `/messages`?** Não. **Envia mensagem?** Não. **Template pago?** Não. **Conversa cobrável?** Não. **Altera WABA/número?** Não (só lê e persiste status).
- **Custo monetário:** zero. **Service_key/pricing:** não existem nem se aplicam.
- **Helpers de cobrança:** nenhum (`recordPlatformCost`/`chargeAfter`/`withCreditMotor` não presentes).
- **Risco rate limit:** baixo (4 GET × tenants × frequência).
- **Risco log/PII:** **médio.** `last_health_payload.app_webhook.raw` e `webhook.raw` persistem resposta crua da Meta Graph em DB (`callback_url`, IDs, fields). `phoneData.health_status.entities[].errors[].error_description` também persistido. `access_token` **não** é logado.
- **Classificação:** **D — não aplicável** ao `platform_cost_ledger`.

#### 18.2.2 `meta-whatsapp-recover`

- **O que faz:** ações de reparo administrativo. `subscribe_webhook` → `POST /{waba_id}/subscribed_apps` (com `subscribed_fields`). `register_phone` → `POST /{phone_number_id}/deregister` + `POST /{phone_number_id}/register` (com PIN). Atualiza `whatsapp_configs.webhook_subscribed_at`, `connection_status`, `register_pin`.
- **Trigger:** UI tenant (botão recuperar) **e** `meta-whatsapp-monitor-all` via service_role.
- **Provider externo:** Meta Graph **administrativa, gratuita** (1–3 POST).
- **Chama `/messages`?** Não. **Envia mensagem?** Não. **Template pago?** Não. **Conversa cobrável?** Não.
- **Altera WABA/número?** **Sim** — re-inscreve campos do webhook na WABA e re-registra o número Cloud. Operações administrativas gratuitas, mas **mudam estado da WABA/número** → operação sensível.
- **Custo monetário:** zero no estado atual. **Service_key/pricing:** não existem nem se aplicam.
- **Helpers de cobrança:** nenhum.
- **Risco rate limit:** baixo (esporádico).
- **Risco log/PII:** **médio-alto.** `executed[].detail` faz `JSON.stringify(subData)`/`JSON.stringify(regData)` cru em caso de erro. PIN transitado via body para `/register` (não logado em console) e persistido em `whatsapp_configs.register_pin`. `access_token` não logado.
- **Classificação:** **D — não aplicável** ao `platform_cost_ledger` no estado atual. **Operação administrativa sensível**, registrada como tal nesta seção.

#### 18.2.3 `whatsapp-health-summary`

- **O que faz:** lê `whatsapp_inbound_messages`, `whatsapp_messages` e `whatsapp_health_incidents` para o card "Central de Comando" (`last_inbound_at`, `last_ai_reply_at`, `subscription_status`, `silence_alert`).
- **Trigger:** UI tenant.
- **Provider externo:** nenhum (apenas Postgres).
- **Chama `/messages`?** Não. **Envia?** Não. **Template pago?** Não. **Conversa cobrável?** Não. **Altera WABA/número?** Não.
- **Custo monetário:** zero.
- **Risco log/PII:** baixo.
- **Classificação:** **D — não aplicável.**

#### 18.2.4 `whatsapp-open-validation-window`

- **O que faz:** marca `whatsapp_configs.validation_window_opened_at` para abrir janela de 10 min. Promoção de estado depende do webhook receber POST real dentro da janela. Não envia nada.
- **Trigger:** UI tenant.
- **Provider externo:** nenhum.
- **Chama `/messages`?** Não. **Envia?** Não. **Template pago?** Não. **Conversa cobrável?** Não. **Altera WABA/número?** Não.
- **Custo monetário:** zero.
- **Risco log/PII:** baixo.
- **Classificação:** **D — não aplicável.**

#### 18.2.5 `whatsapp-check-templates`

- **O que faz:** cron horário. Lê `whatsapp_template_submissions` com `meta_status='pending'`, agrupa por tenant, faz `GET /{waba_id}/message_templates?limit=250` na Meta Graph e atualiza status (`approved`/`rejected`/`not_found`) em `whatsapp_template_submissions` + `notification_rule`.
- **Trigger:** cron (hora em hora).
- **Provider externo:** Meta Graph **administrativa, gratuita** (1 GET por WABA com pendentes).
- **Chama `/messages`?** Não. **Envia template?** Não. **Consome template pago?** Não (só lê status). **Conversa cobrável?** Não. **Altera WABA/número?** Não.
- **Custo monetário:** zero. Submissão é gratuita; uso (envio) é cobrável e está coberto por `meta-whatsapp-send`.
- **Risco log/PII:** baixo.
- **Classificação:** **D — não aplicável.**

### 18.3 Tabela comparativa

| Edge | Trigger | Provider externo | Chama `/messages`? | Envia? | Template pago? | Conversa cobrável? | Altera WABA/número? | Custo monetário | Risco rate limit | Risco log/PII | Classificação |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `meta-whatsapp-diagnose` | UI/cron | Meta Graph admin (4 GET) | Não | Não | Não | Não | Não | Zero | Baixo | Médio | **D** |
| `meta-whatsapp-recover` | UI/cron | Meta Graph admin (1–3 POST) | Não | Não | Não | Não | **Sim (admin)** | Zero | Baixo | Médio-alto | **D — operação administrativa sensível** |
| `whatsapp-health-summary` | UI tenant | — | Não | Não | Não | Não | Não | Zero | N/A | Baixo | **D** |
| `whatsapp-open-validation-window` | UI tenant | — | Não | Não | Não | Não | Não | Zero | N/A | Baixo | **D** |
| `whatsapp-check-templates` | Cron 1h | Meta Graph admin (1 GET/WABA) | Não | Não | Não | Não | Não | Zero | Baixo | Baixo | **D** |

### 18.4 Regra de governança (extensão de §15.4 / §16.5 / §17.4 e §17.5)

> **WhatsApp/Meta administrativo, diagnóstico, recover e leitura de status ≠ envio cobrável.**
>
> Diagnóstico, recover administrativo, leitura de status, abertura de janela de validação e polling de aprovação de template **não entram em `platform_cost_ledger`** quando **não chamam `/messages`, não enviam mensagem, não consomem template pago e não iniciam conversa cobrável Meta**. O custo cobrável Meta/WhatsApp é registrado **exclusivamente** no edge que efetivamente envia mensagem/template/conversa — atualmente `meta-whatsapp-send` (lote 3 do Motor v2, via `chargeAfter` por template).

### 18.5 Regra preventiva — congelamento de escopo de `meta-whatsapp-recover`

> Qualquer ação adicional além de `subscribe_webhook` e `register_phone` adicionada a `meta-whatsapp-recover` — em especial qualquer ação que envolva `/messages`, envio de mensagem, template pago, conversa cobrável Meta ou qualquer operação monetizável — **exige reabrir auditoria F2 antes de merge**.
>
> `meta-whatsapp-recover` permanece classificada como **operação administrativa sensível**: **não gera custo financeiro** no estado atual, mas **altera estado administrativo da WABA/número** (re-inscrição de webhook, re-registro Cloud) e deve permanecer restrita aos fluxos autorizados (UI tenant com role válida e cron `meta-whatsapp-monitor-all` via service_role).

### 18.6 Backlog de hardening (não executado nesta entrega)

| ID | Edge | Ação recomendada | Prioridade |
|---|---|---|---|
| **F2.11.1** | `meta-whatsapp-diagnose` | Filtrar/recortar `raw` em `last_health_payload` (manter apenas campos derivados úteis: `subscribed`, `has_visible_fields`, `callback_matches`, `active`); truncar `error_description` em logs e payloads persistidos. | Média |
| **F2.11.2** | `meta-whatsapp-recover` | Substituir `JSON.stringify(subData)`/`JSON.stringify(regData)` em `executed[].detail` por extração tipada (`code`, `message`, `error_user_msg`); auditar permissões/RLS de `whatsapp_configs.register_pin`. | Média |
| **F2.11.3** | `meta-whatsapp-recover` | Registrar formalmente o congelamento de escopo §18.5 como gate de PR (lint/CI ou checklist obrigatório na Fase 12). | Baixa |

**Reforço explícito:** a classificação "não aplicável ao Motor de Créditos" **não foi usada para ignorar** os riscos de log catalogados acima. Eles ficam pendentes em backlog separado de hardening (§18.6) para tratamento posterior, conforme decisão do operador.

### 18.7 Confirmações de não-impacto (validações obrigatórias F2.11)

| Validação | Status |
|---|---|
| Código de runtime alterado | NÃO |
| Migration criada | NÃO |
| RPC alterada | NÃO |
| RLS alterada | NÃO |
| `service_pricing` criada/alterada | NÃO |
| `service_key` criada | NÃO |
| `platform_cost_ledger` alterado | NÃO |
| `wallet`/`credit_ledger`/`service_usage_events` alterados | NÃO |
| Provider real chamado | NÃO |
| Diagnose real executado | NÃO |
| Recover real executado | NÃO |
| Check de templates real executado | NÃO |
| Mensagem enviada | NÃO |
| Template consumido | NÃO |
| Conversa cobrável iniciada | NÃO |
| WABA/número alterada | NÃO |
| Tokens/secrets alterados | NÃO |
| UI alterada | NÃO |
| Mem/Knowledge criada | NÃO (decisão do operador — regras já cobertas pelos docs formais) |
| Hardening de logs aplicado | NÃO (backlog §18.6 — F2.11.1 / F2.11.2 / F2.11.3) |
| Docs oficiais atualizados | SIM (`funcoes-pagas.md` §3.11; este doc §18) |
| `workers-crons-pagos.md` revisado | SIM — nenhuma alteração necessária (`whatsapp-check-templates` é o único cron novo desta leva e não é "absorbed" porque não tem custo; `meta-whatsapp-diagnose` e `meta-whatsapp-recover` não são crons; os 2 internos não envolvem provider) |

### 18.8 Status final F2.11

🟢 **F2.11 — GO documental confirmado.**

`meta-whatsapp-diagnose`, `meta-whatsapp-recover`, `whatsapp-health-summary`, `whatsapp-open-validation-window` e `whatsapp-check-templates` classificadas como **não aplicáveis** ao Motor de Créditos. `meta-whatsapp-recover` permanece marcada como **operação administrativa sensível** (sem custo monetário no estado atual, mas altera estado da WABA/número), com regra preventiva §18.5 ativa. Riscos de log/PII catalogados como backlog separado (F2.11.1 a F2.11.3 em §18.6), sem correção nesta execução. Nenhuma alteração de runtime, ledger, wallet, evento, token, WABA/número, UI, RPC ou RLS executada. Nenhum provider real chamado. Nenhum diagnose, recover ou check real executado.

**Próximo passo recomendado (não executado):** abrir **F2.12 em modo PLANNER** para auditar o lote de **onboarding/setup e envio/teste WhatsApp/Meta** (`meta-whatsapp-onboarding-start`, `meta-whatsapp-onboarding-callback`, `meta-whatsapp-register-phone`, `meta-whatsapp-set-pin`, `meta-whatsapp-request-code`, `meta-whatsapp-verify-code`, `whatsapp-submit-template`, `meta-whatsapp-test-send`, `meta-whatsapp-send-test-runner`). Atenção especial a `meta-whatsapp-test-send` e `meta-whatsapp-send-test-runner`, que podem efetivamente enviar mensagem real e iniciar conversa cobrável Meta. Em seguida, **F2.13 sugerida** para `meta-whatsapp-webhook` (recepção sem custo direto, mas dispara pipelines pagos a jusante).

---

## 19. F2.12 (2026-05-11) — Correção da regra de cobrança WhatsApp Meta

### 19.1 Regra de negócio oficial

> **Mensagem WhatsApp Meta, template, conversa e envio via WABA do cliente são pagos diretamente pelo cliente à Meta e NÃO devem gerar cobrança de créditos no Comando Central.**
>
> O Comando Central cobra **apenas custos próprios da plataforma**: IA de atendimento, geração/interpretação de resposta por IA, automações inteligentes, processamento interno pago e recursos próprios do sistema.
>
> **Regra complementar:** qualquer cobrança relacionada ao WhatsApp deve separar **custo Meta pago pelo cliente** de **custo de IA/plataforma cobrado pelo Comando Central**.

### 19.2 Mudanças aplicadas

#### 19.2.1 Código — `meta-whatsapp-send`

Bloco `chargeAfter` de templates removido (linhas ~700-728). Substituído por comentário explícito da regra. Nenhum outro `chargeAfter` existia na edge — confirmado por `grep` antes da remoção. Envio passa a registrar apenas histórico interno em `whatsapp_messages` / `messages` (sem cobrança financeira).

#### 19.2.2 Banco — `service_pricing`

`UPDATE` aplicado (sem `DELETE`, histórico preservado):

| service_key | is_active antes | is_active depois | metadata aplicada |
|---|---|---|---|
| whatsapp-template-marketing | true | **false** | `cost_owner=meta`, `paid_directly_by=customer_to_meta`, `not_billable_by_comando_central=true`, `disabled_reason=customer_pays_meta_directly`, `disabled_by_phase=F2.12`, `historical_only=true` |
| whatsapp-template-utility | true | **false** | idem |
| whatsapp-template-authentication | true | **false** | idem |
| whatsapp-window-marketing-24h | false | false | reaffirmed_by_phase=F2.12, mesma metadata informativa |
| whatsapp-window-utility-24h | false | false | idem |
| whatsapp-window-service-24h | false | false | idem |

**`usage_owner`:** preservado. A coluna `usage_owner` não existe em `service_pricing` (verificado em `information_schema.columns`); a informação canônica de propriedade do custo passou a residir em `metadata.cost_owner='meta'`. Nenhum enum/schema alterado.

### 19.3 Classificação final F2.12 — 9 edges auditadas

| Edge | Provider | Chama `/messages`? | Cobrança CC | Classificação |
|---|---|---|---|---|
| meta-whatsapp-onboarding-start | — (gera URL OAuth) | Não | Zero | **D — não aplicável** |
| meta-whatsapp-onboarding-callback | Meta OAuth (gratuita) | Não | Zero | **D — não aplicável** |
| meta-whatsapp-register-phone | Meta Graph admin (gratuita) | Não | Zero | **D — não aplicável** |
| meta-whatsapp-set-pin | Meta Graph admin (gratuita) | Não | Zero | **D — não aplicável** |
| meta-whatsapp-request-code | Meta Graph admin (gratuita) | Não | Zero | **D — não aplicável** |
| meta-whatsapp-verify-code | Meta Graph admin (gratuita) | Não | Zero | **D — não aplicável** |
| whatsapp-submit-template | Meta Graph (submissão gratuita) | Não | Zero | **D — não aplicável** |
| meta-whatsapp-test-send | Meta Cloud API `/messages` | **Sim** (admin-only) | **Não cobra créditos** — custo Meta direto na WABA usada; risco operacional de envio real persiste | **D — não aplicável** (admin-only) |
| meta-whatsapp-send-test-runner | via `meta-whatsapp-send` | Sim (via send) | **Não cobra créditos** — herda regra §19.1; se acionar IA no futuro, IA cobra em `ai-support-chat` | **D — não aplicável** |

### 19.4 Regra de governança

> O envio de WhatsApp via WABA do cliente (qualquer caminho — `meta-whatsapp-send`, `meta-whatsapp-test-send`, `meta-whatsapp-send-test-runner`, `agenda-dispatch-reminders`, replies do `ai-support-chat` ao Meta) **não gera cobrança de créditos no Comando Central**, porque o custo é pago diretamente pelo cliente à Meta. Apenas custos próprios da plataforma (IA, automações inteligentes, processamento interno) entram em `chargeAfter`/`withCreditMotor`/`recordPlatformCost`.
>
> Qualquer PR que (re)introduza `chargeAfter` com `serviceKey LIKE 'whatsapp-%'` ou que reative service_keys `whatsapp-template-*` / `whatsapp-window-*` em `service_pricing` **exige reabrir auditoria F2 antes de merge**.

### 19.5 Pontos de cobrança legítima (mantidos intactos)

- `ai-support-chat` continua cobrando IA por tokens reais (`openai.gpt-5.2.per_1m_tokens_in/out`, `openai.gpt-4o.per_1m_tokens_in/out`). **Não foi alterada.**
- Demais service_keys de IA (Gemini, OpenAI, embedding, video, image) permanecem inalteradas.
- `service_pricing` para IA: nenhuma mudança.
- `ai-model-pricing`, `credit_packages`, `credit_wallet`, `credit_ledger`, `service_usage_events`: nenhuma mudança.

### 19.6 Confirmações de não-impacto (validações obrigatórias F2.12)

| Validação | Status |
|---|---|
| Bloco `chargeAfter` de templates removido de `meta-whatsapp-send` | SIM |
| Outro `chargeAfter` removido indevidamente | NÃO (era único bloco) |
| `ai-support-chat` alterada | NÃO |
| Cobrança de IA alterada | NÃO |
| `whatsapp-template-marketing` desativada | SIM (`is_active=false`) |
| `whatsapp-template-utility` desativada | SIM (`is_active=false`) |
| `whatsapp-template-authentication` desativada | SIM (`is_active=false`) |
| `whatsapp-window-*` permanecem inativas | SIM (3/3) |
| Metadata `cost_owner='meta'` aplicada | SIM (6/6 service_keys) |
| `usage_owner` alterado | NÃO (coluna não existe; informação em `metadata.cost_owner`) |
| Histórico de `service_pricing` apagado | NÃO (apenas `is_active=false` + metadata) |
| `credit_wallet` alterado | NÃO |
| `credit_ledger` alterado | NÃO (zero registros `whatsapp%` antes e depois) |
| `service_usage_events` alterado | NÃO |
| Telemetria zero-custo criada | NÃO (decisão do operador — não nesta etapa) |
| Migration criada | NÃO (apenas `UPDATE` em dados) |
| RPC alterada | NÃO |
| RLS alterada | NÃO |
| Enum/schema alterado | NÃO |
| Provider real chamado | NÃO |
| Mensagem real enviada | NÃO |
| `/messages` chamado | NÃO |
| Template submetido/consumido | NÃO |
| WABA/número alterada | NÃO |
| Tokens/secrets alterados | NÃO |
| UI/UX alterada | NÃO |
| Mem/Knowledge criada | NÃO (decisão do operador) |
| Docs oficiais atualizados | SIM (`funcoes-pagas.md` §3.9; este doc §19) |
| Backfill/reversão de ledger | NÃO (não houve cobrança indevida registrada) |

### 19.7 Status final F2.12

🟢 **F2.12 — GO confirmado.**

`meta-whatsapp-send` deixa de cobrar créditos por templates. As 9 edges F2.12 estão classificadas como **D — não aplicáveis** ao Motor de Créditos. As 6 service_keys WhatsApp em `service_pricing` ficam inativas com marcação de custo Meta pago diretamente pelo cliente. `ai-support-chat` permanece como único ponto correto de cobrança no fluxo WhatsApp (IA da plataforma).

**Próximo passo recomendado (não executado):** abrir **F2.13 em modo PLANNER** para auditar `meta-whatsapp-webhook`, `whatsapp-webhook` e pipelines pagos a jusante (recepção de mensagens), confirmando que o webhook **não cobra por mensagem recebida** (regra §19.1) e que a IA/automação acionada por ele continua cobrando apenas o custo de IA via `ai-support-chat` e correlatos.

---

## 20. F2.13 — Webhook WhatsApp Meta e pipeline de recepção (2026-05-11)

### 20.1 Regra oficial

> **Recepção WhatsApp Meta não cobra créditos.** Mensagem WhatsApp Meta enviada/recebida também **não cobra créditos no Comando Central**, pois o cliente paga direto à Meta. O que **pode** cobrar créditos são custos próprios da plataforma acionados pelo fluxo, como **IA** (`ai-support-chat`, agente Agenda) e **automações inteligentes** que consumam recurso pago da plataforma.
>
> Eixo de cobrança correto:
> - **WhatsApp Meta (mensagem/template/conversa/envio via WABA):** cliente ↔ Meta. Sem cobrança Comando Central.
> - **IA / automação inteligente / processamento interno:** Comando Central ↔ tenant. Cobrança via Motor de Créditos.

### 20.2 Edges/pipeline auditados

| Componente | Provedor externo | Cobrança CC | Justificativa | Classificação |
|---|---|---|---|---|
| **meta-whatsapp-webhook** | nenhum (recebe POST da Meta) | zero | Recepção pura: dedupe, persiste inbound/conversa/mensagem, decide rota. Não chama `/messages`, não envia, não consome template, não chama provider pago. | **D — não aplicável** |
| persistência inbound (`whatsapp_inbound_messages`, `conversations`, `messages`, `whatsapp_inbound_debounce`, `whatsapp_logical_turns`) | Postgres interno | zero | Escrita interna, sem custo externo. | **D — não aplicável** |
| **turn-orchestrator-processor** | nenhum (orquestrador) | zero | Orquestra turno e invoca `ai-support-chat`. **Não deve cobrar** para evitar dupla cobrança — cobrança ocorre dentro do `ai-support-chat`. | **D — não aplicável** |
| **ai-support-chat** | OpenAI / Gemini | **cobra IA** (tokens in/out) | Ponto único e correto de cobrança da IA de atendimento. Já em produção via `chargeAfter` (Lote 3 do Motor Universal). | **B — chargeAfter (ATIVO)** |
| **meta-whatsapp-send** (resposta WhatsApp) | Meta Cloud API (WABA do cliente) | zero | Custo Meta pago direto pelo cliente à Meta (regra F2.12). Confirmado sem `chargeAfter`. | **D — não aplicável** |
| **agenda-process-command** | Gemini (agente IA do tenant) | **deve cobrar IA do tenant** | Agente de IA do tenant: conversa com o tenant no WhatsApp, executa ações no sistema e dialoga com outros agentes de IA. **Não é recepção gratuita nem custo Meta** — é IA da plataforma consumida pelo tenant. **Hoje sem `chargeAfter` aparente** ⇒ custo de IA invisível. | **B — chargeAfter (PENDENTE F2.13.1)** |

### 20.3 Inexistência de `whatsapp-webhook` separado

Inventário em `supabase/functions/`: a única edge de recepção WhatsApp/Meta é `meta-whatsapp-webhook`. As demais `whatsapp-*` (`whatsapp-orphan-watcher`, `whatsapp-cross-business-detector`, `whatsapp-health-summary`, `whatsapp-open-validation-window`, `whatsapp-check-templates`, `whatsapp-token-healthcheck`, `whatsapp-submit-template`) foram auditadas em F2.10/F2.11 e classificadas como D.

### 20.4 Mapa do pipeline a jusante

```text
Meta POST → meta-whatsapp-webhook  [D]
  ├─ persist whatsapp_inbound_messages / conversations / messages  [D]
  ├─ se telefone admin    → agenda-process-command  [B — pendente F2.13.1]
  ├─ se cliente + GREEN gate
  │     ├─ orchestrator ON  → turn-orchestrator-processor [D] → ai-support-chat [B — ATIVO]
  │     └─ orchestrator OFF → debounce → ai-support-chat [B — ATIVO]
  └─ outcome no finally (Camada 2 do fluxo-recepcao-meta)
```

### 20.5 Confirmações de não-impacto

| Validação | Status |
|---|---|
| Código alterado | NÃO |
| Migration criada | NÃO |
| RPC alterada | NÃO |
| RLS alterada | NÃO |
| Service_key criada | NÃO |
| Preço aprovado | NÃO |
| `platform_cost_ledger` alterado | NÃO |
| `credit_wallet` alterado | NÃO |
| `credit_ledger` alterado | NÃO |
| `service_usage_events` alterado | NÃO |
| Tokens/integrações alterados | NÃO |
| Provider real chamado | NÃO |
| Webhook real simulado | NÃO |
| Mensagem enviada | NÃO |
| `/messages` chamado | NÃO |
| IA executada | NÃO |
| UI/UX alterada | NÃO |
| Mem/Knowledge criada | NÃO |
| Cobrança da Agenda implementada | NÃO (pendente F2.13.1) |
| Docs oficiais atualizados | SIM (`funcoes-pagas.md` §3.9; este doc §20) |

### 20.6 Pendências formais

- **F2.13.1 — auditoria/implementação de cobrança em `agenda-process-command`** (BLOQUEANTE para fechamento da família F2.13). Escopo mínimo:
  - identificar o(s) modelo(s) Gemini realmente utilizados;
  - capturar `usage` real (tokens in/out) por chamada;
  - confirmar/criar `service_key` correspondente em `service_pricing`;
  - definir ponto exato de `chargeAfter` (após resposta da IA, com idempotência por `external_message_id` ou turn_id);
  - garantir que `turn-orchestrator-processor` continue **sem** cobrar (regra anti-dupla cobrança);
  - validar metadata/logs sem PII excessiva;
  - rollout shadow → live conforme Motor Universal.
- **F2.13.2 — hardening de PII em logs do `meta-whatsapp-webhook`** (backlog, não bloqueante): telefone, `wa_id`, texto da mensagem, `profile`, IDs Meta aparecem em `console.log` com `traceId`. Sanitização recomendada em entrega futura dedicada a observabilidade.

### 20.7 Status final F2.13

🟢 **F2.13 — GO documental confirmado.**

`meta-whatsapp-webhook` e a cadeia de recepção (persistência + `turn-orchestrator-processor`) estão classificados como **D — não aplicáveis**. `ai-support-chat` permanece como ponto único de cobrança da IA de atendimento. `meta-whatsapp-send` permanece sem cobrança de custo Meta. `agenda-process-command` fica **registrada como IA do tenant cobrável**, com pendência obrigatória **F2.13.1** para auditoria/implementação de `chargeAfter`. Riscos de PII em logs ficam como backlog **F2.13.2**, sem alteração nesta entrega.

**Próximo passo recomendado (não executado):** abrir **F2.13.1 em modo PLANNER** para auditar `agenda-process-command` em profundidade (modelo Gemini real, tokens, pricing, idempotência, ponto de `chargeAfter`, metadata/logs, validação anti-dupla cobrança), antes de qualquer implementação.

---

## §21 — Fase F2.13.1 — chargeAfter ATIVO em agenda-process-command (2026-05-11)

**Regra oficial:** o custo de IA do agente Agenda é da plataforma e **deve ser cobrado do tenant** via Motor de Créditos. Custo Meta da mensagem WhatsApp continua direto cliente↔Meta (F2.12). `command-assistant-execute` continua **não** cobrando — não chama IA hoje; se passar a chamar, exige auditoria F2 antes.

### Implementação

- **Arquivo único alterado:** `supabase/functions/agenda-process-command/index.ts`.
- **`callAI`** agora retorna `usage` real do Lovable AI Gateway (`prompt_tokens`, `completion_tokens`, `total_tokens?`). Se ausente/inválido: retorno sem `usage`, sem invenção de custo.
- **Plug do `chargeAfter`** logo após `aiResponse.success === true`, antes de processar intent.
- **Helper:** `chargeAfter` (postpaid). Não usar `withCreditMotor` (pré-pago) — tokens só são conhecidos pós-resposta.

### service_keys utilizadas (pricing existente, ativo)

| service_key | uso |
|---|---|
| `gemini.gemini-2.5-flash.per_1m_tokens_in` | tokens de prompt |
| `gemini.gemini-2.5-flash.per_1m_tokens_out` | tokens de resposta |

Nenhum pricing novo criado. Nenhum schema/RPC/RLS alterado.

### Idempotência

- `jobId = "agenda:" + external_message_id + ":in" | ":out"`. Determinístico, único por turno.
- `external_message_id` é validado obrigatório no início do handler (linha 66) — é o `wamid` da Meta, sempre presente.
- Dedupe natural de 1ª camada: `agenda_command_log` por `(tenant_id, external_message_id)` — em redelivery do webhook, a 2ª execução nem chega ao `chargeAfter`.
- Dedupe de 2ª camada: `chargeAfter` resolve `jobId` → UUID v5 determinístico namespaced por `(tenantId, serviceKey, jobId)`; UNIQUE em `service_usage_events.credit_ledger_id` bloqueia duplicidade de telemetria (F1).

### Política de cobrança

| Cenário | Cobra IA? |
|---|---|
| Provider IA falha (HTTP ≠ 200, parse JSON falha, body vazio) | **NÃO** |
| Provider OK mas `usage` ausente/inválido | **NÃO** (log `charge skipped: usage_missing_from_gateway`) |
| Provider OK + `usage` válido + intent OK | **SIM** |
| Provider OK + `usage` válido + ação interna (criar tarefa / Auxiliar / envio WhatsApp) falha | **SIM** (tokens já consumidos) |
| Provider OK + `intent=delegate_to_assistant` | **SIM**, apenas a IA da Agenda |
| `prompt_tokens=0` ou `completion_tokens=0` legitimamente | cobra apenas o lado > 0 (log do skip) |

### Anti-dupla cobrança

- `command-assistant-execute`: confirmado que **não** chama IA hoje (sem `gateway`/`openai`/`gemini`/`chargeAfter` no arquivo).
- `ai-support-chat`: rotas Agenda vs Suporte são mutuamente exclusivas em `meta-whatsapp-webhook`.
- `turn-orchestrator-processor`: não roda no fluxo Agenda.
- `meta-whatsapp-send`: D (custo Meta direto cliente↔Meta).

### Metadata da cobrança (sanitizada)

```json
{
  "conversation": "agenda",
  "intent": "<intent>",
  "delegate_action": "<se aplicável>",
  "model": "google/gemini-2.5-flash",
  "needs_confirmation": <bool>,
  "tokens_in": <int>,
  "tokens_out": <int>,
  "origin_function": "agenda-process-command",
  "external_message_id_tail": "<últimos 12 chars do wamid>"
}
```

**Proibido em metadata** (F2.13.2 trata logs do handler separadamente): `from_phone`, `message_content`, prompt completo, resposta da IA, histórico, `wa_id` bruto, telefone, dados do `tenant_user`, PII.

### Tratamento de erro

`chargeAfter` envolto em `try/catch` próprio. Falha de cobrança/telemetria gera `console.warn` sanitizado e **não quebra o fluxo da Agenda**. `await` confiável: cobrança deve ser efetivada antes de prosseguir, mas exceções não escalam.

### Confirmações de não-impacto

- ✅ Nenhum migration/RPC/RLS/schema/enum alterado.
- ✅ Nenhum pricing criado/alterado.
- ✅ Provider real **não** chamado em teste; nenhuma mensagem real enviada; nenhuma ação real executada.
- ✅ `wallet`, `credit_ledger`, `service_usage_events`, `platform_cost_ledger`: intactos (sem linha sintética).
- ✅ UI/UX intacta.
- ✅ `command-assistant-execute`, `meta-whatsapp-send`, `meta-whatsapp-webhook`, `ai-support-chat`, `turn-orchestrator-processor`: intactos.
- ✅ Fluxo funcional da Agenda preservado.
- ✅ Dedupe `agenda_command_log` preservado.
- ✅ PII/logs do handler **não** alterados nesta etapa (escopo F2.13.2).

🟢 **F2.13.1 — GO. chargeAfter ativo em produção sob a flag `motor_v2_enabled` por tenant** (mesmo padrão Lote 3). Cobrança ocorre apenas para tenants com motor habilitado; demais ficam em `skipped: motor_disabled_for_tenant`.

**Próximo passo recomendado (não executado):** abrir **F2.13.1.1 em PLANNER** para auditar `agenda-dispatch-reminders` e `agenda-submit-template` (cron de lembretes pode acionar IA?), e em seguida **F2.13.2** (hardening de PII em logs do webhook + handler Agenda).

---

### 21.1 F2.13.1 — Validação real (11/05/2026)

Validação funcional ponta-a-ponta executada em ambiente real do tenant piloto **Respeite o Homem** (`d1a4d0ed-8842-495e-b741-540a9a345b25`), confirmando que `chargeAfter` está cobrando corretamente a IA da Agenda.

**Fluxo validado:**
WhatsApp (telefone autorizado em `agenda_authorized_phones`, `is_active=true`) → `meta-whatsapp-webhook` → roteamento para `agenda-process-command` → Gemini real (`gemini-2.5-flash`) → `chargeAfter` (Motor v2).

**Evidência registrada:**

| Item | Resultado |
|---|---|
| Mensagem inbound processada | ✅ `processed_by=agenda_agent`, `status=processed` |
| `external_message_id` | ✅ único, sem redelivery |
| Tokens IN | 994 |
| Tokens OUT | 23 |
| Cobrança IN | ✅ `gemini.gemini-2.5-flash.per_1m_tokens_in`, `captured` |
| Cobrança OUT | ✅ `gemini.gemini-2.5-flash.per_1m_tokens_out`, `captured` |
| `credit_ledger` | ✅ 4 lançamentos (2 reserve + 2 capture) |
| `service_usage_events` | ✅ 2 eventos com `origin_function=agenda-process-command` |
| `wallet` | ✅ 485 → 483 créditos |
| `provider_job_id` determinístico | ✅ `agenda:<wamid>:in` e `agenda:<wamid>:out` |
| `metadata` sanitizada | ✅ sem telefone, sem texto da mensagem, sem prompt, sem resposta da IA, sem PII (apenas `external_message_id_tail`, tokens, model, conversation, motor_universal, mode, source) |
| `ai-support-chat` | ✅ não foi chamado |
| `turn-orchestrator-processor` | ✅ não foi chamado |
| `meta-whatsapp-send` | ✅ não cobrou custo Meta |
| Fluxo funcional da Agenda | ✅ respondeu normalmente |
| Dupla cobrança | ✅ ausente |

**Observação técnica — granularidade / minimum charge (NÃO É BUG, requer auditoria dedicada):**
O turno consumiu **2 créditos** (1 por linha IN + 1 por linha OUT) para um volume baixo de tokens (994 in / 23 out). O comportamento sugere granularidade/arredondamento/mínimo por lançamento no Motor de Créditos. **Não tratar como bug** sem auditoria específica. Registrado como **backlog de auditoria futura** sobre proporcionalidade em usos com baixo volume de tokens (granularidade, arredondamento e minimum charge do Motor).

**Backlogs registrados (sem implementação nesta etapa):**
1. **HMAC SHA-256** — validação do header `x-hub-signature-256` no `meta-whatsapp-webhook` usando `META_APP_SECRET` (risco residual, não introduzido pela Agenda).
2. **Auditoria de mudanças** em `agenda_authorized_phones` — registrar `insert/update/delete` com ator e timestamp.
3. **F2.13.2** — hardening de PII/logs do webhook e do handler da Agenda.
4. **Auditoria de granularidade / arredondamento / minimum charge** do Motor de Créditos — avaliar proporcionalidade em turnos com baixo volume de tokens.

**Confirmações desta etapa documental:**
- ✅ Nenhuma nova execução real foi feita (sem chamada de provider, sem envio de mensagem, sem IA).
- ✅ Nenhum novo lançamento gerado em `wallet`, `credit_ledger`, `service_usage_events` ou `platform_cost_ledger`.
- ✅ Nenhum código alterado, nenhuma UI/UX alterada, nenhum pricing criado/alterado.
- ✅ Nenhuma memória/Knowledge criada.

🟢 **GO FINAL F2.13.1 — fechada com validação funcional real em produção.** Cobrança da IA da Agenda operando corretamente sob `motor_v2_enabled` por tenant.

**Próximo passo recomendado:** abrir **F2.13.1.1 em PLANNER** (`agenda-dispatch-reminders` e `agenda-submit-template`), seguido de **F2.13.2** (hardening PII).


---

### 21.2 F2.13.1.1 — Auditoria das edges restantes da Agenda (11/05/2026)

Auditoria PLANNER somente leitura das edges restantes da família Agenda para classificá-las no Motor de Créditos. **Nenhum código, UI/UX, provider, cron, mensagem, template, ledger, wallet ou evento financeiro foi alterado nesta etapa.**

**Inventário completo das edges `agenda-*` no repositório:**

1. `agenda-process-command` — já plugada e validada na F2.13.1 (cobrável por IA).
2. `agenda-dispatch-reminders` — auditada nesta etapa.
3. `agenda-submit-template` — auditada nesta etapa.

Nenhuma outra edge `agenda-*` encontrada. Cron ativo identificado: **`agenda-dispatch-reminders`** (`*/5 * * * *`, jobid 19, active=true). `agenda-submit-template` é acionada apenas pela UI do tenant.

#### Tabela comparativa

| Edge | Acionador | Chama IA? | Provider externo | Envia WhatsApp? | Usa template? | Custo Meta | Custo IA/plataforma | Classificação Motor de Créditos |
|---|---|---|---|---|---|---|---|---|
| agenda-process-command | Webhook Meta (telefone autorizado) | ✅ Gemini 2.5 Flash | Lovable AI Gateway | Indireto (via tools) | — | — | ✅ tenant (chargeAfter in/out) | **Cobrável — já plugada (F2.13.1)** |
| agenda-dispatch-reminders | Cron `*/5 * * * *` | ❌ | Meta Cloud API (via `meta-whatsapp-send`) | ✅ texto livre (24h) ou template `agenda_lembrete` (fora 24h) | ✅ utility | Direto cliente↔Meta | ❌ | **D — Não aplicável** |
| agenda-submit-template | UI tenant (admin) | ❌ | Meta Graph (`/message_templates`) | ❌ (apenas submete metadata) | Submissão | ❌ (gratuita) | ❌ | **D — Não aplicável** |

#### Classificação final aprovada

- **`agenda-dispatch-reminders` → D — Não aplicável ao Motor de Créditos.**
  - Não chama IA.
  - Mensagens são strings determinísticas (`buildReminderMessage`) ou template fixo (`agenda_lembrete`).
  - O envio WhatsApp/template ocorre via `meta-whatsapp-send`, mas **não gera cobrança no Comando Central**.
  - Custo Meta é pago diretamente pelo cliente à Meta (cliente↔Meta).
  - Sem custo de IA/plataforma próprio.

- **`agenda-submit-template` → D — Não aplicável ao Motor de Créditos.**
  - Não chama IA.
  - Apenas submete/consulta o template `agenda_lembrete` na Meta Graph API.
  - Submissão de template é operação administrativa **gratuita** na Meta.
  - Sem custo de IA/plataforma próprio.

#### Regra reforçada pós-F2.12 (correção obrigatória)

> **`meta-whatsapp-send` NÃO é "contabilização herdada" para cobrança de créditos do Comando Central.** Após F2.12, envio de WhatsApp/template/conversa via Meta Cloud API é custo direto **cliente↔Meta** e **não gera crédito no Comando Central**.

> **Regra Agenda × Motor de Créditos:** Agenda só gera cobrança no Motor de Créditos quando aciona **IA**, **automação inteligente** ou **provider pago da plataforma**. Envio WhatsApp Meta usado pela Agenda segue a regra **cliente↔Meta** e **não gera crédito no Comando Central**.

#### Estado atual da família Agenda no Motor de Créditos

| Edge | Status | Cobrança própria |
|---|---|---|
| agenda-process-command | ✅ Plugada e validada (F2.13.1) | ✅ tenant — IA in/out via `chargeAfter` |
| agenda-dispatch-reminders | D — Não aplicável | ❌ |
| agenda-submit-template | D — Não aplicável | ❌ |

**`agenda-process-command` permanece como a única edge Agenda cobrável por IA nesta etapa.**

#### Backlogs registrados (sem implementação nesta etapa)

1. **PII em logs do `agenda-dispatch-reminders`** — telefones de admins autorizados são impressos sem máscara em warnings/erros (`phoneRecord.phone`). Backlog separado de hardening de logs (não bloqueia F2.13.1.1, escopo de hardening Agenda).
2. **Validação funcional futura do template `agenda_lembrete` fora da janela de 24h** — quando necessário, deve ser executada como **teste funcional WhatsApp/Agenda** (custo Meta real cliente↔Meta), **não como teste do Motor de Créditos**, pois esse envio não gera cobrança no Comando Central.

#### Confirmações desta etapa documental

- ✅ Nenhuma alteração de código.
- ✅ Nenhuma alteração de UI/UX.
- ✅ Nenhum migration/RPC/RLS/schema/enum alterado.
- ✅ Nenhum pricing criado/alterado, nenhum service_key criado.
- ✅ Nenhum provider real chamado.
- ✅ Nenhum cron real executado.
- ✅ Nenhuma mensagem real enviada, nenhum template real submetido.
- ✅ Nenhum lançamento em `wallet`, `credit_ledger`, `service_usage_events` ou `platform_cost_ledger`.
- ✅ Nenhum token/integração WhatsApp alterado.
- ✅ Nenhuma memória/Knowledge criada.
- ✅ F2.13.2 não iniciada.

🟢 **GO DOCUMENTAL F2.13.1.1 — fechada.** Família Agenda totalmente classificada no Motor de Créditos: `agenda-process-command` cobrável por IA (validada em produção); `agenda-dispatch-reminders` e `agenda-submit-template` classificadas como **D — Não aplicáveis**.

**Próximo passo recomendado (não executado):** abrir **F2.13.2 em PLANNER** — hardening de PII em logs do `meta-whatsapp-webhook` e do handler `agenda-process-command` (telefone, texto inbound, prompt, resposta IA, `wa_id` bruto, dados do `tenant_user`).

---

## 21.3 F2.13.2.A — Hardening de PII em logs (11/05/2026)

**Escopo:** apenas logs `console.log/warn/error` das edges:
- `supabase/functions/meta-whatsapp-webhook/index.ts`
- `supabase/functions/agenda-process-command/index.ts`
- `supabase/functions/agenda-dispatch-reminders/index.ts`

**Helper criado:** `supabase/functions/_shared/pii.ts` (`maskPhone`, `safeTruncate`, `safeError`, `hashForLog`, `safeHeaders` preparado para F2.13.2.B).

**Política transversal:** `docs/especificacoes/transversais/politica-pii-logs.md`.

**Sanitizações aplicadas:**
- `verify_token` parcial → `token_present=true/false`
- `JSON.stringify(payload)` cru → contadores (`entries`/`messages`/`statuses`/`msg_types`)
- `agendaResult.substring(0,300)` → `status=… ok=…`
- `aiRes.bodyText` cru → `status=… body_len=…`
- `customer_phone`/`from_phone`/`phoneRecord.phone` → `maskPhone(...)` (formato `5573****1425`)
- `message_content.slice(0,80)` → `msg_len=N`
- `JSON.stringify(toolArgs).slice(0,200)` → `tool=… arg_keys=[…]`
- `JSON.stringify(result).slice(0,300)` → `status=… ok=…`
- `AI raw content.substring(0,400)` → `len=N`

**Preservado (rastreabilidade):** `traceId`, `tenant_id.slice(0,8)`, `external_message_id`/`wa_id` (Camada 6 dedupe), `phone_number_id`, status HTTP, contadores, `intent`, tokens (`prompt_tokens`/`completion_tokens`), `body_sha256`.

**Não alterado nesta fase (intencional):**
- `whatsapp_webhook_raw_audit.body_preview` / `headers_json` → **F2.13.2.B** (executado em 11/05/2026; ver §21.5)
- `whatsapp_inbound_messages.raw_payload` → **F2.13.2.C** (retenção sugerida 90d, depois NULL)
- `agenda_command_log.content` / `from_phone` → mantém persistência; revisar RLS service-role-only
- Metadata de `chargeAfter` da Agenda — **já estava sanitizada** em F2.13.1 (apenas `intent`, `model`, `tokens_in/out`, `external_message_id_tail.slice(-12)`); não tocada

**Não impactado:** UI/UX, fluxo funcional, dedupe, redelivery, persistência operacional, `credit_ledger`, `wallet`, `service_usage_events`, `platform_cost_ledger`, pricing, RLS, RPC, migrations, providers, crons.

🟢 **GO F2.13.2.A — fechado.**

---

## 21.5. F2.13.2.B — Sanitização de `whatsapp_webhook_raw_audit` (11/05/2026)

> Correção de nomenclatura: a tabela é **`whatsapp_webhook_raw_audit`**, não `meta_webhook_audit_raw` como aparecia em versões anteriores deste doc e da política PII.

**Alvo:** persistência bruta de auditoria do webhook Meta (Camada 1 do fluxo de recepção). Único insertor: `meta-whatsapp-webhook`. Único leitor: platform admin (RLS `is_platform_admin()`).

**Sanitizações aplicadas:**

1. **`body_preview`** — substituído o substring cru de até 4000B do payload Meta por **resumo estrutural JSON determinístico** (cap rígido 2 KB), produzido por `summarizeWebhookBody()` em `_shared/pii.ts`. Campos: `object`, `entries`, `messages`, `statuses`, `msg_types`, `phone_number_ids`, `wa_message_ids`, `wa_id_hashes`, `from_hashes`, `recipient_id_hashes`, `text_lengths`, `has_media`, `parse_error`. **Hash de PII (Correção PII-Hash):** HMAC-SHA256(`LOG_HASH_SECRET`, valor) truncado em 12 hex chars quando o secret existe; senão fallback SHA-256 truncado em 12 hex. **FNV-1a foi removido** por ser fraco para PII previsível (telefone E.164). `META_APP_SECRET` é proibido como pepper de logs. Pendência: provisionar `LOG_HASH_SECRET` dedicado e migrar para HMAC definitivo.
2. **`headers_json`** — passou a usar `safeHeaders()` com **allowlist canônica** (15 headers técnicos/forenses). Authorization, Cookie, Bearer, accept/accept-encoding, baggage, cf-visitor, cf-ew-via, cf-worker, cdn-loop, x-forwarded-port e qualquer outro header são descartados.

**Preservado (forense / dedupe / suporte):**
`body_sha256` íntegro, `signature_header`, `content_length`, `remote_ip` (IP Meta/Cloudflare), `user_agent`, `trace_id`, `received_at`, `query_string`, `wa_message_ids` (dedupe Camada 6), `phone_number_ids`.

**Removido / mascarado em novos registros:**
`profile.name`, `text.body`, `wa_id` cru, `message.from` cru, `status.recipient_id` cru, mídia/url assinada, payload bruto, headers fora da allowlist.

**Validação técnica executada:**
- Payload Meta sintético (texto + status) processado localmente via Deno: resumo gerado com 322B, sem `5573991681425`/`5511999998888`/`João`/`Olá` no output.
- Allowlist testada com headers `authorization`/`cookie`/`baggage` injetados: descartados; mantidos `x-hub-signature-256`/`content-type`/`user-agent`/`cf-ray`.
- Payload não-JSON: fallback `{parse_error, content_type, byte_length}` válido.
- `JSON.parse(body_preview)` válido em ambos os casos.

**Não alterado:**
- Dados retroativos em `whatsapp_webhook_raw_audit` (5.934 linhas pré-11/05/2026 → tratamento opcional em F2.13.2.B2).
- `whatsapp_inbound_messages.raw_payload` → F2.13.2.C.
- `agenda_command_log` → fora desta fase.
- Schema, RLS, RPC, migrations, UI/UX, wallet, `credit_ledger`, `service_usage_events`, `platform_cost_ledger`, pricing.
- Nenhum webhook real, IA, mensagem, provider ou cron foi executado.

**Pendências registradas:**
- **F2.13.2.C** — sanitização e retenção 90d de `whatsapp_inbound_messages.raw_payload`.

🟢 **GO F2.13.2.B — fechado.**

---

## 21.6. F2.13.2.B2 — TTL e limpeza de PII em backlog (11/05/2026)

**Decisão aplicada:** opção D híbrida (TTL prospectivo + limpeza imediata de backlog, sem re-sanitização com hashes, sem `LOG_HASH_SECRET` nesta fase).

**Cutoffs fixos da execução:**
- `cleanup_cutoff = 2026-05-04 18:56:40 UTC` (now − 7 dias)
- `ttl_cutoff = 2026-04-11 18:56:40 UTC` (now − 30 dias)

**Snapshot pré-migration:**
- Total: 5.936 linhas (min `2026-04-20`, max `2026-05-11 18:36:09Z`)
- Linhas com `body_preview` não-nulo: 5.936
- Alvo de limpeza (`< cleanup_cutoff`): 5.679
- Alvo de TTL imediato (`< ttl_cutoff`): 0
- Preservadas (últimos 7d): 257

**Ações aplicadas (migration única):**
1. `UPDATE` em linhas com `received_at < cleanup_cutoff`: `body_preview = NULL`, `headers_json = '{}'::jsonb`. **5.679 linhas atualizadas.**
2. Cron `cleanup_whatsapp_webhook_raw_audit_30d` (jobid 53), schedule `0 6 * * *` (= 03:00 BRT), comando: `DELETE FROM public.whatsapp_webhook_raw_audit WHERE received_at < now() - interval '30 days'`.

**Snapshot pós-migration:**
- Total inalterado: 5.936 linhas (TTL atual = 0 linhas elegíveis para delete).
- `rows_with_body_preview = 257` (todas com `received_at >= now()-7d`).
- `rows_with_headers <> '{}' = 257` (idem).
- `leaked_old = 0` — nenhuma PII residual em backlog.
- `body_sha256`, `signature_header`, `trace_id` preservados em **todas** as 5.936 linhas.

**Validações forenses confirmadas:** `id`, `received_at`, `trace_id`, `method`, `remote_ip`, `user_agent`, `signature_header`, `content_length`, `body_sha256`, `query_string` mantidos em todas as linhas.

**Não tocado nesta fase:** `whatsapp_inbound_messages.raw_payload`, `agenda_command_log`, wallet, `credit_ledger`, `service_usage_events`, `platform_cost_ledger`, pricing, `service_key`, UI/UX, RLS, RPC, edges. Sem re-sanitização retroativa com hashes. `LOG_HASH_SECRET` não provisionado nesta fase.

**Pendências registradas:**
- **F2.13.2.C** — sanitização e retenção de `whatsapp_inbound_messages.raw_payload` (executada — ver §21.7).
- Provisionamento futuro de `LOG_HASH_SECRET` (HMAC-SHA256 definitivo).

🟢 **GO F2.13.2.B2 — fechado.**

---

## 21.7. F2.13.2.C — TTL e limpeza retroativa de `whatsapp_inbound_messages.raw_payload` (11/05/2026)

**Decisão aplicada:** opção E híbrida, somente parte de dados/retenção. Stop-write em `meta-whatsapp-webhook` fica em pendência separada (F2.13.2.C-CODE).

### Auditoria pré-execução
- 4.077 linhas, 1 tenant, período 2025-04-20 → 2026-05-11, 100% com `raw_payload` não-nulo.
- Conteúdo do `raw_payload`: `from` (telefone E.164 cru, 100%), `id` (wamid, 100%), `type` (100%), `timestamp` (100%), `text.body` (91%), `from_user_id` (Meta ID, 51%), metadados de mídia/reação/contexto (<4%). Não contém `profile.name` (esse vive só em `whatsapp_webhook_raw_audit`).
- **Duplicação confirmada:** `from`/`id`/`type`/`text.body` já existem em `from_phone`/`external_message_id`/`message_type`/`message_content`.
- **Mapa de uso (rg + análise):** único escritor `meta-whatsapp-webhook:318`; **zero leitores** em edges, SPA, watchers (`whatsapp-orphan-watcher`, `whatsapp-health-summary`, `whatsapp-cross-business-detector`), dedupe (Camada 6 usa `external_message_id`), AI Support, Agenda, cobrança ou UI.

### Cutoffs fixos
- `cleanup_cutoff = now() − interval '7 days'`
- `ttl_cutoff = now() − interval '30 days'`

### Snapshot pré
| Métrica | Valor |
|---|---|
| Total | 4.077 |
| `raw_payload` não-nulo | 4.077 |
| Alvo limpeza imediata | 3.894 |
| Preservadas (últimos 7d) | 183 |
| Alvo TTL prospectivo (>30d) | 1.981 |
| Com `conversation_id` | 1.468 |
| Com `media_url` | 0 |

### Execução
1. **Limpeza imediata:** `UPDATE public.whatsapp_inbound_messages SET raw_payload = NULL WHERE timestamp < (now() - interval '7 days') AND raw_payload IS NOT NULL` → **3.894 linhas atualizadas**.
2. **Cron prospectivo:** `cleanup_whatsapp_inbound_raw_payload_30d` (jobid 54), schedule `15 6 * * *` (= 03:15 BRT, deslocado 15 min do cron F2.13.2.B2 das 03:00 BRT). Ação: `UPDATE … SET raw_payload = NULL WHERE timestamp < now() − interval '30 days' AND raw_payload IS NOT NULL`.

### Snapshot pós (validação)
| Validação | Resultado |
|---|---|
| Total de linhas | 4.077 (zero deleção) |
| `raw_payload` não-nulo | 183 (= preservadas dos últimos 7d) |
| Linhas antigas (>7d) com `raw_payload` residual | **0** |
| `from_phone` populado | 4.077 (100%) |
| `message_content` populado | 4.077 (100%) |
| `external_message_id` populado | 4.077 (100%) |
| `conversation_id` populado | 1.468 (= snapshot pré) |
| Cron criado (não duplicado) | jobid 54 ✅ |

### Confirmações de não-impacto
- ✅ Linha inteira preservada — sem `DELETE` em nenhum momento.
- ✅ `from_phone`, `to_phone`, `message_content`, `external_message_id`, `message_type`, `timestamp`, `conversation_id`, `media_url`, `processed_at`, `processed_by`, `processing_status`, `processing_error` 100% intactos.
- ✅ Dedupe Camada 6 segue baseado em `external_message_id`.
- ✅ AI Support, Agenda, watchers operacionais e UI **não** afetados (não dependem de `raw_payload`).
- ✅ `whatsapp_webhook_raw_audit`, `agenda_command_log`, wallet, `credit_ledger`, `service_usage_events`, `platform_cost_ledger`, RLS, RPC, edges **não** alterados.
- ✅ Sem alteração de UI/UX, código de aplicação, schema (apenas DML + cron), ou cobrança.

### Pendências registradas
- **F2.13.2.C-CODE** — alterar `meta-whatsapp-webhook/index.ts:318` para parar de gravar `raw_payload` em novos inserts (até lá, TTL diário de 30d cobre o prazo).
- Provisionamento futuro de `LOG_HASH_SECRET` (HMAC-SHA256 definitivo) — herdado de F2.13.2.B.

🟢 **GO F2.13.2.C — fechado.** Próximo passo recomendado: **F2.13.2.C-CODE em PLANNER** (parar a escrita futura de `raw_payload` no `meta-whatsapp-webhook`).

---

## 21.8. F2.13.2.C-CODE — Stop-write de `raw_payload` em `whatsapp_inbound_messages` (11/05/2026)

**Decisão aplicada:** parar a gravação de PII redundante no `meta-whatsapp-webhook`, mantendo o cron de retenção como rede de segurança.

### Auditoria pré-execução (PLANNER)
- Writer único: `supabase/functions/meta-whatsapp-webhook/index.ts:318`.
- Coluna `raw_payload`: `jsonb`, `is_nullable=YES`, sem default, sem CHECK.
- `information_schema.triggers` em `whatsapp_inbound_messages`: vazio.
- `information_schema.routines` no schema `public` referenciando `raw_payload`: vazio.
- Leitores reais (rg em `supabase/functions/` + `src/`): zero (apenas `types.ts`).
- Dedupe Camada 6 usa `external_message_id`, não `raw_payload`.

### Alteração aplicada
Mudança cirúrgica de uma única linha no INSERT de `whatsapp_inbound_messages`:

```diff
- raw_payload: message,
+ raw_payload: null,
```

Demais campos do INSERT (`tenant_id`, `provider`, `external_message_id`, `from_phone`, `to_phone`, `message_type`, `message_content`, `media_url`, `timestamp`, `processing_status`) intactos. Edge function `meta-whatsapp-webhook` redeployada.

### Cobertura por tipo de mensagem
- **text / image / video / audio / document / location:** colunas estruturadas cobrem 100% do uso operacional.
- **reaction / context (reply) / referral (Click-to-WA Ads) / interactive (button/list reply) / system / unsupported:** sem leitor atual; perda apenas forense.

### Confirmações de não-impacto
- ✅ Cron `cleanup_whatsapp_inbound_raw_payload_30d` (jobid 54) **mantido ativo** como rede de segurança.
- ✅ Cron `cleanup_whatsapp_webhook_raw_audit_30d` (jobid 53) **não alterado**.
- ✅ Nenhum dado antigo alterado nesta etapa (sem DML).
- ✅ AI Support, Agenda, watchers, dedupe, atendimento, UI/UX **não** afetados.
- ✅ `whatsapp_webhook_raw_audit`, `agenda_command_log`, wallet, `credit_ledger`, `service_usage_events`, `platform_cost_ledger`, RLS, RPC, schema **não** alterados.
- ✅ Nenhum webhook real, mensagem real, IA ou provider executado nesta etapa.

### Backlog futuro registrado
- **Extração estruturada de `referral`, `interactive`, `context` e `reaction` para colunas próprias** antes de qualquer ativação de Click-to-WhatsApp Ads, botões IA, replies contextuais ou reações como gatilho. Sem essa extração, esses dados deixam de existir a partir do go-live de F2.13.2.C-CODE.
- Provisionamento futuro de `LOG_HASH_SECRET` (HMAC-SHA256 definitivo) — herdado de F2.13.2.B.

🟢 **GO F2.13.2.C-CODE — fechado.** Próximo passo recomendado: monitorar primeiros inbounds reais pós-deploy e confirmar `raw_payload IS NULL` no novo registro.

