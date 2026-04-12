# Configurações do Sistema — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2026-03-10

> **Camada:** Layer 3 — Especificações / Sistema  
> **Migrado de:** `docs/regras/configuracoes-sistema.md`  
> **Última atualização:** 2026-04-03


---

## Visão Geral

Página de configurações operacionais do sistema, acessível via **Menu Sistema → Configurações** (`/system/settings`).

---

## Rota

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/system/settings` | `SystemSettings.tsx` | Página com tabs de configurações |
| `/system/settings?tab=payments` | `PaymentSettingsTab.tsx` | Aba de pagamentos (default) |

---

## Navegação no Sidebar

| Campo | Valor |
|-------|-------|
| **Tipo** | Navegação |
| **Localização** | `AppSidebar.tsx` → Grupo "Sistema" |
| **Label** | "Configurações" |
| **Ícone** | `Settings` (lucide) |
| **href** | `/system/settings` |
| **Posição** | Após "Integrações", antes de "Importar Dados" |

---

## Aba: Pagamentos

### Componentes

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente / Tab |
| **Localização** | `src/components/system-settings/PaymentSettingsTab.tsx` |
| **Descrição** | Configuração de descontos reais e parcelamento por forma de pagamento, **separados por gateway** |
| **Hook** | `usePaymentMethodDiscounts(provider?)` (`src/hooks/usePaymentMethodDiscounts.ts`) |
| **Hook de providers** | `usePaymentProviders` (`src/hooks/usePaymentProviders.ts`) — lista gateways ativos |

### Tabela: `payment_method_discounts`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants |
| `provider` | TEXT | Gateway: `pagarme`, `mercadopago`, etc. Default: `pagarme` |
| `payment_method` | TEXT | `pix`, `credit_card`, `boleto` |
| `discount_type` | TEXT | `percentage` ou `fixed` |
| `discount_value` | NUMERIC(10,2) | Valor do desconto |
| `is_enabled` | BOOLEAN | Toggle de ativação |
| `installments_max` | INTEGER | Parcelas máximas (default 12) |
| `installments_min_value_cents` | INTEGER | Valor mínimo por parcela em centavos |
| `free_installments` | INTEGER | Parcelas sem juros para o cliente (default 12) |
| `pix_expiration_minutes` | INTEGER | Tempo de expiração do PIX em minutos (default 60) |
| `boleto_expiration_days` | INTEGER | Prazo de vencimento do boleto em dias (default 3) |
| `description` | TEXT | Descrição opcional |

**Unique constraint:** `(tenant_id, provider, payment_method)`

### RLS Policies

| Policy | Tipo | Condição |
|--------|------|----------|
| Users can view own tenant | SELECT (authenticated) | `user_has_tenant_access(tenant_id)` |
| Users can manage own tenant | ALL (authenticated) | `user_has_tenant_access(tenant_id)` |
| Public can read enabled | SELECT (anon) | `is_enabled = true` |

### Funcionalidades por Método

| Método | Desconto | Parcelas | Valor mínimo | Parc. sem juros | Expiração |
|--------|----------|----------|--------------|-----------------|-----------|
| **PIX** | ✅ Percentual ou fixo | ❌ N/A | ❌ N/A | ❌ N/A | ✅ 15min a 24h |
| **Cartão de Crédito** | ✅ Percentual ou fixo | ✅ 1-12x | ✅ Configurável | ✅ 1x até máx | ❌ N/A |
| **Boleto** | ✅ Percentual ou fixo | ❌ N/A | ❌ N/A | ❌ N/A | ✅ 1 a 30 dias |

### Comportamento

1. Ao abrir a aba, verifica gateways ativos via `usePaymentProviders`
2. Se **nenhum gateway ativo**: exibe alerta vermelho com link para Integrações
3. Se há gateways ativos: exibe **abas por gateway** (ex: Pagar.me | Mercado Pago)
4. Dentro de cada aba: cards de PIX/Cartão/Boleto com toggle, desconto e parcelas
5. Botão "Salvar" por método faz upsert na tabela `payment_method_discounts` com `provider`

### Relação com Builder

| Local | O que controla |
|-------|----------------|
| **Builder > Checkout Settings** | Visibilidade de métodos (toggles show/hide) |
| **Builder > Theme > PaymentMethodsConfig** | Ordem e badges visuais (ex: "5% OFF") |
| **Sistema > Configurações > Pagamentos** | Descontos REAIS, parcelas, valores efetivos — **por gateway** |

> ⚠️ Avisos amarelos no Builder (CheckoutSettingsPanel e PaymentMethodsConfig) informam que as configurações visuais não aplicam descontos reais.

---

## Pendências

| Item | Status | Descrição |
|------|--------|-----------|
| **Novas abas** | 🟡 Planejado | Futuras configurações (ex: Frete, Notificações) podem ser adicionadas como novas tabs |

---

## Integração no Checkout (Fluxo Real)

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Lógica |
| **Localização** | `CheckoutStepWizard.tsx`, `useCheckoutPayment.ts`, `usePublicPaymentDiscounts.ts` |
| **Descrição** | Descontos por forma de pagamento e parcelas são aplicados em tempo real no checkout, filtrados pelo gateway ativo |

### Fluxo

1. `useCheckoutPayment` identifica o `activeGateway` do tenant (`'pagarme'` ou `'mercadopago'`)
2. `CheckoutStepWizard` mapeia para `providerKey` e passa a `usePublicPaymentDiscounts(tenantId, providerKey)`
3. `usePublicPaymentDiscounts` busca configurações ativas **do gateway específico** (RLS anon)
4. `calculatePaymentMethodDiscount()` calcula o valor do desconto baseado no método selecionado
5. O desconto é subtraído do `grandTotal` e exibido como linha separada no resumo do pedido
6. `processPayment()` recebe `paymentMethodDiscount` e `installments` e os envia para as Edge Functions
7. O `checkout-create-order` recebe `payment_method_discount` e `installments` no body e **salva na tabela `orders`**
8. O gateway function recebe `installments` para configurar parcelamento
9. O `total` enviado ao gateway **já inclui** a subtração do desconto (calculado no frontend)

### Seletor de Parcelas

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente |
| **Localização** | `Step4Payment` dentro de `CheckoutStepWizard.tsx` |
| **Descrição** | RadioGroup com opções de 1x até Nx baseado em `installments_max` e `installments_min_value_cents` |
| **Condições** | Só aparece quando `paymentMethod === 'credit_card'` e `maxInstallments > 1` |
| **Cálculo** | `getMaxInstallments()` considera o menor entre config e `total / min_value_per_installment` |

### Hooks

| Hook | Arquivo | Descrição |
|------|---------|-----------|
| `usePublicPaymentDiscounts(tenantId, provider?)` | `src/hooks/usePublicPaymentDiscounts.ts` | Busca descontos habilitados, filtrados por gateway (storefront, anon) |
| `calculatePaymentMethodDiscount` | `src/hooks/usePublicPaymentDiscounts.ts` | Calcula valor do desconto |
| `getMaxInstallments` | `src/hooks/usePublicPaymentDiscounts.ts` | Calcula parcelas máximas |
| `usePaymentMethodDiscounts(provider?)` | `src/hooks/usePaymentMethodDiscounts.ts` | CRUD admin para configuração por gateway |
