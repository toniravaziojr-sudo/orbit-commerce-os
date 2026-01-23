# Checkout — Regras e Especificações

> **Status:** Módulo core do fluxo de compra. Alterações estruturais requerem aprovação.

## Visão Geral

Fluxo de finalização da compra com múltiplas formas de pagamento, order bumps, testimonials e validações.

---

## Rota

`/loja/:slug/checkout`

---

## Estrutura Visual

| Área | Descrição |
|------|-----------|
| Header/Footer | Elementos globais do template |
| Dados do cliente | Nome, email, telefone, CPF |
| Endereço de entrega | Formulário com busca de CEP |
| Forma de pagamento | PIX, Boleto, Cartão de Crédito |
| Order Bumps | Ofertas 1-click baseadas em regras |
| Resumo do pedido | Itens, subtotal, frete, descontos, total |
| Testimonials | Prova social (depoimentos de clientes) |
| Selos de segurança | Badges de confiança e segurança |

---

## Componentes de UI

| Componente | Arquivo | Função |
|------------|---------|--------|
| `CheckoutForm` | `checkout/CheckoutForm.tsx` | Formulário de dados pessoais |
| `CheckoutShipping` | `checkout/CheckoutShipping.tsx` | Endereço e cálculo de frete |
| `PaymentMethodSelector` | `checkout/PaymentMethodSelector.tsx` | Seleção de forma de pagamento |
| `PaymentResult` | `checkout/PaymentResult.tsx` | Exibe resultado/status do pagamento |
| `CheckoutOrderSummary` | `checkout/CheckoutOrderSummary.tsx` | Resumo lateral do pedido |
| `OrderBumpSection` | `checkout/OrderBumpSection.tsx` | Ofertas de order bump |
| `CheckoutTestimonials` | `checkout/CheckoutTestimonials.tsx` | Depoimentos de prova social |

---

## Hooks de Lógica

| Hook | Arquivo | Função |
|------|---------|--------|
| `useCheckoutPayment` | `hooks/useCheckoutPayment.ts` | Processamento de pagamento |
| `useCheckoutTestimonials` | `hooks/useCheckoutTestimonials.ts` | CRUD de testimonials |
| `useActiveOfferRules` | `hooks/useOfferRules.ts` | Busca regras de Order Bump |

---

## Edge Functions (Backend)

| Function | Função |
|----------|--------|
| `checkout-create-order` | Criação atômica do pedido (items, customer, address) |
| `pagarme-create-charge` | Processamento de pagamento via Pagar.me |

---

## Configurações (`store_settings.checkout_config`)

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `paymentOrder` | string[] | `['pix','boleto','card']` | Ordem de exibição dos métodos |
| `paymentLabels` | object | `{}` | Labels personalizados para métodos |
| `showCouponField` | boolean | true | Exibe campo de cupom |
| `showTestimonials` | boolean | true | Exibe seção de testimonials |
| `showOrderBump` | boolean | true | Exibe ofertas de order bump |
| `showTrustBadges` | boolean | true | Exibe selos de confiança |
| `showSecuritySeals` | boolean | true | Exibe selos de segurança |
| `showTimeline` | boolean | true | Exibe timeline de etapas |

---

## Regras de Testimonials (Prova Social)

| Contexto | Comportamento |
|----------|---------------|
| **Builder** (`isEditing=true`) | Exibe dados demo como fallback |
| **Storefront Público** | Exibe APENAS testimonials com `published_at IS NOT NULL` |
| **Publicação** | Ao publicar template, testimonials ativos são automaticamente publicados |

Fluxo de publicação:
```
is_active = true → aparece no admin
is_active = true + published_at IS NOT NULL → aparece no storefront público
```

---

## Regras de Order Bump

| Regra | Descrição |
|-------|-----------|
| **Fonte de dados** | Tabela `offer_rules` com `type='order_bump'` |
| **Condição** | `is_active=true` |
| **Filtro** | Produtos já no carrinho são filtrados automaticamente |
| **Desconto** | Pode ser `percent`, `fixed` ou `none` |

---

## Formas de Pagamento Suportadas

| Método | Gateway | Campos adicionais |
|--------|---------|-------------------|
| PIX | Pagar.me | Exibe QR Code + código copia/cola |
| Boleto | Pagar.me | Exibe código de barras + link PDF |
| Cartão de Crédito | Pagar.me | Número, validade, CVV, parcelas |

---

## Fluxo de Criação de Pedido

```
1. Validação de dados do formulário (cliente)
2. Chamada à Edge Function `checkout-create-order`
   → VALIDAÇÃO DE PRODUTOS (verifica se todos os product_ids existem)
   → Cria/atualiza customer
   → Cria address
   → Cria order com items_snapshot
   → Cria order_items
3. Chamada à Edge Function `pagarme-create-charge`
   → Processa pagamento no gateway
   → Atualiza order.payment_status
4. Redirecionamento para página de Obrigado
```

---

## Validação de Produtos no Checkout (REGRA CRÍTICA)

| Cenário | Comportamento |
|---------|---------------|
| Produto deletado após adicionar ao carrinho | Edge Function retorna erro `INVALID_PRODUCTS` |
| Produto de outro tenant | Edge Function retorna erro `INVALID_PRODUCTS` |
| Erro de validação | Lista de IDs inválidos retornada para limpeza do carrinho |

### Códigos de Erro da Edge Function

| Código | Descrição |
|--------|-----------|
| `MISSING_REQUIRED_FIELDS` | Dados obrigatórios ausentes |
| `PRODUCT_VALIDATION_ERROR` | Erro interno ao validar produtos |
| `INVALID_PRODUCTS` | Produtos no carrinho não existem mais |
| `ORDER_NUMBER_ERROR` | Erro ao gerar número do pedido |
| `INTERNAL_ERROR` | Erro interno inesperado |

---

## Validações Obrigatórias

| Campo | Validação |
|-------|-----------|
| CPF | Formato válido (11 dígitos + algoritmo) |
| Email | Formato de email válido |
| Telefone | Mínimo 10 dígitos |
| CEP | 8 dígitos + validação via API |
| Cartão | Luhn algorithm + data de validade futura |

---

## Regra Crítica de Ofertas (REGRA FIXA)

| Tipo de Oferta | Local Correto |
|----------------|---------------|
| Cross-sell | Carrinho |
| **Order Bump** | **Checkout** |
| Compre Junto | Página do Produto |
| Upsell | Página Obrigado |

---

## Localização das Configurações

Carrinho & Checkout → aba Checkout (no Builder)

---

## Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `src/components/storefront/checkout/*` | Este documento |
| `src/hooks/useCheckoutPayment.ts` | Este documento |
| `src/hooks/useCheckoutTestimonials.ts` | Este documento |
| `supabase/functions/checkout-create-order/*` | Este documento + `edge-functions.md` |
| `supabase/functions/pagarme-create-charge/*` | Este documento + `edge-functions.md` |
| `supabase/functions/get-order/*` | Este documento + `edge-functions.md` |

---

## Regra de Busca de Pedido (get-order)

| Regra | Descrição |
|-------|-----------|
| **tenant_id obrigatório** | Sempre passar para desambiguação |
| **Duplicatas** | Ordenar por `created_at DESC` + `LIMIT 1` |
| **Busca por order_number** | Aceita com ou sem `#` (normaliza internamente) |
| **Fallback** | Tenta `#XXXX`, depois `XXXX`, depois formatos legados |
