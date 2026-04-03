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
| Header/Footer | **Exclusivos do checkout** — configuração separada via `checkout_header_config` / `checkout_footer_config` |
| Dados do cliente | Nome, email, telefone, CPF |
| Endereço de entrega | Formulário com busca de CEP |
| Forma de pagamento | PIX, Boleto, Cartão de Crédito |
| Order Bumps | Ofertas 1-click baseadas em regras |
| Resumo do pedido | Itens, subtotal, frete, descontos, total |
| Testimonials | Prova social (depoimentos de clientes) |
| Selos de segurança | Badges de confiança e segurança |

---

## 3. Header e Footer Exclusivos

Configuração independente via `storefront_global_layout.checkout_header_config` / `checkout_footer_config`.

### 3.1 Defaults do Checkout

| Elemento | Prop | Default Checkout | Default Global |
|----------|------|------------------|----------------|
| Header | `showSearch` | `false` | `true` |
| Header | `showHeaderMenu` | `false` | `true` |
| Header | `customerAreaEnabled` | `false` | `true` |
| Header | `featuredPromosEnabled` | `false` | `true/false` |
| Header | `showSac` | `false` | `true` |
| Header | `showSecuritySeals` | `false` | `true/false` |
| Header | `logoPosition` | `center` | N/A |
| Footer | `showSocial` | `false` | `true` |
| Footer | `showNewsletterSection` | `false` | `true/false` |
| Footer | `menuId` | `''` (vazio) | menu configurado |
| Footer | `showPaymentMethods` | `true` | `true` |
| Footer | `showSecuritySeals` | `true` | `true` |

### 3.2 Props Exclusivas do Checkout

| Prop | Tipo | Descrição |
|------|------|-----------|
| `logoPosition` | `'left' \| 'center' \| 'right'` | Posição do logo no header |
| `logoSize` | `'small' \| 'medium' \| 'large'` | Tamanho do logo (herda do global se vazio) |
| `showSac` | boolean | Exibe dropdown de atendimento (SAC) |
| `paymentMethods` | ImageSectionData | Bandeiras de pagamento (herda do global se vazio) |
| `securitySeals` | ImageSectionData | Selos de segurança (herda do global se vazio) |
| `copyrightText` | string | Texto customizado do copyright |
| `menuVisualStyle` | `'classic' \| 'elegant' \| 'minimal'` | Estilo visual dos links (herda do global) |
| `badgeSize` | `'small' \| 'medium' \| 'large'` | Tamanho dos selos (herda do global) |

### 3.3 Herança de Logo

A lógica de renderização respeita a seguinte prioridade:

1. `checkout_header_config.props.logoUrl` — se definida no checkout, usa esta
2. `header_config.props.logoUrl` — se herança do global está ativa
3. `storeSettings.logo_url` — fallback final do tenant

```typescript
// StorefrontHeaderContent.tsx
const effectiveLogoUrl = props.logoUrl && String(props.logoUrl).trim() !== '' 
  ? String(props.logoUrl) 
  : storeSettings?.logo_url || '';
```

### 3.4 Regras de Herança

1. **Props editáveis** (cores, imagens, texto): Se vazias no checkout, herdam do global
2. **Toggles de visibilidade**: Valor do checkout tem prioridade absoluta
3. **Bandeiras/selos**: Se não definidas no checkout, herdam do footer global

### 3.5 Props Visuais Herdadas

**Header:**
```typescript
const headerVisualPropsToInherit = [
  'headerBgColor', 'headerTextColor', 'headerIconColor',
  'logoUrl', 'mobileLogoUrl', 'logoWidth', 'logoHeight', 'logoSize'
];
```

**Footer:**
```typescript
const footerPropsToInherit = [
  'footerBgColor', 'footerTextColor', 'footerTitlesColor', 'logoUrl',
  'paymentMethods', 'securitySeals', 'shippingMethods', 'officialStores',
  'copyrightText', 'menuVisualStyle', 'badgeSize'
];
```

### 3.6 Algoritmo de Merge (IDÊNTICO em Builder e Público)

```
1. Iterar sobre props visuais do checkout
2. Se vazia (undefined, '', [], { items: [] }) → herdar do global
3. Se preenchida → usar valor do checkout (prioridade absoluta)
4. Para toggles de visibilidade → SEMPRE usar valor do checkout
5. Defaults automáticos: showPaymentMethods=true e showSecuritySeals=true quando há dados
```

**Proibições:**

