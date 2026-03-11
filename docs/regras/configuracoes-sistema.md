# Configurações do Sistema — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2026-03-10

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
| **Descrição** | Configuração de descontos reais por forma de pagamento e parcelamento |
| **Hook** | `usePaymentMethodDiscounts` (`src/hooks/usePaymentMethodDiscounts.ts`) |

### Tabela: `payment_method_discounts`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants, UNIQUE com payment_method |
| `payment_method` | TEXT | `pix`, `credit_card`, `boleto` |
| `discount_type` | TEXT | `percentage` ou `fixed` |
| `discount_value` | NUMERIC(10,2) | Valor do desconto |
| `is_enabled` | BOOLEAN | Toggle de ativação |
| `installments_max` | INTEGER | Parcelas máximas (default 12) |
| `installments_min_value_cents` | INTEGER | Valor mínimo por parcela em centavos |
| `description` | TEXT | Descrição opcional |

### RLS Policies

| Policy | Tipo | Condição |
|--------|------|----------|
| Users can view own tenant | SELECT (authenticated) | `user_has_tenant_access(tenant_id)` |
| Users can manage own tenant | ALL (authenticated) | `user_has_tenant_access(tenant_id)` |
| Public can read enabled | SELECT (anon) | `is_enabled = true` |

### Funcionalidades por Método

| Método | Desconto | Parcelas | Valor mínimo |
|--------|----------|----------|--------------|
| **PIX** | ✅ Percentual ou fixo | ❌ N/A | ❌ N/A |
| **Cartão de Crédito** | ✅ Percentual ou fixo | ✅ 1-12x | ✅ Configurável |
| **Boleto** | ✅ Percentual ou fixo | ❌ N/A | ❌ N/A |

### Comportamento

1. Ao abrir a aba, carrega configurações do banco (ou defaults se não existirem)
2. Cada método de pagamento tem um card independente com toggle de ativação
3. Usuário configura tipo de desconto, valor, e parcelas (cartão)
4. Botão "Salvar" por método faz upsert na tabela `payment_method_discounts`

### Relação com Builder

| Local | O que controla |
|-------|----------------|
| **Builder > Checkout Settings** | Visibilidade de métodos (toggles show/hide) |
| **Builder > Theme > PaymentMethodsConfig** | Ordem e badges visuais (ex: "5% OFF") |
| **Sistema > Configurações > Pagamentos** | Descontos REAIS, parcelas, valores efetivos |

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
| **Descrição** | Descontos por forma de pagamento e parcelas são aplicados em tempo real no checkout |

### Fluxo

1. `usePublicPaymentDiscounts(tenantId)` busca configurações ativas (RLS anon)
2. `calculatePaymentMethodDiscount()` calcula o valor do desconto baseado no método selecionado
3. O desconto é subtraído do `grandTotal` e exibido como linha separada no resumo do pedido
4. `processPayment()` recebe `paymentMethodDiscount` e `installments` e os envia para as Edge Functions
5. O `checkout-create-order` recebe `payment_method_discount` e `installments` no body e **salva na tabela `orders`** (campos `payment_method_discount`, `installments`, `installment_value`)
6. O `pagarme-create-charge` recebe `installments` para configurar parcelamento no gateway
7. O `total` enviado ao gateway **já inclui** a subtração do desconto por forma de pagamento (calculado no frontend)

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
| `usePublicPaymentDiscounts` | `src/hooks/usePublicPaymentDiscounts.ts` | Busca descontos habilitados (storefront, anon) |
| `calculatePaymentMethodDiscount` | `src/hooks/usePublicPaymentDiscounts.ts` | Calcula valor do desconto |
| `getMaxInstallments` | `src/hooks/usePublicPaymentDiscounts.ts` | Calcula parcelas máximas |
| `usePaymentMethodDiscounts` | `src/hooks/usePaymentMethodDiscounts.ts` | CRUD admin para configuração |
