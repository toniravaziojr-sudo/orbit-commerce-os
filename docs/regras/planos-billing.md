# Planos e Billing — Regras e Especificações

> **STATUS:** 🟢 Implementado (v2.2)  
> **Última atualização:** 2025-01-28

---

## Visão Geral

Sistema de planos, assinaturas, créditos de IA e cobrança para tenants da plataforma.

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/config/feature-access.ts` | Configuração de acesso por plano |
| `src/hooks/usePlans.ts` | Hooks de planos e assinaturas |
| `src/hooks/useCredits.ts` | Hooks de créditos de IA |
| `src/hooks/useTenantAccess.ts` | Hook de acesso do tenant |
| `src/hooks/useSubscriptionStatus.ts` | Hook de status da assinatura e cartão |
| `src/components/billing/PaymentMethodGate.tsx` | Componente de bloqueio por cartão |
| `src/pages/settings/AddPaymentMethod.tsx` | Página de cadastro de cartão |
| `src/pages/platform/PlatformBilling.tsx` | Dashboard de billing (admin) |
| `src/pages/AIPackages.tsx` | Página de créditos de IA |

---

## Estrutura de Planos (8 tiers)

| Plano | Preço/mês | Pedidos/mês | Sugestão |
|-------|-----------|-------------|----------|
| `basico` | 2,5% vendas | Ilimitado | Para quem está começando |
| `evolucao` | R$ 397,00 | 350 | Até 30 mil/mês |
| `profissional` | R$ 699,90 | 500 | 30 a 50 mil/mês |
| `avancado` | R$ 1.299,00 | 1.000 | 70 a 120 mil/mês |
| `impulso` | R$ 2.499,90 | 1.500 | 130 a 200 mil/mês |
| `consolidar` | R$ 3.997,00 | 3.000 | 200 a 300 mil/mês |
| `comando_maximo` | R$ 5.990,00 | 5.000 | Acima de 300 mil/mês |
| `customizado` | Sob consulta | Negociável | Faturamento consolidado |

---

## Tabelas do Banco

### `billing_plans`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| plan_key | TEXT PK | Identificador do plano |
| name | TEXT | Nome exibido |
| description | TEXT | Descrição curta |
| price_monthly_cents | INT | Preço mensal em centavos |
| price_annual_cents | INT | Preço anual em centavos |
| included_orders_per_month | INT | Limite de pedidos |
| support_level | TEXT | email, chat, whatsapp, priority, dedicated |
| feature_bullets | JSONB | Lista de features para exibição |
| is_recommended | BOOL | Se é o plano destacado |
| sort_order | INT | Ordem de exibição |

### `plan_limits`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| plan_key | TEXT FK | Referência ao plano |
| orders_per_month | INT | Limite de pedidos |
| sales_fee_bps | INT | Taxa sobre vendas (basis points, 250 = 2.5%) |
| max_users | INT | Limite de usuários |
| storage_bytes | BIGINT | Armazenamento em bytes |
| import_uses_per_month | INT | Usos de importação |
| assistant_interactions_per_month | INT | Interações com Auxiliar de Comando |
| ai_images_per_month | INT | Imagens IA incluídas |
| ai_videos_per_month | INT | Vídeos IA incluídos |
| creative_* | INT | Limites do Gestor de Criativos |
| traffic_* | INT | Limites de Gestão de Tráfego |
| seo_generations_per_month | INT | Gerações SEO incluídas |

### `plan_module_access`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| plan_key | TEXT FK | Referência ao plano |
| module_key | TEXT | Identificador do módulo |
| access_level | TEXT | 'none', 'partial', 'full' |
| blocked_features | JSONB | Features bloqueadas |
| notes | TEXT | Observações |

---

## Sistema de Créditos de IA

### Constantes
```typescript
CREDIT_USD = 0.01      // 1 crédito = US$ 0,01
CREDIT_MARKUP = 1.5    // 50% markup sobre custo
```

### Tabelas

#### `credit_packages`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| sku | TEXT | Identificador único |
| name | TEXT | Nome do pacote |
| credits | INT | Créditos incluídos |
| bonus_credits | INT | Bônus adicional |
| price_cents | INT | Preço em centavos |

#### `credit_wallet`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| tenant_id | UUID FK | Tenant |
| balance_credits | INT | Saldo atual |
| reserved_credits | INT | Créditos reservados |
| lifetime_purchased | INT | Total comprado |
| lifetime_consumed | INT | Total consumido |

#### `credit_ledger`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| transaction_type | TEXT | purchase, consume, reserve, refund, bonus, adjust |
| provider | TEXT | openai, fal, gemini |
| model | TEXT | Modelo utilizado |
| feature | TEXT | chat, vision, image, video, etc |
| units_json | JSONB | Unidades consumidas |
| cost_usd | DECIMAL | Custo real do provedor |
| sell_usd | DECIMAL | Custo com markup |
| credits_delta | INT | Variação de créditos |
| idempotency_key | TEXT | Controle de duplicação |

#### `ai_pricing`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| provider | TEXT | Provedor (openai, fal, gemini) |
| model | TEXT | Modelo |
| pricing_type | TEXT | per_1m_tokens_in, per_second, per_image, etc |
| cost_usd | DECIMAL | Custo base do provedor |
| resolution | TEXT | Resolução (para imagens) |
| quality | TEXT | Qualidade (standard, pro) |
| has_audio | BOOL | Se inclui áudio (para vídeos) |

### Pacotes Disponíveis (SKUs)

| SKU | Créditos | Bônus | Preço |
|-----|----------|-------|-------|
| CC_CREDITS_1K | 1.000 | 0 | R$ 10,00 |
| CC_CREDITS_5K | 5.000 | 0 | R$ 50,00 |
| CC_CREDITS_15K | 15.000 | 500 | R$ 150,00 |
| CC_CREDITS_50K | 50.000 | 2.500 | R$ 500,00 |
| CC_CREDITS_150K | 150.000 | 10.000 | R$ 1.500,00 |
| CC_CREDITS_500K | 500.000 | 50.000 | R$ 5.000,00 |

### Cálculo de Créditos

```typescript
// Custo do provedor → Preço de venda → Créditos
sell_usd = cost_usd * CREDIT_MARKUP  // +50%
credits = ceil(sell_usd / CREDIT_USD)
```

### Funções RPC

| Função | Descrição |
|--------|-----------|
| `check_credit_balance(tenant_id, credits_needed)` | Verifica saldo disponível |
| `reserve_credits(tenant_id, credits, idempotency_key)` | Reserva para job longo |
| `consume_credits(...)` | Debita créditos após uso |
| `add_credits(tenant_id, credits, bonus, idempotency_key)` | Adiciona após compra |

---

## Fluxo de Débito de Créditos

```
1. Verificar saldo: check_credit_balance()
2. Se job longo (vídeo/avatar): reserve_credits()
3. Executar operação de IA
4. Calcular custo real com usage retornado
5. consume_credits() com idempotency_key
6. Para reservas: ajustar diferença ou refund
```

---

## Restrições por Módulo

### Exemplo: Plano Básico
| Módulo | Acesso | Bloqueios |
|--------|--------|-----------|
| Central | Parcial | analytics, reports, agenda, assistant |
| E-commerce | Parcial | export_orders, export_customers |
| Marketing Avançado | Nenhum | Tudo bloqueado |
| CRM | Parcial | whatsapp_notifications, support_chat |
| Parcerias | Nenhum | Tudo bloqueado |
| Suporte | Parcial | whatsapp, customizacoes |

---

## Extras por Uso Excedente

O sistema rastreia automaticamente o uso de recursos que excedem os limites incluídos no plano.

### Campos de Tracking (`tenant_monthly_usage`)
| Campo | Descrição |
|-------|-----------|
| `email_notifications_count` | Total de emails enviados no mês |
| `whatsapp_notifications_count` | Total de WhatsApp enviados |
| `support_interactions_count` | Total de interações de suporte |
| `extra_email_cents` | Custo de emails excedentes |
| `extra_whatsapp_cents` | Custo de WhatsApp excedentes |
| `extra_support_cents` | Custo de suporte excedente |

### Limites por Plano (`plan_limits`)
| Campo | Descrição |
|-------|-----------|
| `included_email_notifications` | Emails incluídos no plano |
| `included_whatsapp_notifications` | WhatsApp incluídos |
| `included_support_interactions` | Interações de suporte incluídas |
| `extra_email_price_cents` | Preço por email extra (default: 5) |
| `extra_whatsapp_price_cents` | Preço por WhatsApp extra (default: 15) |
| `extra_support_price_cents` | Preço por interação extra (default: 10) |

### RPC: `record_notification_usage`
```sql
SELECT record_notification_usage(
  p_tenant_id := 'uuid',
  p_channel := 'email', -- ou 'whatsapp'
  p_count := 1
);
```

---

## Avisos Obrigatórios na UI

1. **Pagamento:** "Todos os planos requerem cartão de crédito"
2. **Custos variáveis:** "Custos de uso de IA podem variar. Tabela de valores disponível no sistema."
3. **Alternativa:** "Não tem cartão de crédito? Fale conosco"

---

## Fluxo de Onboarding Unificado

Tanto signup quanto login devem passar pelo mesmo fluxo de seleção de plano.

### Sequência Obrigatória

```
1. Auth (signup/login/OAuth)
   ↓