| Proibido | Motivo |
|----------|--------|
| Lógica de merge diferente entre Builder e Público | Causa discrepância visual |
| Alterar apenas um dos arquivos | Quebra paridade |
| Usar props hardcoded no checkout público | Ignora configurações do Builder |

### 3.7 Sincronização Builder ↔ Público (REGRA CRÍTICA)

| Contexto | Arquivo | Responsabilidade |
|----------|---------|------------------|
| **Builder Preview** | `useGlobalLayoutIntegration.ts` → `applyGlobalLayout()` | Merge de props com herança |
| **Checkout Público** | `StorefrontCheckout.tsx` → `checkoutHeaderConfig` / `checkoutFooterConfig` useMemo | Merge de props com herança |

> ⚠️ Alterar um OBRIGA atualizar o outro para manter paridade visual.

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
| `useCheckoutPayment` | Processamento multi-gateway. Expõe `activeGateway` (`'pagarme'` ou `'mercadopago'`) |
| `useCheckoutTestimonials` | CRUD de testimonials |
| `useActiveOfferRules` | Busca Order Bumps |
| `usePublicPaymentDiscounts` | Descontos/parcelas por gateway. Aceita `provider` opcional |
| `useCepLookup` | Busca automática de endereço por CEP |
| `useRetryCheckoutData` | Dados para retry com outra forma |
| `useRetryCardPayment` | Retry de cartão no mesmo pedido. Aceita `paymentAttemptId` |

---

## 6. Edge Functions

| Function | Função |
|----------|--------|
| `checkout-create-order` | Criação atômica do pedido. Gera `retry_token` para cartão. Persiste `retry_from_order_id` em retries |
| `pagarme-create-charge` | Pagamento via Pagar.me |
| `mercadopago-create-charge` | Pagamento via Mercado Pago |
| `mercadopago-storefront-webhook` | Webhook de status de pagamento MP |
| `retry-card-payment` | Retentativa de cartão no mesmo pedido — valida `retry_token`, cobra server-side |
| `get-retry-checkout-data` | Dados seguros para retry (sem CPF) — valida `retry_token` |

### Seleção Dinâmica de Gateway

O `useCheckoutPayment` consulta `payment_providers` do tenant:
- Se Mercado Pago habilitado → `mercadopago-create-charge`
- Se Pagar.me habilitado → `pagarme-create-charge`
- Fallback: Pagar.me

O gateway ativo é exposto como `activeGateway` e passado ao `usePublicPaymentDiscounts` como `providerKey`.

---

## 7. Configurações (`store_settings.checkout_config`)

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `paymentOrder` | string[] | `['pix','boleto','card']` | Ordem dos métodos |
| `paymentLabels` | object | `{}` | Labels personalizados |
| `showCouponField` | boolean | true | Campo de cupom |
| `showTestimonials` | boolean | true | Seção de testimonials |
| `showOrderBump` | boolean | true | Ofertas de order bump |
| `showTrustBadges` | boolean | true | Selos de confiança |
| `showSecuritySeals` | boolean | true | Selos de segurança |
| `showTimeline` | boolean | true | Timeline de etapas |

---

## 8. Cores Personalizadas (Page Override)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `buttonPrimaryBg` | string | '' | Cor fundo botão primário (herda do tema se vazio) |
| `buttonPrimaryText` | string | '' | Cor texto botão primário |
| `buttonPrimaryHover` | string | '' | Cor hover botão primário |
| `flagsColor` | string | '' | Cor das flags/tags (ex: "Grátis", badges de desconto) |

> O checkout NÃO possui opção de "Botão Secundário" (disponível apenas no Carrinho).

### Classe de Escopo

Container recebe `sf-page-checkout` via `StorefrontCheckout.tsx`. Overrides vencem tema global por especificidade CSS natural, sem `!important`.

### Hierarquia de Especificidade

| Nível | Seletor | Especificidade |
|-------|---------|---------------|
| Global | `.storefront-container .sf-btn-primary` | 0,2,0+ |
| Checkout | `.sf-page-checkout` (redefine CSS vars) | 0,1,0 (vars cascateiam) |

### Timeline de Passos (ProgressTimeline)

| Estado | Cor utilizada | Fallback |
|--------|--------------|----------|
| Passo atual | `--theme-button-primary-bg` | `hsl(var(--primary))` |
| Passo atual (texto) | `--theme-button-primary-text` | `hsl(var(--primary-foreground))` |
| Passos completos | `--theme-button-primary-bg` 15% opacity | `--theme-accent-color` ou `#22c55e` |
| Passos futuros | `bg-muted` / `text-muted-foreground` | — |

