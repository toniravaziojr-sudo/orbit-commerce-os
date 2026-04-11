# Mercado Pago Redirect — Especificação Técnica

**Versão:** 1.0.0  
**Data:** 2026-04-11  
**Componentes:** `mercadopago-create-preference`, `mercadopago-storefront-webhook`, `ThankYouContent`

## Visão Geral

O Mercado Pago Redirect é a 4ª opção de pagamento no checkout (além de PIX, Cartão e Boleto). Ele redireciona o cliente para o ambiente do Mercado Pago, onde o pagamento é realizado. **O pedido só é criado internamente após o retorno do gateway com confirmação de pagamento.**

## Regra Fundamental

> O pedido **nunca** é criado antes da confirmação de pagamento pelo gateway. Dados do checkout são armazenados temporariamente em `mp_pending_checkouts` até que o webhook confirme o pagamento.

## Fluxo Completo

### 1. Checkout (Frontend)
1. Cliente escolhe "Mercado Pago" como forma de pagamento.
2. `useCheckoutPayment` chama a Edge Function `mercadopago-create-preference`.
3. Frontend redireciona o cliente para `init_point` (URL do Mercado Pago).

### 2. Edge Function `mercadopago-create-preference`
1. Busca credenciais do tenant em `payment_providers`.
2. Armazena todos os dados do checkout (cliente, items, frete, descontos, atribuição) em `mp_pending_checkouts` com status `pending`.
3. Cria a Preference na API do Mercado Pago com `external_reference = pending_checkout_id`.
4. Retorna `init_point` para o frontend.

### 3. Pagamento Externo
- Cliente paga no ambiente do Mercado Pago.
- MP redireciona de volta para `/obrigado?mp_checkout={id}&status={status}`.

### 4. Webhook `mercadopago-storefront-webhook`
1. Recebe notificação do MP (tipo `payment`).
2. Consulta a API do MP para obter detalhes do pagamento.
3. Extrai `external_reference` → busca em `mp_pending_checkouts`.
4. Se pagamento aprovado:
   - Invoca internamente `checkout-create-order` com os dados salvos.
   - Atualiza o pedido criado com `payment_status`, `gateway_payment_id`, `paid_at`.
   - Marca `mp_pending_checkouts` como `completed`.
5. Se pagamento rejeitado:
   - Marca `mp_pending_checkouts` como `failed`.

### 5. Thank You Page
- Se `mp_checkout` está nos query params e o pedido ainda não existe, exibe estado de "processando".
- Quando o pedido é criado pelo webhook, a página detecta via polling e exibe a confirmação.

## Tabela `mp_pending_checkouts`

| Campo | Descrição |
|-------|-----------|
| `id` | UUID, usado como `external_reference` no MP |
| `tenant_id` | Tenant da loja |
| `checkout_session_id` | ID da sessão de checkout |
| `customer_data` | JSON com dados do cliente (nome, email, CPF, telefone) |
| `shipping_data` | JSON com dados de entrega |
| `items_data` | JSON com itens do carrinho |
| `subtotal`, `shipping_total`, `discount_total`, `total` | Valores financeiros |
| `payment_method_discount` | Desconto aplicado por método de pagamento |
| `discount_data` | Dados do cupom/desconto |
| `attribution_data` | Dados de atribuição (UTM, afiliado) |
| `affiliate_data` | Dados do afiliado |
| `shipping_quote_id` | ID da cotação de frete |
| `checkout_attempt_id` | ID de idempotência |
| `mp_preference_id` | ID da Preference criada no MP |
| `status` | `pending` → `completed` / `failed` |

## Ativação

1. Tenant conecta Mercado Pago em **Integrações > Pagamentos**.
2. Tenant ativa `mp_redirect_enabled` (toggle na tela de Integrações).
3. A opção aparece automaticamente como 4º método no checkout da loja.

## Diferença: Transparente vs Redirect

| Aspecto | Transparente | Redirect |
|---------|:---:|:---:|
| Checkout | Dentro da loja | No site do MP |
| Criação do pedido | Junto com a cobrança | Após confirmação via webhook |
| Métodos | PIX, Cartão, Boleto (individual) | Todos os métodos do MP |
| Configuração | Dropdown no PaymentSettingsTab | Toggle `mp_redirect_enabled` |

## Arquivos

- `supabase/functions/mercadopago-create-preference/index.ts`
- `supabase/functions/mercadopago-storefront-webhook/index.ts`
- `src/hooks/useCheckoutPayment.ts` (handler de redirect)
- `src/components/storefront/checkout/PaymentMethodSelector.tsx` (4º método)