2. ProtectedRoute verifica se usuário tem tenant
   ↓
3. Se NÃO tem tenant → Redireciona para /start (seleção de plano)
   - NUNCA para /create-store diretamente
   ↓
4. Usuário escolhe plano em /start:
   - Plano pago → Checkout Mercado Pago → Tenant criado após pagamento
   - Plano básico → create_tenant_for_user com status 'pending_payment_method'
   ↓
5. Plano básico: Usuário pode usar sistema, mas funcionalidades completas
   exigem cadastro de cartão (PaymentMethodGate)
```

### Redirecionamento no ProtectedRoute

**CRÍTICO:** O `ProtectedRoute.tsx` deve redirecionar usuários sem tenant para `/start`:

```typescript
// src/components/auth/ProtectedRoute.tsx
if (requireTenant && tenants.length === 0 && !hasPendingInvite && hasWaitedForData && !wasInvited) {
  console.log('[ProtectedRoute] User has no tenants - redirecting to /start for plan selection');
  return <Navigate to="/start" replace />;
}
```

### RPC `create_tenant_for_user`

**CRÍTICO:** O RPC deve criar assinaturas com `pending_payment_method` para plano básico:

```sql
-- CORRETO
INSERT INTO public.tenant_subscriptions (tenant_id, plan_key, status, billing_cycle)
VALUES (v_tenant.id, 'basico', 'pending_payment_method', 'monthly');