### Classes CSS para Flags

| Classe | Uso |
|--------|-----|
| `sf-checkout-flag` | Badge que usa `--theme-flags-color` |
| `sf-flag-text` | Texto que usa `--theme-flags-color` |

### Arquitetura de Injeção

- **Builder (preview):** `useBuilderThemeInjector.ts` lê draft e injeta vars CSS
- **Loja pública:** `PageColorsInjector.tsx` + `usePageColors.ts` leem `published_content` e injetam
- **Mecanismo:** CSS vars redefinidas dentro de `.sf-page-checkout`, cascateando para filhos

---

## 9. Regras de Testimonials (Prova Social)

| Contexto | Comportamento |
|----------|---------------|
| **Builder** (`isEditing=true`) | Exibe dados demo como fallback |
| **Storefront Público** | APENAS com `published_at IS NOT NULL` |
| **Publicação** | Ao publicar template, testimonials ativos são publicados |

```
is_active = true → aparece no admin
is_active = true + published_at IS NOT NULL → aparece no storefront público
```

---

## 10. Regras de Order Bump

| Regra | Descrição |
|-------|-----------|
| Fonte de dados | `offer_rules` com `type='order_bump'` |
| Condição | `is_active=true` |
| Filtro | Produtos já no carrinho são filtrados |
| Desconto | `percent`, `fixed` ou `none` |

---

## 11. Formas de Pagamento

| Método | Gateway | Campos adicionais |
|--------|---------|-------------------|
| PIX | Pagar.me / MP | QR Code + copia/cola |
| Boleto | Pagar.me / MP | Código barras + PDF |
| Cartão | Pagar.me / MP | Número, validade, CVV, parcelas |

---

## 12. Fluxo de Criação de Pedido

```
1. Validação de dados do formulário (cliente)
2. checkout-create-order:
   → Valida produtos (verifica se product_ids existem)
   → Cria/atualiza customer
   → Cria address
   → Cria order com items_snapshot
   → Salva payment_method_discount, installments, installment_value
   → Cria order_items
3. pagarme/mercadopago-create-charge:
   → Processa pagamento no gateway (amount inclui desconto)
   → Passa installments para parcelamento
   → Atualiza order.payment_status
4. Redirect para Thank You
```

---

## 13. Validação de Produtos no Checkout (REGRA CRÍTICA)

| Cenário | Comportamento |
|---------|---------------|
| Produto deletado após adicionar ao carrinho | Retorna erro `INVALID_PRODUCTS` |
| Produto de outro tenant | Retorna erro `INVALID_PRODUCTS` |
| Erro de validação | Lista de IDs inválidos para limpeza do carrinho |

### Códigos de Erro da Edge Function

| Código | Descrição |
|--------|-----------|
| `MISSING_REQUIRED_FIELDS` | Dados obrigatórios ausentes |
| `PRODUCT_VALIDATION_ERROR` | Erro interno ao validar |
| `INVALID_PRODUCTS` | Produtos não existem mais |
| `ORDER_NUMBER_ERROR` | Erro ao gerar número |
| `INTERNAL_ERROR` | Erro interno inesperado |

---

## 14. Validações Obrigatórias

| Campo | Validação |
|-------|-----------|
| CPF | 11 dígitos + algoritmo módulo 11 + rejeita sequências repetidas |
| Email | Formato válido |
| Telefone | Mínimo 10 dígitos |
| CEP | 8 dígitos + validação ViaCEP |
| Cartão | Luhn algorithm + validade futura |

### Validação de CPF — Utilitário `formatCpf.ts`

| Função | Descrição |
|--------|-----------|
| `extractCpfDigits(value)` | Remove tudo que não é dígito |
| `formatCpf(value)` | Aplica máscara `000.000.000-00` |
| `isValidCpf(value)` | Validação completa: 11 dígitos + rejeita repetidos + módulo 11 |
| `handleCpfInput(value)` | Para `onChange` — limita 11 dígitos e aplica máscara |

---

## 15. Busca Automática de Endereço por CEP

| Campo | Valor |
|-------|-------|
| **Localização** | `CheckoutStepWizard.tsx` (Step2Address), `CheckoutForm.tsx` |
| **Comportamento** | CEP 8 dígitos → clique na lupa (🔍) ou Enter → ViaCEP → preenche logradouro, bairro, cidade, estado |
| **Hook** | `useCepLookup` |
| **Erros** | CEP inválido → "CEP deve ter 8 dígitos". Não encontrado → "CEP não encontrado". Rede → "Erro ao buscar CEP" |

