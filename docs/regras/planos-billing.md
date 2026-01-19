# Planos e Billing — Regras e Especificações

> **STATUS:** 🟧 Pending (em construção)

## Visão Geral

Sistema de planos, assinaturas e cobrança para tenants da plataforma.

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/config/feature-access.ts` | Configuração de acesso por plano |
| `src/hooks/usePlans.ts` | Hooks de planos e assinaturas |
| `src/hooks/useTenantAccess.ts` | Hook de acesso do tenant |
| `src/hooks/useTenantType.ts` | Hook de tipo do tenant |
| `src/pages/platform/PlatformBilling.tsx` | Dashboard de billing (admin) |
| `src/pages/account/Billing.tsx` | Página de billing do tenant |

---

## Hierarquia de Planos

| Plano | Nível | Descrição |
|-------|-------|-----------|
| `start` | 1 | Plano inicial/gratuito |
| `growth` | 2 | Crescimento |
| `scale` | 3 | Escala |
| `enterprise` | 4 | Empresarial |
| `unlimited` | 5 | Ilimitado (interno) |

---

## Tipos de Tenant

| Tipo | Descrição |
|------|-----------|
| `platform` | Tenant da plataforma (Comando Central) |
| `customer` | Tenant cliente (loja) |

---

## Campos Especiais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `plan` | enum | Plano atual do tenant |
| `is_special` | boolean | Acesso especial (equivale a unlimited) |
| `type` | enum | 'platform' ou 'customer' |

---

## Verificação de Acesso por Plano

```typescript
// src/config/feature-access.ts
export const FEATURE_CONFIG: Record<string, FeatureConfig> = {
  'fiscal': {
    minPlan: 'enterprise',
    description: 'Módulo fiscal para emissão de NF-e',
  },
  'whatsapp': {
    minPlan: 'enterprise',
    description: 'Integração com WhatsApp Business',
  },
  'automations': {
    minPlan: 'scale',
    description: 'Automações de marketing e operações',
  },
  'multi_users': {
    allowedPlans: ['enterprise', 'unlimited'],
    description: 'Múltiplos usuários por tenant',
  },
};
```

---

## Hook useTenantAccess

```typescript
const {
  tenantType,    // 'platform' | 'customer'
  plan,          // 'start' | 'growth' | 'scale' | 'enterprise' | 'unlimited'
  isSpecial,     // boolean
  isPlatform,    // boolean
  isUnlimited,   // plan === 'unlimited' || isSpecial
  planLevel,     // 1-5
  canAccess,     // (featureKey) => boolean
  isLoading,
  overrides,     // feature overrides do tenant
} = useTenantAccess();
```

---

## Tabelas do Banco

### `billing_plans`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| plan_key | text | PK (start, growth, etc) |
| name | text | Nome exibido |
| price_monthly_cents | int | Preço mensal em centavos |
| price_annual_cents | int | Preço anual em centavos |
| included_orders_per_month | int | Limite de pedidos |
| feature_bullets | jsonb | Lista de features |
| is_active | boolean | Se está ativo |
| is_public | boolean | Se aparece na página de preços |

### `tenant_subscriptions`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| tenant_id | uuid | FK para tenants |
| plan_key | text | Plano atual |
| billing_cycle | text | 'monthly' ou 'annual' |
| status | text | 'active', 'trial', 'past_due', etc |
| current_period_end | timestamptz | Fim do período atual |
| mp_preapproval_id | text | ID da assinatura no Mercado Pago |

### `tenant_feature_overrides`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| tenant_id | uuid | FK para tenants |
| feature_key | text | Chave da feature |
| is_enabled | boolean | Se está habilitada |

### `tenant_monthly_usage`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| tenant_id | uuid | FK para tenants |
| year_month | text | '2024-01', etc |
| orders_count | int | Quantidade de pedidos |
| gmv_cents | int | Volume bruto de vendas |

---

## Feature Overrides

Permite habilitar/desabilitar features específicas para um tenant, sobrescrevendo a regra do plano.

```typescript
// Exemplo: habilitar fiscal para tenant específico
// mesmo que não tenha plano enterprise
INSERT INTO tenant_feature_overrides 
(tenant_id, feature_key, is_enabled)
VALUES ('uuid', 'fiscal', true);
```

---

## Fluxo de Cobrança (Mercado Pago)

```
1. Tenant escolhe plano
2. Frontend chama `useActivateSubscription()`
3. Edge function cria preapproval no MP
4. MP retorna init_point (URL de pagamento)
5. Tenant completa pagamento
6. Webhook MP notifica status
7. Sistema atualiza tenant_subscriptions
```

---

## Dashboard Admin (PlatformBilling)

Funcionalidades:
- Lista de todas as assinaturas
- Métricas: total, ativos, inadimplentes, MRR
- Gestão de planos
- Histórico de eventos de billing

---

## Verificação de Limite de Pedidos

```typescript
// Hook useOrderLimitCheck
const { 
  allowed,           // boolean
  current_count,     // número atual
  limit,             // limite do plano
  remaining,         // restantes
  percentage_used,   // % usado
} = useOrderLimitCheck();
```

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Default allow** | Features não configuradas são permitidas |
| **Unlimited bypass** | `isUnlimited` = true ignora todas as restrições |
| **Override priority** | Feature override > regra do plano |
| **Platform bypass** | Tenants `platform` não usam feature gating |

---

## Status de Implementação

- [x] Hierarquia de planos
- [x] Hook useTenantAccess
- [x] Feature overrides
- [x] Dashboard admin básico
- [ ] Integração completa Mercado Pago
- [ ] Emails de cobrança
- [ ] Dunning (inadimplência)
- [ ] Upgrade/downgrade automático