-- ERRADO (causava bypass)
-- VALUES (v_tenant.id, 'basico', 'active', 'monthly');
```

### OAuth (Google Login)

Usuários que fazem login via OAuth também passam pelo fluxo:
1. Autenticam com Google
2. ProtectedRoute detecta que não têm tenant
3. Redireciona para `/start`
4. `StartInfo.tsx` detecta sessão existente e pré-preenche dados
5. Ao confirmar, usa `create_tenant_for_user` (não cria novo usuário)

### Status da Assinatura

| Status | Descrição |
|--------|-----------|
| `pending_payment_method` | Plano básico sem cartão cadastrado |
| `active` | Assinatura ativa (pago ou básico com cartão) |
| `suspended` | Pagamento pendente/falhou |
| `cancelled` | Assinatura cancelada |

### Hook: `useSubscriptionStatus`

```typescript
const { 
  subscription,      // Dados completos da assinatura
  needsPaymentMethod, // true se precisa cadastrar cartão
  canPublishStore,   // true se pode publicar loja
  canUseFullFeatures, // true se pode usar todas funcionalidades
  isBasicPlan,       // true se é plano básico
  hasPaymentMethod,  // true se tem cartão cadastrado
} = useSubscriptionStatus();
```

### Regras de Acesso por Plano

| Plano | Pode usar sistema | Pode publicar loja | Funcionalidades completas |
|-------|-------------------|--------------------|-----------------------------|
| Básico sem cartão | ✅ Sim | ❌ Não | ❌ Não |
| Básico com cartão | ✅ Sim | ✅ Sim | ✅ Sim |
| Planos pagos (active) | ✅ Sim | ✅ Sim | ✅ Sim |
| Planos pagos (suspended) | ⚠️ Limitado | ❌ Não | ❌ Não |

---

## PaymentMethodGate — Bloqueio por Cartão

Componente que bloqueia ações até o usuário cadastrar cartão de crédito.

### Uso

```tsx
import { PaymentMethodGate } from '@/components/billing/PaymentMethodGate';