> **REGRA:** NÃO há persistência de CEP do carrinho → checkout. São contextos independentes.

---

## 16. Regra de Ofertas por Local (REGRA FIXA)

| Tipo de Oferta | Local Correto |
|----------------|---------------|
| Cross-sell | Carrinho |
| **Order Bump** | **Checkout** |
| Compre Junto | Página do Produto |
| Upsell | Página Obrigado |

---

## 17. Descontos por Forma de Pagamento (por Gateway)

### Tabela `payment_method_discounts`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants |
| `provider` | TEXT | Gateway (`pagarme`, `mercadopago`). Default: `pagarme` |
| `payment_method` | TEXT | `pix`, `credit_card`, `boleto` |
| `discount_type` | TEXT | `percentage` ou `fixed` |
| `discount_value` | NUMERIC | Valor do desconto (ex: 5.00 = 5%) |
| `is_enabled` | BOOLEAN | Ativo |
| `installments_max` | INTEGER | Parcelas máximas (cartão) |
| `installments_min_value_cents` | INTEGER | Valor mínimo por parcela (centavos) |
| `description` | TEXT | Descrição no checkout |

**Unique constraint:** `(tenant_id, provider, payment_method)`.

### Configuração (por Gateway)

Localização: **Sistema > Configurações > Pagamentos**.
Abas por gateway ativo. Se nenhum gateway ativo, exibe alerta com link para Integrações.

### Builder vs Configurações Reais

| Local | O que controla |
|-------|----------------|
| **Builder > Checkout** | Visibilidade (toggles) e labels visuais (badges) |
| **Sistema > Configurações > Pagamentos** | Descontos REAIS, parcelas, valores — separados por gateway |

> Avisos no Builder alertam que labels são apenas visuais.

### Fluxo no Checkout (Storefront)

1. `useCheckoutPayment` identifica `activeGateway`
2. `CheckoutStepWizard` mapeia para `providerKey`
3. `usePublicPaymentDiscounts(tenantId, providerKey)` carrega descontos do gateway
4. `calculatePaymentMethodDiscount()` e `getMaxInstallments()` aplicam regras

---

## 18. Tracking Comercial

### Attribution (UTM / GCLID / FBCLID / TTCLID)

| Regra | Descrição |
|-------|-----------|
| Captura | `useStoredAttribution()` → `sessionStorage` |
| Passagem | `CheckoutStepWizard.tsx` passa `attribution` para `processPayment()` |
| Persistência | `checkout-create-order` grava no campo `attribution` |
| Limpeza | `clearStoredAttribution()` após sucesso |

### Affiliate Tracking

| Regra | Descrição |
|-------|-----------|
| Captura | `useAffiliateTracking(tenantId)` captura `?ref=` |
| Persistência | `checkout-create-order` grava `affiliate_id` |
| Limpeza | `clearStoredAffiliateData()` após sucesso |

### Checkout Session (Abandono)

| Regra | Descrição |
|-------|-----------|
| Criação | `useCheckoutSession()` cria sessão ao entrar |
| Atualização | `checkout-create-order` marca como `converted` |

---

## 19. Classificação de Falhas de Pagamento

| Cenário | Pedido? | Cobrança? | Comportamento | Campo no resultado |
|---------|---------|-----------|---------------|-------------------|
| **A — Falha antes do pedido** | ❌ | ❌ | Fica no checkout com erro genérico | `success: false` |
| **B — Erro técnico pós-pedido** | ✅ | ❌ Não chegou | "Problema técnico", não limpa carrinho, novo pedido se tentar de novo | `technicalError: true` |
| **C — Cartão recusado** | ✅ | ✅ Recusou | Redirect para Thank You `status=declined` | `cardDeclined: true` |

### Fluxo — Cartão recusado (C)

1. Pedido criado → cobrança enviada → operadora recusa
2. Retorno: `{ success: false, cardDeclined: true, orderId, orderNumber }`
3. Limpa carrinho e rascunho
4. Redirect: `/obrigado?pedido=XXXX&status=declined`

### Fluxo — Erro técnico (B)

1. Pedido criado → chamada à operadora falha (HTTP/timeout)
2. Retorno: `{ success: false, technicalError: true, orderId, orderNumber }`
3. NÃO limpa carrinho
4. Mensagem: "Ocorreu um problema técnico. Tente novamente."
5. Nova tentativa → cria pedido novo

