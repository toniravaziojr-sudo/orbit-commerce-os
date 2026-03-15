# Página Obrigado (Thank You) — Regras e Especificações

> **Status:** FUNCIONAL ✅ — Core implementado

## Visão Geral

Página de confirmação pós-compra com detalhes do pedido, ofertas de upsell e **retentativa de pagamento por cartão quando recusado**.

---

## Rota

`/loja/:slug/obrigado/:orderId`

### Parâmetros de URL

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `pedido` | query | Número do pedido (sem #) |
| `status` | query | `declined` quando cartão foi recusado pelo gateway |

---

## Estrutura Visual

### Estado Normal (Pagamento aprovado ou pendente)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         ✅ PEDIDO CONFIRMADO!                      │  │
│  │                                                                    │  │
│  │  Obrigado pela sua compra, [Nome do Cliente]!                     │  │
│  │  Seu pedido #12345 foi recebido com sucesso.                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  PRÓXIMOS PASSOS / RESUMO / UPSELL / FOOTER                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Estado Recusado (status=declined) — v8.15.0

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    ❌ PAGAMENTO NÃO APROVADO                       │  │
│  │                                                                    │  │
│  │  O pagamento do pedido #12345 foi recusado pela operadora.        │  │
│  │  Você pode tentar novamente com outro cartão de crédito.          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  💳 TENTAR NOVAMENTE COM CARTÃO                                    │  │
│  │  [Formulário de cartão inline: número, nome, validade, CVV]       │  │
│  │  [Seletor de parcelas]                                            │  │
│  │  [Botão: Pagar R$ XX,XX]                                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  RESUMO DO PEDIDO / ENDEREÇO / TIMELINE / AÇÕES                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `StorefrontThankYou` | `src/pages/storefront/StorefrontThankYou.tsx` | Página container |
| `ThankYouBlock` | `src/components/builder/BlockRenderer.tsx` | Layout principal (builder) |
| `ThankYouContent` | `src/components/storefront/ThankYouContent.tsx` | Conteúdo real (storefront) |
| `DeclinedHeader` | `src/components/storefront/ThankYouContent.tsx` | Header de falha (ícone vermelho ❌) |
| `CardRetrySection` | `src/components/storefront/ThankYouContent.tsx` | Formulário de retentativa por cartão |
| `UpsellSection` | `src/components/storefront/sections/UpsellSection.tsx` | Ofertas upsell |

---

## Hooks

| Hook | Arquivo | Função |
|------|---------|--------|
| `useOrderDetails` | `src/hooks/useOrderDetails.ts` | Busca detalhes do pedido via edge function |
| `useRetryCardPayment` | `src/hooks/useRetryCardPayment.ts` | Retentativa de pagamento por cartão no mesmo pedido |
| `useUpsellRules` | — | Regras de upsell pós-compra |

---

## Settings (Builder)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderDetails` | boolean | true | Exibe detalhes do pedido |
| `showRelatedProducts` | boolean | true | Exibe produtos relacionados |
| `showTrackingInfo` | boolean | true | Exibe info de rastreio |
| `showUpsell` | boolean | true | Exibe ofertas upsell |
| `showNextSteps` | boolean | true | Exibe timeline de próximos passos |
| `purchaseEventTiming` | `'all_orders'` \| `'paid_only'` | `'all_orders'` | Controla quando o evento Purchase dispara |

---

## Retentativa de Pagamento por Cartão (v8.15.1 — Etapa 4 + Correção de Segurança)

### Modelo de Segurança (v8.15.1)

| Aspecto | Implementação |
|---------|---------------|
| **Autenticação do retry** | `retry_token` — token opaco de 64 caracteres gerado no servidor |
| **Geração do token** | Gerado pela função `generate_order_retry_token()` no momento da criação do pedido (apenas para cartão de crédito) |
| **Validade** | 24 horas após geração |
| **Transporte** | Passado via URL param `rt` no redirect para Thank You |
| **Validação** | Função `validate_order_retry_token()` valida token e retorna dados do pedido server-side |
| **Dados sensíveis** | CPF, endereço e dados do pedido são resolvidos APENAS no servidor — NUNCA expostos no frontend |
| **Invalidação** | Token é removido após pagamento aprovado com sucesso |
| **Fallback** | Se o `rt` do URL expirar, o `get-order` retorna `retry_token` do pedido (se ainda válido) |

### Regras

| Regra | Descrição |
|-------|-----------|
| **Quando aparece** | Somente quando URL contém `status=declined` E existe `retry_token` válido |
| **Tipo de pagamento** | Apenas cartão de crédito — NÃO permite PIX ou boleto inline |
| **Pedido** | Reutiliza o mesmo pedido existente — NÃO cria pedido novo |
| **Gateway** | Detectado automaticamente server-side pelo tenant do pedido |
| **Sucesso** | Remove `status=declined` da URL, refaz busca do pedido, exibe estado de sucesso |
| **Recusa de novo** | Mantém formulário com mensagem de erro da operadora |
| **Erro técnico** | Exibe "Problema técnico" diferenciado, sem mascarar como "recusado" |

### Fluxo — Retry com sucesso

```
1. Checkout detecta cardDeclined → gera retry_token → redirect com ?status=declined&rt=TOKEN
2. Thank You carrega pedido via get-order (sem CPF, com retry_token se válido)
3. Exibe header vermelho (❌) + formulário de cartão
4. Cliente preenche dados do cartão
5. useRetryCardPayment chama edge function retry-card-payment com retry_token + card
6. Edge function valida token → carrega CPF/endereço server-side → chama gateway
7. Gateway aprova → retryResult.success = true
8. handleRetrySuccess: remove status=declined da URL + refetch order
9. Página exibe header verde (✅) + timeline normal
10. Purchase event disparado (se configurado)
```

### Fluxo — Retry com nova recusa

```
1. Cliente tenta com outro cartão
2. retry-card-payment chama gateway → recusa → retorna cardDeclined: true
3. Alert vermelho com mensagem da operadora
4. Formulário continua visível para nova tentativa
```

### Fluxo — Retry com erro técnico

```
1. Cliente tenta com cartão
2. retry-card-payment falha (HTTP/network) → retorna technicalError: true
3. Alert vermelho com "Problema técnico ao processar. Tente novamente."
4. Formulário continua visível
```

### Hook: `useRetryCardPayment`

| Campo | Valor |
|-------|-------|
| **Tipo** | Hook |
| **Localização** | `src/hooks/useRetryCardPayment.ts` |
| **Parâmetros** | `retryToken: string` |
| **Retorno** | `{ retryPayment, isRetrying, retryResult, resetRetryResult }` |
| **Comportamento** | Chama edge function `retry-card-payment` com `retry_token` + dados do cartão → resultado classificado (success / cardDeclined / technicalError) |
| **Não faz** | NÃO recebe CPF/endereço. NÃO cria pedido novo. NÃO permite PIX/boleto. |

### Edge Function: `retry-card-payment`

| Campo | Valor |
|-------|-------|
| **Tipo** | Edge Function |
| **Localização** | `supabase/functions/retry-card-payment/index.ts` |
| **Entrada** | `retry_token`, `card` (number, holder_name, exp_month, exp_year, cvv), `installments` |
| **Validação** | `validate_order_retry_token()` — retorna dados do pedido se token válido e pedido não pago |
| **Processamento** | Detecta gateway ativo → monta payload com dados server-side → chama gateway → retorna resultado |
| **Pós-sucesso** | Invalida retry_token (seta null) |
| **Segurança** | `verify_jwt = false` (público, mas protegido por retry_token) |

### Componente: `CardRetrySection`

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente |
| **Localização** | `src/components/storefront/ThankYouContent.tsx` (interno) |
| **Props** | `retryToken`, `orderTotal`, `onSuccess` |
| **Campos do formulário** | Número do cartão (com máscara), Nome no cartão, Mês/Ano validade, CVV (mascarado), Parcelas |
| **CVV** | `type="password"` com toggle de visibilidade |
| **Parcelas** | Calculadas a partir do total do pedido (1x a 12x) |
| **CTA alternativa** | Texto informativo: "Precisa usar outra forma de pagamento? Entre em contato pelo WhatsApp." |

### CTA "Outra forma de pagamento" — Etapa 5 (IMPLEMENTADO v8.15.2)

| Campo | Valor |
|-------|-------|
| **Status** | ✅ IMPLEMENTADO (v8.15.2) |
| **Comportamento** | Redireciona para checkout com `?rt=TOKEN` na URL |
| **Reconstrução do carrinho** | Itens do pedido original (product_id, variant_id, quantity) são repopulados automaticamente no carrinho via `get-retry-checkout-data` |
| **Dados prefill** | Nome, email, telefone, endereço completo, CEP (sem CPF — resolvido server-side) |
| **Recálculo** | Preços, frete, cupom e total são recalculados do zero no checkout |
| **Novo pedido** | Vinculado ao original via `retry_from_order_id` |
| **Token** | Invalidado após criação do novo pedido |

### Fluxo Completo — "Outra forma de pagamento"

```
1. Thank You exibe botão "Tentar com outra forma de pagamento" (apenas quando status=declined e retry_token válido)
2. Botão redireciona para /loja/:slug/checkout?rt=TOKEN
3. CheckoutStepWizard detecta ?rt= na URL → chama useRetryCheckoutData(token)
4. Hook chama edge function get-retry-checkout-data → valida token server-side
5. Retorna dados seguros: nome, email, phone, endereço, itens (sem CPF)
6. CheckoutStepWizard:
   a. clearCart() → remove itens antigos
   b. addItem() para cada item do pedido original (product_id, variant_id, quantity, unit_price)
   c. Preenche formulário com dados do cliente (nome, email, telefone)
   d. Preenche endereço (rua, número, complemento, bairro, cidade, estado, CEP)
   e. Exibe banner informativo: "Você está retomando o pedido #XXXX com outra forma de pagamento"
7. Cliente escolhe nova forma de pagamento e finaliza
8. checkout-create-order recebe retry_from_order_id → cria novo pedido vinculado
9. checkout-create-order invalida retry_token do pedido original (set null)
10. Novo pedido aparece no admin com link visual para o pedido anterior
```

### Hook: `useRetryCheckoutData`

| Campo | Valor |
|-------|-------|
| **Tipo** | Hook |
| **Localização** | `src/hooks/useRetryCheckoutData.ts` |
| **Parâmetros** | `retryToken: string \| null` |
| **Retorno** | `{ prefill, isLoading, error }` |
| **Comportamento** | Chama edge function `get-retry-checkout-data` com retry_token → retorna dados seguros para prefill do checkout |
| **Interface prefill** | `original_order_id`, `order_number`, `tenant_id`, `tenant_slug`, `total`, `customer` (name, email, phone), `shipping` (street, number, complement, neighborhood, city, state, postal_code), `items[]` (product_id, variant_id, product_name, sku, quantity, unit_price, image_url) |
| **Segurança** | NÃO recebe CPF. NÃO recebe dados sensíveis. Tudo resolvido server-side. |

### Edge Function: `get-retry-checkout-data`

| Campo | Valor |
|-------|-------|
| **Tipo** | Edge Function |
| **Localização** | `supabase/functions/get-retry-checkout-data/index.ts` |
| **Entrada** | `{ retry_token: string }` |
| **Validação** | `validate_order_retry_token()` — verifica token válido, pedido não pago, dentro do prazo de 24h |
| **Retorno** | `checkout_prefill` com dados do cliente, endereço e itens do pedido original |
| **Dados incluídos** | Nome, email, telefone, endereço completo, itens com product_id/variant_id/quantity/unit_price |
| **Dados excluídos** | CPF, dados bancários, dados sensíveis de pagamento |
| **Segurança** | `verify_jwt = false` (público, mas protegido por retry_token opaco) |
| **Erros** | Token inválido → 403. Token expirado → 403. Pedido já pago → 403. |

---

## Dados do Pedido (expostos ao frontend)

| Campo | Fonte | Nota |
|-------|-------|------|
| Número | `order.order_number` | |
| Status | `order.status` | |
| Itens | `order.items` (via edge function get-order) | |
| Pagamento | `order.payment_method`, `order.payment_status` | |
| Endereço | `order.shipping_*` | |
| Rastreio | `order.tracking_code`, `order.shipping_carrier` | |
| Parcelas | `order.installments` | |
| retry_token | `order.retry_token` | Só presente quando payment_status != approved e token válido |
| ~~CPF~~ | ~~`order.customer_cpf`~~ | **[REMOVIDO v8.15.1]** — resolvido server-side |

---

## Timeline de Status

| Etapa | Ícone Normal | Ícone Recusado | Descrição |
|-------|-------------|----------------|-----------|
| Confirmado | ✅ | ❌ | Pedido recebido / Pagamento não aprovado |
| Preparação | 📦 | 📦 | Separando produtos |
| Enviado | 🚚 | 🚚 | Em trânsito |

---

## Upsell (Pós-Compra)

| Característica | Descrição |
|----------------|-----------|
| **Fonte** | Tabela `offer_rules` com `type='upsell'` |
| **Visibilidade** | NÃO exibido quando `status=declined` |
| **Trigger** | Produtos no pedido recém-finalizado |

### Regra Crítica de Ofertas

| Tipo de Oferta | Local Correto |
|----------------|---------------|
| Cross-sell | Carrinho |
| Order Bump | Checkout |
| Compre Junto | Página do Produto |
| **Upsell** | **Página Obrigado** |

---

## Ações Disponíveis

| Ação | Descrição | Visível quando recusado? |
|------|-----------|--------------------------|
| Retry cartão | Formulário inline de retentativa | ✅ Sim |
| Ver meus pedidos | Link para conta | ✅ Sim |
| Voltar para a loja | Link para home | ✅ Sim |
| WhatsApp | Contato com suporte | ✅ Sim |
| Copiar código rastreio | Clipboard API | ❌ Não (sem rastreio) |
| Social Share | Compartilhamento | ❌ Não (oculto) |

---

## SEO

| Meta | Valor |
|------|-------|
| `robots` | `noindex, nofollow` |
| `<title>` | "Pedido Confirmado - [Loja]" |

---

## Marketing Events (Pixel Tracking — Arquitetura Dual v7.0)

### Rastreamento Dual (Browser + CAPI)

O evento `Purchase` é disparado **exclusivamente** na página de obrigado (`ThankYouContent.tsx`), tanto via browser (pixel `fbq()`) quanto via servidor (edge function `marketing-capi-track`), usando o mesmo `event_id` para desduplicação automática pela Meta.

**REGRA v8.15.0:** O Purchase **NÃO** é disparado quando `status=declined` (effectiveDeclined = true). Se o retry aprovar, o evento é disparado normalmente após a atualização do estado.

| Canal | Método | Deduplicação |
|-------|--------|-------------|
| Browser | `fbq('track', 'Purchase', params)` via `MarketingTracker.trackPurchase()` | `event_id` compartilhado |
| Servidor | Edge function `marketing-capi-track` via `MarketingTracker.sendServerEvent()` | Mesmo `event_id` |

### Regras

1. **Único ponto de disparo**: Purchase só dispara em `ThankYouContent.tsx` — **nunca** em `checkout-create-order`, webhooks de pagamento ou `CheckoutStepWizard`
2. **Respeita `purchaseEventTiming`** configurado no builder
3. **Não dispara para declined**: `effectiveDeclined` impede o disparo
4. **Dedup client-side**: `purchaseTrackedRef` (ref local) + `trackOnce` key `purchase_{orderId}`
5. **`content_ids`**: usam `resolveMetaContentId()` para paridade com catálogo Meta

### Anti-Regressão: Race Condition do Tracker (v6.2.2)

**Problema corrigido:** O `MarketingTrackerProvider` inicializa o tracker de forma **deferida**. Se o pedido carrega antes do tracker, o `purchaseTrackedRef` era marcado antes do disparo efetivo.

**Solução:** 
1. `ThankYouContent.tsx` verifica `if (!tracker) return` **ANTES** de marcar o ref
2. `purchaseTrackedRef` só é preenchido **APÓS** o `trackPurchase()` ser chamado
3. `tracker` é adicionado como dependência do `useEffect`

### Arquivos Envolvidos

| Arquivo | Descrição |
|---------|-----------|
| `src/components/storefront/ThankYouContent.tsx` | Dispara Purchase + UI de declined/retry + CTA "outra forma" |
| `src/hooks/useRetryCardPayment.ts` | Retry de pagamento por cartão no mesmo pedido |
| `src/hooks/useRetryCheckoutData.ts` | Carrega dados seguros para prefill do checkout no modo retry |
| `src/hooks/useOrderDetails.ts` | Busca dados do pedido (sem CPF) |
| `src/lib/marketingTracker.ts` | `trackPurchase()` + `sendServerEvent()` |
| `src/components/storefront/MarketingTrackerProvider.tsx` | Provider que injeta `tenantId` |
| `supabase/functions/get-order/index.ts` | Edge function que retorna dados do pedido (sem CPF) |
| `supabase/functions/get-retry-checkout-data/index.ts` | Edge function que retorna dados seguros para retry com outra forma |
| `supabase/functions/retry-card-payment/index.ts` | Edge function que processa retry de cartão server-side |

---

## Pendências

- [ ] Upsell 1-click funcional
- [ ] Countdown timer para ofertas
- [ ] Compartilhamento social
- [ ] Email de confirmação visual
- [ ] QR Code para rastreio
- [x] CTA "Outra forma de pagamento" com retry_token (Etapa 5) — IMPLEMENTADO
- [x] Reconstrução automática do carrinho no modo retry (Etapa 5) — IMPLEMENTADO
