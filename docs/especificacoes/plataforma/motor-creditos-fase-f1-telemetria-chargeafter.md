# Motor de Créditos — Fase F1: Telemetria universal do `chargeAfter`

> **Camada:** Layer 2 — Especificação de Plataforma
> **Status:** Ativo (2026-05-07)
> **Escopo:** apenas telemetria — sem impacto em wallet, ledger, pricing, markup, RLS, UI.

## Problema

Edges plugadas com `chargeAfter` (IA texto, e-mail, WhatsApp, fiscal, scrape, ads) debitavam corretamente em `credit_ledger`, mas **não** registravam em `service_usage_events`. Resultado: painel admin `/platform/credits` e relatórios por categoria/provedor ficavam cegos para esses consumos.

## Solução

`_shared/credits/charge-after.ts` foi estendido. Após o `capture` bem-sucedido, o helper grava 1 linha em `service_usage_events`:

| Campo | Valor |
|---|---|
| `tenant_id` | tenant cobrado |
| `service_key` | mesma do `chargeAfter` |
| `category`, `provider` | resolvidos via `service_pricing` (sem expor pricing/markup) |
| `units_json` | espelha `args.units` |
| `status` | `captured` |
| `cost_owner` | `tenant` |
| `origin_function` | `args.feature` |
| `credit_ledger_id` | id do ledger gerado pelo capture |
| `metadata` | `motor_version=v2`, `mode=live`, `source=charge_after_telemetry_v1`, `feature`, `job_id`, `credits_charged`, `provider_cost_usd_snapshot`, `idempotency_key`, `user_metadata` (sanitizado) |

## Idempotência

UNIQUE parcial em `service_usage_events(credit_ledger_id) WHERE credit_ledger_id IS NOT NULL`. Retry com mesmo `ledger_id` é silenciosamente bloqueado pelo banco (validado em produção: segundo insert retorna `23505` e o helper trata como `idempotent_skip`).

## Segurança

- Tenant continua sem ler eventos com `cost_owner='platform'` (RLS preexistente).
- `metadata` sanitiza chaves sensíveis (`cost_usd`, `markup_pct`, `sell_usd`, `fx_rate`, `api_key`, `token`, `authorization`, `secret`, `password`).
- Telemetria roda com `service_role` dentro do helper. Falha NUNCA quebra cobrança.

## O que NÃO mudou

- Nenhuma alteração em `credit_wallet`, `credit_ledger`, RPCs, RLS, pricing, markup, live_service_keys, UI ou rollout.
- Nenhum backfill de eventos antigos.
- `tenant_ai_usage` permanece intocada nesta fase.

## Validações executadas

1. ✅ Pré-check confirmou que `chargeAfter` não escrevia em `service_usage_events`.
2. ✅ Schema de `service_usage_events` confirmado: campos obrigatórios `tenant_id (nullable)`, `cost_owner`, `service_key`, `category`, `provider`, `units_json`, `status`.
3. ✅ Migration: criou índice `uq_sue_credit_ledger_id` (parcial, `WHERE credit_ledger_id IS NOT NULL`).
4. ✅ Insert real com `credit_ledger_id` existente → sucesso.
5. ✅ Insert duplicado com mesmo `credit_ledger_id` → `23505 duplicate key`.
6. ✅ Limpeza do registro de teste.

## Próximo passo recomendado (F2)

Plugar `recordPlatformCost()` em edges classificadas como `cost_owner='platform'` (`command-insights-generate`, `ai-learning-aggregator`, `send-auth-email`, `resend-signup-email`, `auth-email-hook`, `send-system-email` quando origem plataforma) — `platform_cost_ledger` hoje está zerado.

## Documentos relacionados

- `motor-creditos.md`
- `funcoes-pagas.md`
- `ux-admin-creditos-custos.md`

---

## Patch F1.1 — Normalização de jobId UUID (2026-05-07)

### Causa raiz
`reserve_credits_v2(p_job_id UUID)` rejeita strings não-UUID. Providers externos
(SendGrid `X-Message-Id`, etc.) retornam IDs arbitrários, quebrando a cobrança
após a entrega do serviço (operação concluída sem débito).

### Solução
No helper `chargeAfter` (`_shared/credits/charge-after.ts`):

1. Se `jobId` já for UUID → usa como está.
2. Caso contrário → deriva `billingJobId` via **UUID v5 determinístico**
   namespaced por `(tenantId, serviceKey, externalJobId)`.
3. Mesmo input → mesmo UUID (idempotência preservada).
4. Tenants/serviços diferentes → UUIDs diferentes (sem colisão multi-tenant).
5. `jobId` original do provider é preservado em `metadata.provider_job_id`.
6. Quando derivado, `metadata.billing_job_id_derived = true` e `metadata.billing_job_id = <uuid>`.

### Garantias
- RPCs **não foram alteradas**.
- Wallet/ledger/service_usage_events **não foram alterados manualmente**.
- Sem backfill da cobrança falha do teste anterior.
- Pricing/markup/cost_owner inalterados.
- Tenant não vê `provider_job_id` nem metadata técnica (RLS bloqueia leitura).
- Fix vale para **todas as edges** que usam `chargeAfter`, não só email-send.

### Validação executada
| # | Cenário | Resultado |
|---|---------|-----------|
| 1 | UUID válido permanece igual | ✅ |
| 2 | Não-UUID → UUID v5 válido | ✅ `e04fdab1-78b8-55a6-a779-29fd7fe2a93f` |
| 3 | Mesmo input → mesmo UUID | ✅ |
| 4 | Tenants diferentes → UUIDs distintos | ✅ |
| 5 | Service keys diferentes → UUIDs distintos | ✅ |

### Pendência
Reenvio manual de 1 e-mail real pela UI para fechar GO/NO-GO funcional da F1.

---

## Patch F1.2 — Aprovação simbólica temporária do `email-transactional-send` (2026-05-07)

### Contexto
Após a F1.1, o reenvio real falhou com `PRICE_NOT_APPROVED`: o `service_pricing`
de `email-transactional-send` estava marcado como placeholder não aprovado para
live (`approved_for_live=false`, `live_block_reason=placeholder_price_not_approved`).

### Decisão de negócio (operador)
Aprovar o preço atual como **simbólico temporário** apenas para destravar a
validação ponta a ponta da F1. Custo e markup mantidos: `cost_usd=0.00060`,
`markup_pct=100`, `provider=sendgrid`, `category=email`.

### Blast radius confirmado antes da aplicação
- `service_pricing` é **global por `service_key`** (não tem `tenant_id`).
- Apenas **1 tenant** possui `motor_v2_enabled=true` em `tenant_credit_motor_config`:
  Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`).
- Nenhum outro tenant pode ser cobrado pelo motor v2 hoje.

### Alteração aplicada
- `metadata.approved_for_live = true`
- `metadata.placeholder = false`
- Removidos: `metadata.live_block_reason`, `metadata.requires_review`
- Adicionados: `approved_at`, `approved_by=operator_manual_f1_validation`,
  `approval_note` (registra natureza simbólica temporária).
- **Nada mais** foi alterado: nenhum outro pricing aprovado, sem cobrança
  retroativa, sem backfill, sem mudança em wallet/ledger/eventos antigos.

### Decisão futura (NÃO implementar agora)
Criar painel admin para gerenciar custo/preço por `service_key` (e-mail,
imagem por tipo, vídeo por tipo, etc.). Será especificado em onda separada.

### Pendência
Reenvio manual de 1 e-mail real pela UI para fechar GO/NO-GO funcional da F1.