// Modo block (padrão) - substitui conteúdo
<PaymentMethodGate action="publicar sua loja">
  <PublishStoreButton />
</PaymentMethodGate>

// Modo blur - mostra conteúdo borrado com overlay
<PaymentMethodGate mode="blur" action="acessar relatórios">
  <ReportsPage />
</PaymentMethodGate>

// Modo alert - mostra alerta acima do conteúdo
<PaymentMethodGate mode="alert" action="criar campanha">
  <CampaignForm />
</PaymentMethodGate>
```

### Props

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `mode` | `'block' \| 'blur' \| 'alert'` | `'block'` | Tipo de bloqueio visual |
| `title` | `string` | "Cadastre seu cartão..." | Título customizado |
| `description` | `string` | Auto-gerado | Descrição customizada |
| `action` | `string` | "continuar" | Ação sendo bloqueada |
| `forceShow` | `boolean` | `false` | Forçar exibição (debug) |

### Hook Auxiliar

```typescript
import { useCanPerformAction } from '@/components/billing/PaymentMethodGate';

const { canPublishStore, checkAction } = useCanPerformAction();

if (!checkAction('publish')) {
  // Mostrar bloqueio ou redirecionar
}
```

---

## Plano Básico — Regras Especiais

O plano básico permite uso imediato, mas com restrições até cadastrar cartão:

### Sem Cartão Cadastrado
- ✅ Pode acessar dashboard
- ✅ Pode cadastrar produtos
- ✅ Pode configurar loja
- ❌ **NÃO pode publicar loja**
- ❌ **NÃO pode usar funcionalidades completas**
- ⚠️ Exibe `PaymentMethodGate` em ações bloqueadas

### Com Cartão Cadastrado
- ✅ Todas funcionalidades liberadas
- ✅ Pode publicar loja
- ✅ Taxa de 2,5% sobre vendas será cobrada automaticamente

### Fluxo de Cadastro de Cartão

```
1. Usuário tenta ação bloqueada → PaymentMethodGate aparece
2. Clica em "Cadastrar cartão" → Redireciona para /settings/add-payment-method
3. Preenche dados do cartão
4. Edge function billing-add-payment-method processa:
   - Valida cartão
   - Salva método de pagamento criptografado
   - Atualiza tenant_subscriptions.status para 'active'
   - Atualiza payment_method_type, card_last_four, card_brand
