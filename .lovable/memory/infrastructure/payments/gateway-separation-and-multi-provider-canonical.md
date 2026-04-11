# Arquitetura de Pagamentos e Gateways

**Versão:** 3.0.0  
**Data:** 2026-04-11  
**Status:** Ativo

## Visão Geral

O sistema separa estritamente dois contextos de pagamento:

1. **Billing da Plataforma (SaaS)** — cobrança de assinaturas dos tenants. Credenciais configuradas em `Platform Settings > Mercado Pago`.
2. **Vendas dos Tenants (Storefront)** — pagamentos dos clientes finais nas lojas. Cada tenant configura suas próprias credenciais em `Integrações > Pagamentos`.

## Provedores Suportados

| Provedor | Billing SaaS | Vendas (Transparente) | Vendas (Redirect) |
|----------|:---:|:---:|:---:|
| Pagar.me | ❌ | ✅ PIX, Cartão, Boleto | ❌ |
| Mercado Pago | ✅ | ✅ PIX, Cartão, Boleto | ✅ Checkout Externo |
| PagBank | ❌ | ✅ (futuro) | ❌ |

## Tabela `payment_method_gateway_map`

Mapeia **qual provedor** é responsável por cada forma de pagamento transparente (PIX, Cartão, Boleto) para cada tenant:

| Campo | Descrição |
|-------|-----------|
| `tenant_id` | Tenant dono da configuração |
| `payment_method` | `pix`, `credit_card` ou `boleto` |
| `provider` | Nome do provedor (ex: `pagarme`, `mercado_pago`) |
| `is_enabled` | Se o método está ativo no checkout |

**Constraint:** `UNIQUE(tenant_id, payment_method)` — cada método tem exatamente um provedor por tenant.

## Fluxo de Configuração (Admin do Tenant)

1. **Integrações > Pagamentos** — Tenant conecta seus provedores (Access Token, API Key, etc.) e visualiza a **URL de Webhook** que deve configurar no painel do provedor.
2. **Sistema > Configurações > Pagamentos** — Tenant escolhe, por dropdown, qual provedor conectado será responsável por cada método (PIX, Cartão, Boleto). Também pode ativar/desativar cada método e configurar descontos.
3. **Mercado Pago Redirect** — Se o tenant tem Mercado Pago ativo com `mp_redirect_enabled = true`, aparece como 4ª opção no checkout.

## Fluxo de Resolução no Checkout

1. Frontend consulta `payment_method_gateway_map` via `usePaymentGatewayMap` para saber qual provider processa cada método.
2. Ao finalizar, `useCheckoutPayment` identifica o provider e chama a Edge Function correta:
   - **Pagar.me** → `checkout-create-order` (cria pedido + cobra)
   - **Mercado Pago Transparente** → `checkout-create-order` com provider MP
   - **Mercado Pago Redirect** → `mercadopago-create-preference` (salva dados pendentes, redireciona)

## URLs de Webhook por Provedor

Exibidas ao tenant na tela de Integrações > Pagamentos, dentro do card de cada provedor conectado:

| Provedor | URL |
|----------|-----|
| Pagar.me | `https://{SUPABASE_URL}/functions/v1/pagarme-webhook` |
| Mercado Pago | `https://{SUPABASE_URL}/functions/v1/mercadopago-storefront-webhook` |

O tenant deve copiar a URL e configurar no painel do respectivo provedor.

## Fonte de Verdade

O **gateway** é a autoridade absoluta para reconciliação financeira. Dados internos (tabela `orders`, `transactions`) servem como espelho operacional. Em caso de divergência, o gateway prevalece.

## Arquivos Principais

- `src/hooks/usePaymentGatewayMap.ts` — hook de mapeamento método→provedor
- `src/hooks/usePaymentProviders.ts` — hook de CRUD dos provedores conectados
- `src/components/system-settings/PaymentSettingsTab.tsx` — UI de configuração por método
- `src/components/payments/PaymentGatewaySettings.tsx` — UI de conexão de provedores + webhook URL
- `src/hooks/useCheckoutPayment.ts` — resolução dinâmica do gateway no checkout
