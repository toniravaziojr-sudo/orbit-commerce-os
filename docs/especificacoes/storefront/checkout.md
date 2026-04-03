# Módulo: Checkout

> **Status:** ✅ Ativo  
> **Camada:** Layer 3 — Especificações / Storefront  
> **Última atualização:** 2026-04-03  
> **Migrado de:** `docs/regras/checkout.md`

---

## 1. Visão Geral

Fluxo de finalização de compra com múltiplas formas de pagamento, order bumps, testimonials e validações.

**Rota:** `/loja/:slug/checkout`

---

## 2. Estrutura Visual

| Área | Descrição |
|------|-----------|
| Header/Footer | **Exclusivos do checkout** — configuração separada |
| Dados do cliente | Nome, email, telefone, CPF |
| Endereço de entrega | Formulário com busca de CEP |
| Forma de pagamento | PIX, Boleto, Cartão de Crédito |
| Order Bumps | Ofertas 1-click |
| Resumo do pedido | Itens, subtotal, frete, descontos, total |
| Testimonials | Prova social |
| Selos de segurança | Badges de confiança |

---

## 3. Header e Footer Exclusivos

Configuração independente via `storefront_global_layout.checkout_header_config` / `checkout_footer_config`.

### Defaults do Checkout

| Prop | Default Checkout |
|------|------------------|
| `showSearch` | `false` |
| `showHeaderMenu` | `false` |
| `customerAreaEnabled` | `false` |
| `logoPosition` | `center` |

### Herança

1. Props editáveis vazias → herdam do global
2. Toggles de visibilidade → valor do checkout tem prioridade absoluta
3. Bandeiras/selos → herdam do footer global se não definidas

### Sincronização Builder ↔ Público (CRÍTICA)

| Contexto | Arquivo |
|----------|---------|
| Builder Preview | `useGlobalLayoutIntegration.ts` |
| Checkout Público | `StorefrontCheckout.tsx` |

> ⚠️ Alterar um OBRIGA atualizar o outro.

---

## 4. Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `CheckoutForm` | `checkout/CheckoutForm.tsx` | Dados pessoais |
| `CheckoutShipping` | `checkout/CheckoutShipping.tsx` | Endereço e frete |
| `PaymentMethodSelector` | `checkout/PaymentMethodSelector.tsx` | Seleção pagamento |
| `PaymentResult` | `checkout/PaymentResult.tsx` | Resultado/status |
| `CheckoutOrderSummary` | `checkout/CheckoutOrderSummary.tsx` | Resumo lateral |
| `OrderBumpSection` | `checkout/OrderBumpSection.tsx` | Order bumps |
| `CheckoutTestimonials` | `checkout/CheckoutTestimonials.tsx` | Depoimentos |

---

## 5. Hooks

| Hook | Função |
|------|--------|
| `useCheckoutPayment` | Processamento multi-gateway. Expõe `activeGateway` |
| `useCheckoutTestimonials` | CRUD de testimonials |
| `useActiveOfferRules` | Busca Order Bumps |
| `usePublicPaymentDiscounts` | Descontos/parcelas por gateway |
| `useCepLookup` | Busca automática de endereço por CEP |
| `useRetryCheckoutData` | Dados para retry com outra forma |

---

## 6. Edge Functions

| Function | Função |
|----------|--------|
| `checkout-create-order` | Criação atômica do pedido |
| `pagarme-create-charge` | Pagamento via Pagar.me |
| `mercadopago-create-charge` | Pagamento via Mercado Pago |
| `retry-card-payment` | Retentativa de cartão no mesmo pedido |
| `get-retry-checkout-data` | Dados seguros para retry |

### Seleção Dinâmica de Gateway

- Se Mercado Pago habilitado → `mercadopago-create-charge`
- Se Pagar.me habilitado → `pagarme-create-charge`
- Fallback: Pagar.me

---

## 7. Cores Personalizadas (Page Override)