5. Usuário é redirecionado para dashboard com funcionalidades liberadas
```

---

## Edge Functions de Billing

### `start-create-basic-account`
Cria tenant e assinatura para plano básico.

**Request:**
```json
{
  "store_name": "Minha Loja",
  "owner_name": "João Silva",
  "email": "joao@email.com",
  "slug": "minha-loja"
}
```

**Response:**
```json
{
  "success": true,
  "tenant_id": "uuid",
  "subscription_status": "pending_payment_method"
}
```

### `billing-add-payment-method`
Cadastra cartão de crédito para tenant.

**Request:**
```json
{
  "tenant_id": "uuid",
  "card_data": {
    "number": "4111111111111111",
    "holder_name": "JOAO SILVA",
    "exp_month": "12",
    "exp_year": "28",
    "cvv": "123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "card_brand": "visa",
  "card_last_four": "1111"
}
```

---

## Plano Básico Automático

Quando um usuário cria uma conta pelo plano básico, o sistema:
1. Cria o tenant com `plan = 'start'`
2. Cria assinatura em `tenant_subscriptions` com `plan_key = 'basico'` e `status = 'pending_payment_method'`
3. Inicializa `credit_wallet` com saldo zero
4. Usuário pode usar sistema, mas funcionalidades completas exigem cadastro de cartão

Isso permite que o usuário comece a usar a plataforma imediatamente, com incentivo para cadastrar cartão.

---

## Módulos Bloqueados com Visualização

Módulos bloqueados devem ser visíveis mas não utilizáveis. Usar:

### `ModuleGate` Component
```tsx
<ModuleGate 
  moduleKey="marketing_advanced" 
  blockedMode="blur" 
  moduleName="Marketing Avançado"
>
  <MarketingAdvancedPage />
</ModuleGate>
```

### Modos de Bloqueio
| Modo | Descrição |
|------|-----------|
| `hide` | Esconde completamente (para menus) |
| `blur` | Mostra preview borrado com CTA de upgrade |
| `prompt` | Mostra apenas o prompt de upgrade |

### `FeatureGate` com CTA
```tsx
<FeatureGate 
  feature="whatsapp" 
  showUpgradeCTA 
  featureName="WhatsApp"
>
  <WhatsAppIntegration />
</FeatureGate>
```

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Saldo insuficiente** | Bloqueia execução e informa créditos faltantes |
| **Idempotency** | Toda transação deve ter idempotency_key |
| **Reserva** | Jobs longos reservam antes, ajustam depois |
| **Markup** | 50% sobre custo do provedor |
| **Default allow** | Features não configuradas são permitidas |
| **Plano padrão** | Usuários sem plano vão para 'basico' automaticamente |
| **Extras na fatura** | Uso excedente é cobrado na fatura mensal |

---

## Módulo ChatGPT - Limites por Plano

O módulo ChatGPT possui limites de uso em USD incluídos por plano:

| Plano | Acesso | Limite Incluído | Excedente |
|-------|--------|-----------------|-----------|
| `basico` | ❌ Bloqueado | - | - |
| `evolucao` | ❌ Bloqueado | - | - |
| `profissional` | ✅ Liberado | US$ 2,00/mês | Cobrado à parte |
| `avancado` | ✅ Liberado | US$ 5,00/mês | Cobrado à parte |
| `impulso` | ✅ Liberado | US$ 10,00/mês | Cobrado à parte |
| `consolidar` | ✅ Liberado | US$ 15,00/mês | Cobrado à parte |
| `comando_maximo` | ✅ Liberado | US$ 25,00/mês | Cobrado à parte |
| `customizado` | ✅ Liberado | Ilimitado | - |

### Campos Relacionados

| Tabela | Campo | Descrição |
|--------|-------|-----------|
| `plan_limits` | `chatgpt_included_usd` | Limite mensal incluído (-1 = ilimitado) |
| `plan_module_access` | `module_key = 'chatgpt'` | Nível de acesso (none/full) |
| `tenant_monthly_usage` | `chatgpt_usage_usd` | Uso acumulado no mês |
| `tenant_monthly_usage` | `chatgpt_extra_usd` | Valor excedente a faturar |

### Funções RPC

| Função | Descrição |
|--------|-----------|
| `check_chatgpt_access(tenant_id)` | Retorna acesso, limite, uso e saldo |
| `record_chatgpt_usage(tenant_id, cost_usd)` | Registra uso e calcula excedente |

---

## Proibições

| Proibido | Motivo |
|----------|--------|
| Créditos negativos | Constraint no banco |
| Dupla cobrança | idempotency_key obrigatório |
| Ignorar limites do plano | RPC valida antes |
| Mostrar custos USD | Sempre exibir em créditos/BRL |
| Esconder módulos bloqueados | Mostrar com CTA de upgrade |
| Permitir ChatGPT em planos bloqueados | Regra de negócio |
| Criar assinatura básica com status `active` | Deve ser `pending_payment_method` |
| Redirecionar para `/create-store` sem passar por `/start` | Bypass de billing |
| Criar tenant via RPC com status `active` para plano básico | Causa liberação indevida |
