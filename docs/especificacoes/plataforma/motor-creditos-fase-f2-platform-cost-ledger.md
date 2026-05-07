# Motor de Créditos — Fase F2: Registro de Custos Absorvidos pela Plataforma

> **Camada:** Layer 2 — Especificação de Plataforma
> **Status:** F2.1 ✅ GO (fundação) — F2.2 pendente (plug de edges)
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

**✅ GO** — fundação corrigida, validada e documentada. RPC e helper estão prontos para receber chamadas reais sem alterar wallet/ledger de tenant.

## 8. Pendências F2.2 (próxima etapa, não iniciar sem nova autorização)

Auditar 1×1 e plugar `recordPlatformCost()` nas edges abaixo somente após validação individual de:
1. Custo externo real existe?
2. `cost_owner='platform'`?
3. Tem `service_key` com pricing confiável?
4. Não envia comunicação para cliente final em teste?

Edges candidatas:
- `send-auth-email`
- `resend-signup-email`
- `auth-email-hook`
- `send-system-email` (separar origem plataforma vs tenant antes — hoje cobra `chargeAfter` no tenant fictício de plataforma)
- `command-insights-generate` (apenas mapeamento; cron global)
- `meta-token-health-check`
- `platform-costs-sync`
- `ai-learning-aggregator`

Ver `workers-crons-pagos.md` §2.2 para a regra de classificação `platform_absorbed`.

## 9. Documentos relacionados

- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/motor-creditos-fase-f1-telemetria-chargeafter.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/workers-crons-pagos.md`
