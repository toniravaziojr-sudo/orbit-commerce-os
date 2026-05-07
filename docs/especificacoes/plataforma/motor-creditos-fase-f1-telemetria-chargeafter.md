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