### Expiração Automática

| Tipo | Prazo |
|------|-------|
| PIX | 1 hora |
| Boleto | 4 dias (3 úteis + 1 grace) |
| Órfãos (sem `payment_transaction`) | 30 min |

Cron: `expire-stale-orders` a cada 15min. Status: `payment_status='cancelled'`, `status='cancelled'`.

---

## 20. Retry de Pagamento

### 20.1 Retry Token

| Campo | Valor |
|-------|-------|
| Tabela | `orders.retry_token`, `orders.retry_token_expires_at` |
| Geração | `checkout-create-order` chama `generate_order_retry_token()` para `payment_method = 'credit_card'` |
| Transporte | Response → `PaymentResult.retryToken` → URL param `rt` |
| Validade | 24 horas |
| Invalidação | Após pagamento aprovado (set null) |
| Dados protegidos | CPF, endereço, dados do pedido — NUNCA expostos ao frontend |

### 20.2 Retry Cartão (mesmo pedido)

- `retry-card-payment` valida token e processa nova cobrança server-side
- Dados sensíveis resolvidos no servidor (não vêm do frontend)

### 20.3 Retry com Outra Forma de Pagamento

| Campo | Valor |
|-------|-------|
| Ativação | Thank You exibe "Tentar com outra forma" quando `status=declined` e token válido |
| Redirect | `/loja/:slug/checkout?rt=TOKEN` |
| Edge Function | `get-retry-checkout-data` — valida token, retorna dados seguros (sem CPF) |
| Reconstrução | `CheckoutStepWizard` recebe prefill → `clearCart()` → `addItem()` para cada item → restaura endereço |
| Recálculo | Preços, frete, cupom e total recalculados do zero — NÃO reutiliza valores do pedido anterior |
| Novo pedido | `checkout-create-order` recebe `retry_from_order_id` → persiste vínculo → invalida token original |
| Produto indisponível | Se produto saiu do catálogo, rejeita com `INVALID_PRODUCTS` |

### Hook: `useRetryCheckoutData`

| Campo | Valor |
|-------|-------|
| Parâmetros | `retryToken: string \| null` |
| Retorno | `{ prefill, isLoading, error }` |
| Dados retornados | `original_order_id`, `order_number`, `tenant_id`, `tenant_slug`, `total`, `customer` (name, email, phone), `shipping` (completo), `items[]` (product_id, variant_id, product_name, sku, quantity, unit_price, image_url) |
| Segurança | NÃO recebe CPF. Token validado server-side |

---

## 21. Segurança

### 21.1 Validação de Preço Canônico (Phase 2B)

| Campo | Valor |
|-------|-------|
| Descrição | Total recalculado no servidor usando preços do banco, frete canônico e desconto revalidado |
| `orders.total` | Valor do frontend (usado na cobrança) |
| `orders.canonical_total` | Recalculado no servidor (auditoria) |
| Variantes | Busca preço em `product_variants` quando `variant_id` presente |
| Auditoria | `order_price_audit`: submitted vs canonical (subtotal, shipping, discount, total) + `has_drift` |
| Drift Detection | Log `[PRICE_AUDIT] ⚠️ DRIFT DETECTED` quando diferença > R$0.01 |
| Modo atual | **SIMULAÇÃO** — divergências registradas, não bloqueiam pedido |
| Risco residual | `payment_method_discount` ainda vem do frontend |

### 21.2 RLS Hardening (Phase 3)

Zero policies anônimas em: `orders`, `order_items`, `customers`, `payment_transactions`, `order_attribution`.

Toda leitura/escrita via Edge Functions com `service_role`.

#### Phase 3A — Policies de Escrita Removidas

6 policies removidas (INSERT/UPDATE anônimo). Tudo já passava por `checkout-create-order`, `pagarme-create-charge`, `mercadopago-create-charge`.

#### Phase 3B — Policies de Leitura Removidas

2 policies removidas (SELECT anônimo em `orders` e `order_items`). Migrado para:
- `order-lookup` — lista/busca para clientes logados (JWT)
- `get-review-data` — itens do pedido para avaliação (token seguro)

### 21.3 Segurança ao Trocar Forma de Pagamento

- CVV usa `type="password"` (mascarado)
- Ao trocar forma: limpeza automática de dados do cartão, erro anterior e status de pagamento
- Cada clique em "Finalizar Pedido" cria pedido novo (sem reuso)

---

## 22. Idempotência e Snapshot Canônico

### Conceito

