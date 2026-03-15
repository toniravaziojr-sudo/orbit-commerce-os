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

## Retentativa de Pagamento por Cartão (v8.15.0 — Etapa 4)

### Regras

| Regra | Descrição |
|-------|-----------|
| **Quando aparece** | Somente quando URL contém `status=declined` |
| **Tipo de pagamento** | Apenas cartão de crédito — NÃO permite PIX ou boleto inline |
| **Pedido** | Reutiliza o mesmo pedido existente — NÃO cria pedido novo |
| **Gateway** | Detecta automaticamente o gateway ativo do tenant (Pagar.me ou Mercado Pago) |
| **Sucesso** | Remove `status=declined` da URL, refaz busca do pedido, exibe estado de sucesso |
| **Recusa de novo** | Mantém formulário com mensagem de erro da operadora |
| **Erro técnico** | Exibe "Problema técnico" diferenciado, sem mascarar como "recusado" |

### Fluxo — Retry com sucesso

```
1. Página carrega com ?status=declined
2. Exibe header vermelho (❌) + formulário de cartão
3. Cliente preenche dados do cartão
4. useRetryCardPayment chama edge function de cobrança com order_id existente
5. Gateway aprova → retryResult.success = true
6. handleRetrySuccess: remove status=declined da URL + refetch order
7. Página exibe header verde (✅) + timeline normal
8. Purchase event disparado (se configurado)
```

### Fluxo — Retry com nova recusa

```
1. Cliente tenta com outro cartão
2. Gateway recusa novamente → retryResult.cardDeclined = true
3. Alert vermelho com mensagem da operadora
4. Formulário continua visível para nova tentativa
```

### Fluxo — Retry com erro técnico

```
1. Cliente tenta com cartão
2. Chamada à operadora falha (HTTP/network) → retryResult.technicalError = true
3. Alert vermelho com "Problema técnico ao processar. Tente novamente."
4. Formulário continua visível
```

### Hook: `useRetryCardPayment`

| Campo | Valor |
|-------|-------|
| **Tipo** | Hook |
| **Localização** | `src/hooks/useRetryCardPayment.ts` |
| **Parâmetros** | `order: OrderDetails`, `tenantId: string` |
| **Retorno** | `{ retryPayment, isRetrying, retryResult, resetRetryResult }` |
| **Comportamento** | Detecta gateway ativo → chama edge function de cobrança com `order_id` existente → retorna resultado classificado (success / cardDeclined / technicalError) |
| **Não faz** | NÃO cria pedido novo. NÃO permite PIX/boleto. |

### Componente: `CardRetrySection`

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente |
| **Localização** | `src/components/storefront/ThankYouContent.tsx` (interno) |
| **Props** | `order`, `tenantId`, `onSuccess` |
| **Campos do formulário** | Número do cartão (com máscara), Nome no cartão, Mês/Ano validade, CVV (mascarado), Parcelas |
| **CVV** | `type="password"` com toggle de visibilidade |
| **Parcelas** | Calculadas a partir do total do pedido (1x a 12x) |
| **CTA alternativa** | Texto informativo: "Precisa usar outra forma de pagamento? Entre em contato pelo WhatsApp." |

### CTA "Outra forma de pagamento" — Dependência da Etapa 5

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ AGUARDANDO ETAPA 5 |
| **Implementação atual** | Texto informativo direcionando ao WhatsApp |
| **Motivo** | A implementação segura requer `retry_token` (token de sessão único vinculado ao pedido) para permitir retorno ao checkout sem expor o `order_id` diretamente na URL |
| **Proibição** | NÃO implementar fallback baseado apenas em `order_id` na URL — risco de segurança |

---

## Dados do Pedido

| Campo | Fonte |
|-------|-------|
| Número | `order.order_number` |
| Status | `order.status` |
| Itens | `order.items` (via edge function get-order) |
| Pagamento | `order.payment_method`, `order.payment_status` |
| Endereço | `order.shipping_*` |
| Rastreio | `order.tracking_code`, `order.shipping_carrier` |
| CPF | `order.customer_cpf` (usado no retry) |
| Parcelas | `order.installments` |

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
| `src/components/storefront/ThankYouContent.tsx` | Dispara Purchase + UI de declined/retry |
| `src/hooks/useRetryCardPayment.ts` | Retry de pagamento por cartão no mesmo pedido |
| `src/hooks/useOrderDetails.ts` | Busca dados do pedido (inclui `tenant_id`, `customer_cpf`, `installments`) |
| `src/lib/marketingTracker.ts` | `trackPurchase()` + `sendServerEvent()` |
| `src/components/storefront/MarketingTrackerProvider.tsx` | Provider que injeta `tenantId` |
| `supabase/functions/get-order/index.ts` | Edge function que retorna dados do pedido |

---

## Pendências

- [ ] Upsell 1-click funcional
- [ ] Countdown timer para ofertas
- [ ] Compartilhamento social
- [ ] Email de confirmação visual
- [ ] QR Code para rastreio
- [ ] CTA "Outra forma de pagamento" com retry_token (Etapa 5)