| Setting | Descrição |
|---------|-----------|
| `buttonPrimaryBg` | Cor fundo botão primário |
| `buttonPrimaryText` | Cor texto botão primário |
| `buttonPrimaryHover` | Cor hover |
| `flagsColor` | Cor das flags/tags |

Container recebe classe `sf-page-checkout` para especificidade CSS sem `!important`.

---

## 8. Formas de Pagamento

| Método | Gateway | Campos adicionais |
|--------|---------|-------------------|
| PIX | Pagar.me / MP | QR Code + copia/cola |
| Boleto | Pagar.me / MP | Código barras + PDF |
| Cartão | Pagar.me / MP | Número, validade, CVV, parcelas |

---

## 9. Fluxo de Criação de Pedido

```
1. Validação de dados
2. checkout-create-order → Valida produtos → Cria customer → Cria address → Cria order + items
3. pagarme/mercadopago-create-charge → Processa pagamento → Atualiza status
4. Redirect para Thank You
```

---

## 10. Descontos por Forma de Pagamento

Tabela `payment_method_discounts` com unique `(tenant_id, provider, payment_method)`.

Configuração em: **Sistema > Configurações > Pagamentos** (separado por gateway).

> Builder controla apenas visibilidade e labels visuais. Descontos reais ficam em Configurações.

---

## 11. Tracking Comercial

### Attribution (UTM)

- `useStoredAttribution()` captura UTMs da URL → `sessionStorage`
- `checkout-create-order` grava no campo `attribution`

### Affiliate

- `useAffiliateTracking(tenantId)` captura `?ref=`
- Grava `affiliate_id` no pedido

### Checkout Session (Abandono)

- `useCheckoutSession()` cria sessão ao entrar
- Marcada como `converted` na criação do pedido

---

## 12. Classificação de Falhas

| Cenário | Pedido? | Cobrança? | Comportamento |
|---------|---------|-----------|---------------|
| A — Falha antes do pedido | ❌ | ❌ | Fica no checkout com erro |
| B — Erro técnico pós-pedido | ✅ | ❌ | "Problema técnico" |
| C — Cartão recusado | ✅ | ✅ (recusou) | Redirect para Thank You `status=declined` |

---

## 13. Retry de Pagamento

### Retry cartão (mesmo pedido)

- `retry-card-payment` valida `retry_token` e processa nova cobrança
- Token válido por 24h, invalidado após aprovação

### Retry com outra forma

- Thank You exibe "Tentar com outra forma" quando `status=declined`
- Redirect para `/checkout?rt=TOKEN`
- `get-retry-checkout-data` retorna dados seguros (sem CPF)
- Cria novo pedido vinculado via `retry_from_order_id`

---

## 14. Validações

| Campo | Validação |
|-------|-----------|
| CPF | 11 dígitos + algoritmo módulo 11 |
| Email | Formato válido |
| Telefone | Mínimo 10 dígitos |
| CEP | 8 dígitos + validação ViaCEP |
| Cartão | Luhn + validade futura |

---

## 15. Segurança

### Validação de Preço Canônico (Phase 2B)

- Total recalculado no servidor usando preços do banco
- `canonical_total` persistido para auditoria (modo simulação)
- Divergências > R$0.01 logadas como `DRIFT DETECTED`

### RLS Hardening (Phase 3)

Zero policies anônimas em `orders`, `order_items`, `customers`, `payment_transactions`, `order_attribution`. Toda leitura/escrita via Edge Functions com `service_role`.

---

## 16. Navegação Checkout → Loja

**PROIBIDO** usar `<Link>` do React Router para navegar do checkout para rotas de conteúdo. Toda navegação checkout→loja via `window.location.href`.

---

## 17. Layout

### Sidebar Sticky

Resumo + depoimentos fixos na sidebar direita (`sticky top-4`).  
No mobile (< 768px): empilha via flexbox.

### Ocultação de Integrações

Nomes de integrações (Frenet, Correios) removidos das labels de frete na loja pública.

---

*Fim do documento.*