3 camadas de proteção:

1. **Lock síncrono no frontend** — `useRef(false)` impede duplo clique
2. **Snapshot canônico no servidor** — preços/frete/descontos recalculados do banco
3. **Idempotência na cobrança** — chave única por tentativa

### Chaves de Idempotência

| Chave | Gerada onde | Escopo |
|---|---|---|
| `checkout_attempt_id` (UUID) | Frontend, no clique "Finalizar" | Evita pedido duplicado no banco |
| `payment_attempt_id` (UUID) | Frontend, no clique "Finalizar" ou "Tentar novamente" | Evita cobrança duplicada no gateway (via `X-Idempotency-Key`) |

### Lock Síncrono

| Componente | Ref | Proteção |
|---|---|---|
| `CheckoutStepWizard.tsx` | `submissionLockRef` | Duplo clique em "Finalizar" |
| `CheckoutContent.tsx` | `submissionLockRef` | Idem (checkout clássico) |
| `ThankYouContent.tsx` (`CardRetrySection`) | `retryLockRef` | Duplo clique em "Tentar novamente" |

### Snapshot Canônico (o que mudou)

| Campo | Valor |
|---|---|
| `orders.subtotal` | `canonicalSubtotal` (servidor) |
| `orders.shipping_total` | `canonicalShipping` (servidor) |
| `orders.discount_total` | `canonicalDiscount` (servidor) |
| `orders.total` | `canonicalTotal` (servidor) |
| `order_items.unit_price` | Preço do DB (`productPriceMap` / `variantPriceMap`) |
| Gateway amount | `canonical_total` retornado pelo servidor |

---

## 23. Regra de Busca de Pedido (get-order)

| Regra | Descrição |
|-------|-----------|
| `tenant_id` obrigatório | Sempre passar para desambiguação |
| Duplicatas | `created_at DESC` + `LIMIT 1` |
| Busca por `order_number` | Aceita com ou sem `#` (normaliza) |
| Fallback | `#XXXX` → `XXXX` → formatos legados |

---

## 24. Navegação Checkout → Loja

**PROIBIDO** usar `<Link>` do React Router para rotas de conteúdo. Toda navegação checkout→loja via `window.location.href` (hard refresh), devolvendo controle ao Edge Function.

---

## 25. Layout

### Sidebar Sticky

Resumo + depoimentos fixos na sidebar direita (`sticky top-4`).
Grid usa `align-items: start`. Depoimentos ficam DENTRO do container sticky, após o `OrderSummarySidebar`.
No mobile (< 768px): empilha via flexbox.

### Ocultação de Integrações

Nomes de integrações (Frenet, Correios, Loggi, Jadlog) removidos das labels de frete na loja pública.
No admin, nomes continuam visíveis.

---

## 26. Visibilidade de Declined e Retry no Admin

1. Pedidos recusados aparecem na lista com badge "Recusado" (vermelho)
2. Pedidos com retentativa mostram ícone `Link2` ao lado do número
3. Banners bidirecionais no detalhe (original ↔ substituto)
4. `PaymentAttemptsCard` exibe histórico de tentativas
5. GMV filtra apenas `payment_status = 'approved'` — declined/substituídos não entram
6. Stat card "Recusados" conta pedidos do mês com `payment_gateway_id`

---

## 27. Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `src/components/storefront/checkout/*` | Este documento |
| `src/pages/storefront/StorefrontCheckout.tsx` | Herança header/footer (seção 3) |
| `src/hooks/useGlobalLayoutIntegration.ts` | Herança no Builder (seção 3) |
| `src/hooks/useCheckoutPayment.ts` | Seleção de gateway (seção 6) |
| `supabase/functions/checkout-create-order/*` | Criação de pedido (seção 12, 21, 22) |
| `supabase/functions/pagarme-create-charge/*` | Pagamento (seção 6) |
| `supabase/functions/retry-card-payment/*` | Retry (seção 20) |
| `supabase/functions/get-retry-checkout-data/*` | Retry outra forma (seção 20) |

### Arquivos de Sincronização (CRÍTICOS)

| Arquivo | Função |
|---------|--------|
| `StorefrontCheckout.tsx` | Merge para checkout PÚBLICO |
| `useGlobalLayoutIntegration.ts` | Merge para checkout no BUILDER |

---

## 28. Pendências

| Item | Status |
|------|--------|
| `CheckoutContent.tsx` | 🟡 Código legado para remoção após migração completa para `CheckoutStepWizard` |

---

*Fim do documento.*
