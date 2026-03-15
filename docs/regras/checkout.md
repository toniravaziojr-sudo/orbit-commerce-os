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
| Header/Footer | **Exclusivos do checkout** — configuração separada via `checkout_header_config` / `checkout_footer_config` |
| Dados do cliente | Nome, email, telefone, CPF |
| Endereço de entrega | Formulário com busca de CEP |
| Forma de pagamento | PIX, Boleto, Cartão de Crédito |
| Order Bumps | Ofertas 1-click baseadas em regras |
| Resumo do pedido | Itens, subtotal, frete, descontos, total |
| Testimonials | Prova social (depoimentos de clientes) |
| Selos de segurança | Badges de confiança e segurança |

---

## Header e Footer do Checkout (EXCLUSIVOS)

O checkout possui configuração **independente** de header e footer, separada do layout global da loja.

### Objetivo
Minimizar distrações durante a finalização da compra (sem menus de navegação, redes sociais, etc.)

### Defaults do Checkout

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

### Props Exclusivas do Checkout

| Prop | Tipo | Descrição |
|------|------|-----------|
| `logoPosition` | `'left' \| 'center' \| 'right'` | Posição do logo no header do checkout |
| `logoSize` | `'small' \| 'medium' \| 'large'` | Tamanho do logo (herda do global se vazio) |
| `showSac` | boolean | Exibe dropdown de atendimento (SAC) no header |
| `paymentMethods` | ImageSectionData | Bandeiras de pagamento (herda do global se vazio) |
| `securitySeals` | ImageSectionData | Selos de segurança (herda do global se vazio) |
| `copyrightText` | string | Texto customizado do copyright |
| `menuVisualStyle` | `'classic' \| 'elegant' \| 'minimal'` | Estilo visual dos links (herda do global se vazio) |
| `badgeSize` | `'small' \| 'medium' \| 'large'` | Tamanho dos selos (herda do global se vazio) |

### Configuração no Builder

1. Acesse o template **Checkout** no Builder
2. Clique no **Header** ou **Footer** na área de preview
3. O painel lateral exibirá as configurações **exclusivas do checkout**
4. As alterações são salvas em `storefront_global_layout.checkout_header_config` / `checkout_footer_config`

### Armazenamento

| Coluna | Tabela | Descrição |
|--------|--------|-----------|
| `checkout_header_config` | `storefront_global_layout` | BlockNode JSON do header do checkout |
| `checkout_footer_config` | `storefront_global_layout` | BlockNode JSON do footer do checkout |

### Regras de Herança

1. **Props editáveis** (cores, imagens, texto): Se vazias no checkout, herdam do global
2. **Toggles de visibilidade**: Valor do checkout tem prioridade absoluta
3. **Formas de pagamento/selos**: Se não definidas no checkout, herdam do footer global

### Sincronização Builder ↔ Público (REGRA CRÍTICA)

A lógica de herança DEVE ser idêntica em ambos os contextos para garantir paridade visual:

| Contexto | Arquivo | Responsabilidade |
|----------|---------|------------------|
| **Builder Preview** | `useGlobalLayoutIntegration.ts` → `applyGlobalLayout()` | Merge de props com herança |
| **Checkout Público** | `StorefrontCheckout.tsx` → `checkoutHeaderConfig` / `checkoutFooterConfig` useMemo | Merge de props com herança |

#### Props Visuais Herdadas (Header)

```typescript
const headerVisualPropsToInherit = [
  'headerBgColor', 'headerTextColor', 'headerIconColor',
  'logoUrl', 'mobileLogoUrl', 'logoWidth', 'logoHeight',
  'logoSize' // Tamanho do logo (small/medium/large)
];
```

> ⚠️ **IMPORTANTE**: A prop `logoUrl` é herdada do global para o checkout APENAS se não estiver definida no `checkout_header_config`. Quando definida, tem prioridade absoluta.

#### Renderização da Logo (StorefrontHeaderContent)

A lógica de renderização em `StorefrontHeaderContent.tsx` respeita a herança:

```typescript
// Logo URL - props.logoUrl tem PRIORIDADE sobre storeSettings.logo_url
const effectiveLogoUrl = props.logoUrl && String(props.logoUrl).trim() !== '' 
  ? String(props.logoUrl) 
  : storeSettings?.logo_url || '';
```

**Fluxo completo de herança da logo:**
1. `checkout_header_config.props.logoUrl` — se definida no checkout, usa esta
2. `header_config.props.logoUrl` — se herança do global está ativa e global tem logo
3. `storeSettings.logo_url` — fallback final do tenant

#### Props Visuais Herdadas (Footer)

```typescript
const footerPropsToInherit = [
  'footerBgColor', 'footerTextColor', 'footerTitlesColor', 'logoUrl',
  'paymentMethods', 'securitySeals', 'shippingMethods', 'officialStores',
  'copyrightText',
  'menuVisualStyle', 'badgeSize' // Estilo visual dos menus e tamanho dos selos
];
```

#### Algoritmo de Merge (IDÊNTICO em ambos)

```
1. Iterar sobre props visuais do checkout
2. Se vazia (undefined, '', [], { items: [] }) → herdar do global
3. Se preenchida → usar valor do checkout (prioridade absoluta)
4. Para toggles de visibilidade → SEMPRE usar valor do checkout
5. Defaults automáticos: showPaymentMethods=true e showSecuritySeals=true quando há dados
```

#### Proibições

| Proibido | Motivo |
|----------|--------|
| Lógica de merge diferente entre Builder e Público | Causa discrepância visual |
| Alterar apenas um dos arquivos | Quebra paridade |
| Usar props hardcoded no checkout público | Ignora configurações do Builder |

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
| `useCheckoutPayment` | `hooks/useCheckoutPayment.ts` | Processamento de pagamento (multi-gateway). Expõe `activeGateway` para identificar o provedor ativo (`'pagarme'` ou `'mercadopago'`). |
| `useCheckoutTestimonials` | `hooks/useCheckoutTestimonials.ts` | CRUD de testimonials |
| `useActiveOfferRules` | `hooks/useOfferRules.ts` | Busca regras de Order Bump |
| `usePublicPaymentDiscounts` | `hooks/usePublicPaymentDiscounts.ts` | Busca descontos/parcelas por forma de pagamento. Aceita `provider` opcional para filtrar por gateway. |

---

## Edge Functions (Backend)

| Function | Função |
|----------|--------|
| `checkout-create-order` | Criação atômica do pedido (items, customer, address). Gera `retry_token` para cartão. Persiste `retry_from_order_id` quando é retry. |
| `pagarme-create-charge` | Processamento de pagamento via Pagar.me |
| `mercadopago-create-charge` | Processamento de pagamento via Mercado Pago |
| `mercadopago-storefront-webhook` | Webhook de status de pagamento do Mercado Pago (storefront) |
| `retry-card-payment` | Retentativa de cartão no mesmo pedido — valida `retry_token`, resolve CPF/endereço server-side, chama gateway |
| `get-retry-checkout-data` | Retorna dados seguros para prefill do checkout no modo "outra forma" — valida `retry_token`, retorna itens/cliente/endereço (sem CPF) |

### Seleção Dinâmica de Gateway

O `useCheckoutPayment` consulta a tabela `payment_providers` do tenant na montagem e seleciona automaticamente o gateway ativo:
- Se `mercado_pago` está habilitado → usa `mercadopago-create-charge`
- Se `pagarme` está habilitado → usa `pagarme-create-charge`
- Fallback: Pagar.me (comportamento legado)

O gateway ativo é exposto como `activeGateway` no retorno do hook, e é utilizado pelo `CheckoutStepWizard` para passar o `providerKey` correto ao `usePublicPaymentDiscounts`, garantindo que descontos e parcelas sejam carregados do gateway específico.

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

## Cores Personalizadas do Checkout (Page Override)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `buttonPrimaryBg` | string | '' | Cor de fundo do botão primário (herda do tema se vazio) |
| `buttonPrimaryText` | string | '' | Cor do texto do botão primário (herda do tema se vazio) |
| `buttonPrimaryHover` | string | '' | Cor de hover do botão primário (herda do tema se vazio) |
| `flagsColor` | string | '' | Cor das flags/tags (ex: "Grátis", "Frete Grátis", badges de desconto). Herda do tema se vazio |

> **NOTA:** O checkout NÃO possui opção de "Botão Secundário". Essa opção está disponível apenas no Carrinho. Os botões "Alterar" no checkout seguem a cor primária.

### Classe de Escopo

O container do checkout recebe a classe `sf-page-checkout` via `StorefrontCheckout.tsx`.

Isso permite que os overrides de cores da página vençam as regras do tema global **por especificidade CSS natural**, sem `!important`.

### Hierarquia de Especificidade (Fase 2)

| Nível | Seletor | Especificidade |
|-------|---------|---------------|
| Global | `.storefront-container .sf-btn-primary` | 0,2,0+ |
| Checkout | `.sf-page-checkout` (redefine CSS vars) | 0,1,0 (vars cascateiam) |

### Regra de Herança

1. Se a cor estiver **vazia** (`''`), o elemento usa as cores do **tema global**
2. Se a cor estiver **preenchida**, ela **redefine as CSS vars** (`--theme-button-primary-bg`, etc.) no escopo `.sf-page-checkout`
3. Para flags/tags: a var `--theme-flags-color` é redefinida no escopo, afetando `.sf-checkout-flag` e `.sf-flag-text`
4. Configuração em: **Configurações do Tema > Páginas > Checkout > Cores Personalizadas**

### Timeline de Passos (ProgressTimeline)

A timeline de passos do checkout (indicadores "Contato > Entrega > Pagamento") utiliza as cores customizadas do checkout:

| Estado | Cor utilizada | Fallback |
|--------|--------------|----------|
| **Passo atual** | `--theme-button-primary-bg` | `hsl(var(--primary))` do tema global |
| **Passo atual (texto)** | `--theme-button-primary-text` | `hsl(var(--primary-foreground))` |
| **Passos completos** | `--theme-button-primary-bg` com 15% opacity | `--theme-accent-color` ou `#22c55e` |
| **Passos futuros** | `bg-muted` / `text-muted-foreground` | — |
| **Barras conectoras (mobile)** | `--theme-button-primary-bg` | `--theme-accent-color` ou `#22c55e` |

> ⚠️ **IMPORTANTE**: As variáveis `--theme-button-primary-bg` e `--theme-button-primary-text` são injetadas pelo `PageColorsInjector` quando cores personalizadas estão configuradas. Se não houver cores customizadas, a timeline usa as cores do tema global.

### Classes CSS para Flags

| Classe | Uso |
|--------|-----|
| `sf-checkout-flag` | Badge/tag que usa `--theme-flags-color` (ex: "Grátis" no frete) |
| `sf-flag-text` | Texto que usa `--theme-flags-color` (ex: "Grátis" inline) |

### Arquitetura de Injeção (sem !important)

- **Builder (preview):** `useBuilderThemeInjector.ts` lê o draft de `useBuilderDraftPageSettings` e injeta variáveis CSS
- **Loja pública:** `PageColorsInjector.tsx` + `usePageColors.ts` leem do `published_content` e injetam CSS
- **Mecanismo:** As CSS vars são redefinidas dentro do escopo `.sf-page-checkout`, cascateando naturalmente para os componentes filhos. Para flags, regras adicionais em `.sf-page-checkout .sf-checkout-flag` / `.sf-flag-text` aplicam `color-mix()` com a var `--theme-flags-color`

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
   → Salva `payment_method_discount`, `installments`, `installment_value` na tabela `orders`
   → Cria order_items
3. Chamada à Edge Function `pagarme-create-charge`
   → Processa pagamento no gateway (amount já inclui desconto por forma de pagamento)
   → Passa `installments` para parcelamento no cartão
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

## Busca Automática de Endereço por CEP (v8.13.1)

| Campo | Valor |
|-------|-------|
| **Tipo** | Função / UX |
| **Localização** | `CheckoutStepWizard.tsx` (Step2Address), `CheckoutForm.tsx` |
| **Contexto** | Campo de CEP na etapa de endereço de entrega |
| **Descrição** | Ao informar o CEP no checkout, o cliente pode acionar busca automática de endereço via ViaCEP |
| **Comportamento** | 1. Cliente digita CEP de 8 dígitos. 2. Clica no ícone de lupa (🔍) ou pressiona Enter. 3. Sistema consulta ViaCEP (`https://viacep.com.br/ws/{cep}/json/`). 4. Preenche automaticamente: logradouro, bairro, cidade e estado. 5. Cliente só precisa completar número e complemento. |
| **Condições** | CEP deve ter 8 dígitos válidos. Se CEP não encontrado, exibe erro. |
| **Visual** | Ícone de lupa ao lado do campo CEP. Spinner (Loader2) durante a busca. |
| **Afeta** | Campos: `shippingStreet`, `shippingNeighborhood`, `shippingCity`, `shippingState` |
| **Erros/Edge cases** | CEP inválido → mensagem "CEP deve ter 8 dígitos". CEP não encontrado → "CEP não encontrado". Erro de rede → "Erro ao buscar CEP". |
| **Hook** | `useCepLookup` (`src/hooks/useCepLookup.ts`) |

### Importante: NÃO há persistência de CEP do carrinho → checkout
O CEP digitado no estimador de frete (carrinho/mini-cart) **não** é automaticamente transferido para o campo de endereço do checkout. São contextos independentes. O draft do checkout persiste apenas dados já preenchidos no próprio checkout.

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
| `src/pages/storefront/StorefrontCheckout.tsx` | Este documento (lógica de herança header/footer) |
| `src/hooks/useGlobalLayoutIntegration.ts` | Este documento (lógica de herança no Builder) |
| `src/hooks/useCheckoutPayment.ts` | Este documento |
| `src/hooks/useCheckoutTestimonials.ts` | Este documento |
| `supabase/functions/checkout-create-order/*` | Este documento + `edge-functions.md` |
| `supabase/functions/pagarme-create-charge/*` | Este documento + `edge-functions.md` |
| `supabase/functions/mercadopago-create-charge/*` | Este documento + `edge-functions.md` |
| `supabase/functions/mercadopago-storefront-webhook/*` | Este documento + `edge-functions.md` |
| `supabase/functions/get-order/*` | Este documento + `edge-functions.md` |

### Arquivos de Sincronização (CRÍTICOS)

| Arquivo | Função |
|---------|--------|
| `StorefrontCheckout.tsx` | Lógica de merge para checkout PÚBLICO |
| `useGlobalLayoutIntegration.ts` | Lógica de merge para checkout no BUILDER |

> ⚠️ **REGRA OBRIGATÓRIA**: Ao alterar a lógica de herança em qualquer um destes arquivos, o outro DEVE ser atualizado para manter paridade visual.

---

## Regra de Busca de Pedido (get-order)

| Regra | Descrição |
|-------|-----------|
| **tenant_id obrigatório** | Sempre passar para desambiguação |
| **Duplicatas** | Ordenar por `created_at DESC` + `LIMIT 1` |
| **Busca por order_number** | Aceita com ou sem `#` (normaliza internamente) |
| **Fallback** | Tenta `#XXXX`, depois `XXXX`, depois formatos legados |

---

## Tracking Comercial no Checkout (v8.2.3)

### Attribution (UTM / GCLID / FBCLID / TTCLID)

| Regra | Descrição |
|-------|-----------|
| **Captura** | `useStoredAttribution()` captura UTMs da URL e armazena em `sessionStorage` |
| **Passagem** | `CheckoutStepWizard.tsx` passa `attribution` para `processPayment()` |
| **Persistência** | `checkout-create-order` grava no campo `attribution` do pedido |
| **Limpeza** | `clearStoredAttribution()` chamado após sucesso do pagamento |

### Affiliate Tracking

| Regra | Descrição |
|-------|-----------|
| **Captura** | `useAffiliateTracking(tenantId)` captura `?ref=` da URL |
| **Passagem** | `CheckoutStepWizard.tsx` passa `affiliateId` para `processPayment()` |
| **Persistência** | `checkout-create-order` grava `affiliate_id` no pedido |
| **Limpeza** | `clearStoredAffiliateData()` chamado após sucesso do pagamento |

### Checkout Session (Abandono)

| Regra | Descrição |
|-------|-----------|
| **Criação** | `useCheckoutSession()` cria sessão ao entrar no checkout |
| **Passagem** | `CheckoutStepWizard.tsx` passa `checkoutSessionId` para `processPayment()` |
| **Atualização** | `checkout-create-order` marca sessão como `converted` |

### Bug Corrigido (v8.2.3)

`CheckoutStepWizard.tsx` não passava `attribution`, `affiliateData` nem `checkoutSessionId` para `processPayment()`. Isso causava perda total de rastreamento comercial em todos os pedidos. Corrigido com passagem explícita dos 3 campos + limpeza pós-sucesso.

### Bug Corrigido (v8.2.4) — Pedido aprovado mas status "pendente"

**Problema:** Pedidos pagos na Pagar.me ficavam com `payment_status=pending` e `status=pending` no sistema. Três causas raiz:

1. **`pagarme-create-charge`**: Não atualizava o pedido quando cartão de crédito era aprovado imediatamente (síncrono). Dependia 100% do webhook.
2. **`pagarme-webhook`**: Extraía `chargeStatus` apenas de `payload.data.charges[0].status`. Alguns eventos Pagar.me (`order.paid`) podem não incluir o array `charges` completo, fazendo `chargeStatus=undefined` e caindo no `default` do switch sem atualizar nada.
3. **Trigger `auto_tag_cliente_on_payment_approved`**: Verificava `NEW.payment_status = 'paid'` mas o enum `payment_status` usa `'approved'`, não `'paid'`. Isso causava erro SQL que bloqueava o UPDATE do pedido.

**Correções:**
- `pagarme-create-charge`: Agora sincroniza `orders.status` e `orders.payment_status` imediatamente quando a cobrança retorna status síncrono (paid/failed/pending)
- `pagarme-webhook`: Agora usa fallback `payload.data?.status` quando `charges[0].status` não está disponível
- Trigger: Corrigido de `'paid'` para `'approved'` no enum `payment_status`

### [REMOVIDO] Correção (v8.2.5) — Pedidos duplicados e órfãos (pendingOrderRef)

> **REMOVIDO em v8.15.0** — A lógica de `pendingOrderRef` foi eliminada. Cada clique em "Finalizar Pedido" agora SEMPRE cria um pedido novo. O reuso de pedido causava problemas graves (caso Odair #41: pedido reutilizado sem cobrança real na operadora). A prevenção de duplicidade será tratada via fluxo de retry dedicado (Etapas 3-6 do plano v4).

### Correção (v8.15.0) — Segurança e limpeza ao trocar forma de pagamento

**Problema:** Ao trocar a forma de pagamento (ex: de Cartão para PIX), os dados do cartão ficavam em memória. O CVV era exibido em texto visível.

**Correções:**
- `PaymentMethodSelector`: CVV agora usa `type="password"` (mascarado com bolinhas)
- `CheckoutStepWizard` e `CheckoutContent`: Ao trocar forma de pagamento, executa limpeza automática:
  - Apaga todos os dados do cartão (número, nome, validade, CVV)
  - Limpa erro de pagamento anterior
  - Reseta status de pagamento para `idle`
- `useCheckoutPayment`: Removida toda lógica de `pendingOrderRef`, `PENDING_ORDER_KEY`, `loadPendingOrder`, `savePendingOrder`. Cada finalização sempre cria pedido novo.

### Modelo de Negócio de Pedido e Pagamento (v8.15.0)

```
1 clique "Finalizar Pedido" = 1 pedido novo (sempre)
1 pedido pode ter N tentativas de pagamento (payment_transactions)
Retry de cartão na Thank You = mesma order + nova transaction (IMPLEMENTADO — Etapa 4)
Trocar para outra forma = novo pedido vinculado via retry_from_order_id (IMPLEMENTADO — Etapa 5)
Carrinho reconstruído automaticamente = itens do pedido original repopulados no checkout (IMPLEMENTADO — Etapa 5)
Retry no mesmo pedido = APENAS cartão (IMPLEMENTADO — Etapa 4)
```

### Classificação de Falhas de Pagamento (v8.15.0 — Etapa 3)

O sistema agora diferencia 3 cenários de falha no pagamento:

| Cenário | Pedido criado? | Cobrança na operadora? | Comportamento no checkout | Campo no resultado |
|---------|---------------|----------------------|--------------------------|-------------------|
| **A — Falha antes do pedido** | ❌ Não | ❌ Não | Fica no checkout com erro genérico | `success: false` (sem flags) |
| **B — Erro técnico pós-pedido** | ✅ Sim | ❌ Não chegou | Fica no checkout com "Problema técnico" | `technicalError: true` |
| **C — Cartão recusado** | ✅ Sim | ✅ Tentou e recusou | Redireciona para Thank You com `status=declined` | `cardDeclined: true` |

#### Campos adicionados ao `PaymentResult` (v8.15.0)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cardDeclined` | `boolean` | `true` quando a operadora recusou explicitamente (antifraude, saldo, limite) |
| `technicalError` | `boolean` | `true` quando houve erro HTTP/rede na chamada à operadora (pedido existe, cobrança não chegou) |

#### Fluxo — Cartão recusado (Cenário C)

1. Pedido criado com sucesso
2. Cobrança enviada → operadora responde `success: false`
3. `processPayment` retorna `{ success: false, cardDeclined: true, orderId, orderNumber }`
4. Checkout limpa carrinho e rascunho
5. Redireciona para `/obrigado?pedido=XXXX&status=declined`

#### Fluxo — Erro técnico (Cenário B)

1. Pedido criado com sucesso
2. Chamada à operadora falha (erro HTTP, timeout, crash)
3. `processPayment` retorna `{ success: false, technicalError: true, orderId, orderNumber }`
4. Checkout **NÃO** limpa carrinho
5. Mostra mensagem "Ocorreu um problema técnico ao processar o pagamento. Tente novamente."
6. Se tentar de novo → cria pedido novo

#### Heurística operacional temporária (Cenário B no admin)

Pedidos do Cenário B podem ser identificados por: `payment_status = 'pending' AND payment_gateway_id IS NULL AND created_at < now() - 10min`. Isso é critério operacional temporário, não verdade de domínio.

### Automação (v8.2.5) — Expiração de PIX/Boleto pendentes

**Edge function:** `expire-stale-orders` (cron a cada 15 min)

| Tipo | Regra de expiração |
|------|--------------------|
| **PIX** | Cancela após 1 hora sem pagamento |
| **Boleto** | Cancela após 4 dias (3 úteis + 1 grace) |
| **Órfãos** | Cancela após 30 min se não tem nenhuma `payment_transaction` |

Status aplicados: `payment_status='cancelled'`, `status='cancelled'`, com `cancellation_reason` descritivo.

---

## Regras de Layout (v8.5.1)

### Sidebar Sticky — Resumo do Pedido + Depoimentos

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Visual |
| **Localização** | `CheckoutStepWizard.tsx`, `index.css` |
| **Descrição** | O resumo do pedido fica fixo (sticky top-4) na sidebar direita enquanto o usuário rola o formulário |
| **Comportamento** | O grid usa `align-items: start` para impedir que a coluna da sidebar se estique verticalmente. O container sticky contém cupom + resumo + depoimentos. **Depoimentos ficam DENTRO da coluna sidebar**, após o `OrderSummarySidebar`, dentro do container `sticky`. Isso evita o gap vertical que existia quando estavam fora do grid (o grid row height era ditada pela coluna mais alta, empurrando os depoimentos para baixo). No mobile (container query < 768px), o layout empilha naturalmente via flexbox. |
| **CSS** | `.sf-checkout-layout { align-items: start }` no container query `min-width: 768px`. |
| **Erros/Edge cases** | ~~Se os depoimentos ficarem DENTRO da mesma coluna do grid que tem o sticky, o resumo passa por cima deles ao scrollar~~ [CORRIGIDO v8.6.1] — depoimentos agora estão dentro do sticky container, após o resumo, sem sobreposição. O gap entre form e depoimentos no desktop era causado por posicioná-los fora do grid. |

### Ocultação de Nomes de Integração no Frete

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Visual / UX |
| **Localização** | `ShippingEstimator.tsx`, `CheckoutShipping.tsx`, `MiniCartDrawer.tsx`, `StorefrontConfigContext.tsx` |
| **Descrição** | Nomes de integrações (Frenet, Correios, Loggi, Jadlog) são removidos das labels de frete na loja pública |
| **Comportamento** | O mapeamento em `StorefrontConfigContext` limpa o `service_name` com regex para remover "(Correios)", "via frenet" etc. Os componentes de UI não exibem `carrier` nem `sourceProvider`. |
| **Afeta** | Carrinho (ShippingEstimator), Checkout (CheckoutShipping), Mini-Cart (MiniCartDrawer) |
| **Condições** | Sempre oculto na loja pública. No painel admin (Pedidos, Logística), os nomes continuam visíveis. |

---

## Navegação Checkout → Loja (REGRA CRÍTICA)

> **Problema:** O checkout é renderizado pelo React (SPA), mas a loja é servida pelo Edge Function. Ao clicar no logo do header do checkout para voltar à Home, o React interceptava a navegação e tentava renderizar a Home como SPA — causando uma "versão bugada" da loja.

### Solução

O header e footer do checkout usam `StorefrontHeaderContent` e `StorefrontFooterContent`, que implementam navegação context-aware via `isSpaRoute()`. Links para rotas de conteúdo (Home, categorias, produtos) forçam `window.location.href` (hard refresh), devolvendo o controle ao Edge Function.

| Ação do Usuário | Comportamento Esperado |
|-----------------|------------------------|
| Clicar no logo do header do checkout | `window.location.href` → Home via Edge (hard refresh) |
| Botão "Voltar" do navegador no checkout | Navegação nativa do browser (sem conflito) |
| Link de categoria no footer do checkout | `window.location.href` → Categoria via Edge |

### Regra

**PROIBIDO** usar `<Link>` do React Router para navegar do checkout para qualquer rota de conteúdo. Toda navegação checkout→loja DEVE ser via `window.location.href`.

---

## Pendências Conhecidas

| Item | Status | Descrição |
|------|--------|-----------|
| **CheckoutContent.tsx** | 🟡 Limpeza | Código legado que pode ser removido após migração completa para `CheckoutStepWizard` |

---

## Descontos por Forma de Pagamento (por Gateway)

### Tabela: `payment_method_discounts`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants |
| `provider` | TEXT | Gateway de pagamento (`pagarme`, `mercadopago`, etc.). Default: `pagarme` |
| `payment_method` | TEXT | `pix`, `credit_card`, `boleto` |
| `discount_type` | TEXT | `percentage` ou `fixed` |
| `discount_value` | NUMERIC | Valor do desconto (ex: 5.00 = 5%) |
| `is_enabled` | BOOLEAN | Se o desconto está ativo |
| `installments_max` | INTEGER | Parcelas máximas (cartão) |
| `installments_min_value_cents` | INTEGER | Valor mínimo por parcela em centavos |
| `description` | TEXT | Descrição opcional exibida no checkout |

**Unique constraint:** `(tenant_id, provider, payment_method)` — cada combinação gateway + método é única.

### Configuração (por Gateway)

| Campo | Valor |
|-------|-------|
| **Tipo** | Config / Settings |
| **Localização** | `src/pages/SystemSettings.tsx`, `src/components/system-settings/PaymentSettingsTab.tsx` |
| **Contexto** | Menu Sistema → Configurações → Pagamentos |
| **Descrição** | Permite configurar descontos REAIS por forma de pagamento para cada gateway ativo |
| **Comportamento** | Abas por gateway ativo (Pagar.me, Mercado Pago). Dentro de cada aba, PIX/Cartão/Boleto com toggle, desconto e parcelas. Se nenhum gateway ativo, exibe alerta com link para Integrações. |
| **Hook** | `usePaymentMethodDiscounts(provider?)` (`src/hooks/usePaymentMethodDiscounts.ts`) |
| **Afeta** | Valor final cobrado no checkout |

### Alerta de Gateway

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Visual / UX |
| **Localização** | `PaymentSettingsTab.tsx` |
| **Descrição** | Se nenhum gateway está ativo em `payment_providers`, exibe `Alert variant="destructive"` informando que é necessário configurar um operador de pagamento em Integrações. |
| **Condição** | `providers.filter(p => p.is_enabled).length === 0` |

### Builder vs Configurações Reais

| Local | O que controla |
|-------|----------------|
| **Builder > Checkout > Formas de Pagamento** | Visibilidade (toggles PIX/Boleto/Cartão) e labels visuais (badges como "5% OFF") |
| **Builder > Theme > PaymentMethodsConfig** | Ordem de exibição e badges decorativos |
| **Sistema > Configurações > Pagamentos** | Descontos REAIS, parcelas, valores que afetam a cobrança — **separados por gateway** |

> ⚠️ Os avisos no Builder alertam o usuário que labels/badges são apenas visuais e que para aplicar descontos reais ele deve acessar Sistema → Configurações → Pagamentos.

### Avisos no Builder

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Visual / UX |
| **Localização** | `CheckoutSettingsPanel.tsx`, `PaymentMethodsConfig.tsx` |
| **Descrição** | Alert amarelo informando que toggles/labels são apenas visuais e que configurações reais estão em Sistema > Configurações > Pagamentos |

### Fluxo no Checkout (Storefront)

1. `useCheckoutPayment` identifica o `activeGateway` do tenant
2. `CheckoutStepWizard` mapeia `activeGateway` para `providerKey` (`'pagarme'` ou `'mercadopago'`)
3. `usePublicPaymentDiscounts(tenantId, providerKey)` carrega descontos **específicos do gateway ativo**
4. `calculatePaymentMethodDiscount()` e `getMaxInstallments()` aplicam as regras ao total

---

## Navegação

| Origem | Destino | Condição |
|--------|---------|----------|
| Menu Sistema → Configurações | `/system/settings?tab=payments` | Sempre disponível |
| Builder Checkout → Alert | Sistema > Configurações > Pagamentos | Link informativo |

---

## 🔒 Segurança — Validação de Preço Canônico (Phase 2B, v2026-03-14)

| Campo | Valor |
|-------|-------|
| **Tipo** | Segurança financeira |
| **Localização** | `checkout-create-order/index.ts` (v3.1), `mercadopago-create-charge/index.ts` (v2.1), `pagarme-create-charge/index.ts` (v2.1), tabela `order_price_audit` |
| **Descrição** | O total do pedido é recalculado no servidor usando preços do banco de dados (produtos e variantes), frete do snapshot canônico e desconto revalidado. O `canonical_total` é persistido para auditoria mas **NÃO** é usado na cobrança nesta fase. |
| **Fluxo** | 1. Checkout cria pedido → busca preços reais dos produtos e variantes no banco → recalcula subtotal canônico → busca frete canônico do shipping_quote → revalida desconto → calcula `canonical_total` → persiste no pedido e na tabela de auditoria |
| **orders.total** | Vem do frontend (valor exibido ao cliente). É o valor usado na cobrança. |
| **orders.canonical_total** | Recalculado no servidor. Usado apenas para auditoria e detecção de divergência. **NÃO** é usado na cobrança nesta fase. |
| **order_items.unit_price** | Vem do frontend (preço unitário exibido ao cliente). |
| **Cobrança** | Funções de cobrança (Pagar.me e Mercado Pago) usam `payload.amount` (valor enviado pelo frontend). Apenas **logam** comparação com `canonical_total` para auditoria. Nenhum valor é substituído. |
| **Variantes** | Quando o item tem `variant_id`, o cálculo canônico busca o preço na tabela `product_variants`. Sem `variant_id`, usa `products.price`. |
| **Auditoria** | Tabela `order_price_audit` registra: `submitted_subtotal`, `submitted_shipping`, `submitted_discount`, `submitted_total` vs `canonical_subtotal`, `canonical_shipping`, `canonical_discount`, `canonical_total`. Colunas calculadas pelo insert: `subtotal_drift`, `total_drift`, `has_drift`. |
| **Drift Detection** | Log estruturado `[PRICE_AUDIT] ⚠️ DRIFT DETECTED` quando diferença > R$0.01 entre submitted e canonical. |
| **Modo atual** | **SIMULAÇÃO PURA** — divergências são registradas mas NÃO alteram valor cobrado e NÃO bloqueiam o pedido. Enforcement futuro será ativado por flag separada. |
| **Performance** | 1-2 queries adicionais (produtos + variantes quando aplicável), 1 query condicional (revalidar desconto). Sem impacto perceptível — ambas usam índices existentes por tenant_id. |
| **Dependência de deploy** | A gravação de auditoria e o preenchimento de `canonical_total` na tabela `orders` dependem da versão publicada de `checkout-create-order`. Sem publish, o pipeline de observabilidade fica inativo em produção. |
| **Correção v2026-03-14b** | (1) Insert em `order_price_audit` agora inclui `subtotal_drift`, `total_drift` e `has_drift` explicitamente. (2) Erros de insert são logados como `console.error` (antes eram silenciados). (3) Fingerprint do carrinho corrigido: `StorefrontConfigContext` agora envia `product_id` e `variant_id` nos itens do frete. `ShippingEstimator` corrigido para usar `item.product_id` em vez de `item.id`. |

---

## 🔒 Segurança — Remoção de Policies Públicas de Escrita (Phase 3A, v2026-03-14)

| Campo | Valor |
|-------|-------|
| **Tipo** | Hardening de RLS |
| **Descrição** | Removidas 6 policies que permitiam INSERT/UPDATE anônimo nas tabelas de checkout. Todas essas operações já são realizadas por funções no servidor com permissão administrativa (service_role). |
| **Policies removidas** | 1. `Anyone can create orders for checkout` (orders INSERT) |
| | 2. `Anyone can create order items for checkout` (order_items INSERT) |
| | 3. `Anyone can create customers for checkout` (customers INSERT) |
| | 4. `Anyone can update customers for checkout` (customers UPDATE) |
| | 5. `Anyone can create payment transactions for checkout` (payment_transactions INSERT) |
| | 6. `Anon can insert attribution` (order_attribution INSERT) |
| **Justificativa** | Nenhum código do frontend faz INSERT/UPDATE diretamente nessas tabelas. Tudo passa por `checkout-create-order`, `pagarme-create-charge` e `mercadopago-create-charge` (service_role). |
| **Policies mantidas (fase futura)** | [REMOVIDO] — Todas as policies de leitura anônima foram removidas na Phase 3B. |
| **Rollback** | Recriar as 6 policies via migração SQL com `CREATE POLICY ... FOR INSERT/UPDATE ... WITH CHECK (true)` nas tabelas afetadas. |
| **Impacto** | Nenhum impacto no checkout — operações já usam funções no servidor. Impede escrita anônima direta nessas tabelas sensíveis. |

---

## 🔒 Segurança — Remoção de Policies Públicas de Leitura (Phase 3B, v2026-03-14)

| Campo | Valor |
|-------|-------|
| **Tipo** | Hardening de RLS |
| **Descrição** | Removidas as 2 últimas policies que permitiam SELECT anônimo em `orders` e `order_items`. Leituras migradas para funções no servidor (`order-lookup` e `get-review-data`). |
| **Policies removidas** | 1. `Anyone can view order by number for confirmation` (orders SELECT) |
| | 2. `Anyone can view order items for checkout` (order_items SELECT) |
| **Funções criadas** | `order-lookup` — lista e busca pedidos para clientes logados (autenticação via JWT). Substitui leituras diretas de `useCustomerOrders`. |
| | `get-review-data` — busca itens do pedido para página de avaliação via token seguro. Substitui leitura direta de `StorefrontReview`. |
| **Arquivos migrados** | `src/hooks/useCustomerOrders.ts` (v2) — agora usa `order-lookup` via `supabase.functions.invoke()` |
| | `src/pages/storefront/StorefrontReview.tsx` (v2) — agora usa `get-review-data` via `supabase.functions.invoke()` |
| **Segurança order-lookup** | Requer JWT válido. Valida o email do usuário autenticado e filtra pedidos apenas por esse email. Nenhum usuário pode ver pedidos de outro email. |
| **Segurança get-review-data** | Usa token de avaliação (validado via `validate_review_token` RPC). Retorna apenas itens do pedido vinculado ao token. Token expira e é de uso único. |
| **Nota sobre product_reviews** | A inserção de avaliações (`product_reviews INSERT`) continua via cliente direto com policy própria separada. Não afetada por esta mudança. |
| **Rollback** | Recriar as 2 policies: `CREATE POLICY "Anyone can view order by number for confirmation" ON public.orders FOR SELECT USING (true)` e `CREATE POLICY "Anyone can view order items for checkout" ON public.order_items FOR SELECT USING (true)`. Reverter `useCustomerOrders.ts` e `StorefrontReview.tsx` para versão anterior (leitura direta). |
| **Resultado** | Zero policies anônimas restantes em `orders` e `order_items`. Todas as leituras e escritas passam por funções autenticadas no servidor. |

---

## 🔒 Estado Consolidado de Segurança (v2026-03-14)

> **REGRA ESTRUTURAL** — Este estado é o padrão final das tabelas de checkout e NÃO deve ser revertido sem aprovação explícita.

As seguintes tabelas estão **sem nenhuma policy anônima** (nem INSERT, nem SELECT):
- `orders`
- `order_items`
- `customers`
- `payment_transactions`
- `order_attribution`

**Toda** leitura e escrita nessas tabelas passa por Edge Functions com `service_role`.

> Para detalhes dos padrões de segurança aplicáveis, consultar: `docs/regras/edge-functions.md` → seção "Padrões de Segurança — Acesso a Dados Sensíveis".

---

## 🔒 Retry Token para Retentativa Segura (v8.15.1)

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra de Segurança |
| **Tabela** | `orders.retry_token`, `orders.retry_token_expires_at` |
| **Geração** | `checkout-create-order` chama `generate_order_retry_token()` para pedidos com `payment_method = 'credit_card'` |
| **Transporte** | Retornado no response do `checkout-create-order` → passado via `PaymentResult.retryToken` → URL param `rt` no redirect para Thank You |
| **Uso** | `retry-card-payment` edge function valida o token e processa nova cobrança server-side |
| **Validade** | 24 horas |
| **Invalidação** | Após pagamento aprovado, token é removido (set null) |
| **Dados protegidos** | CPF, endereço completo, dados do pedido — NUNCA expostos ao frontend para retry |
| **`get-order` response** | `customer_cpf` **REMOVIDO** do response público. `retry_token` incluído apenas quando payment_status != approved e token válido |

---

## 🔧 Correção: Propagação de quote_id no CheckoutShipping (2026-03-13)

| Campo | Valor |
|-------|-------|
| **Tipo** | Correção de Bug |
| **Localização** | `src/components/storefront/checkout/CheckoutShipping.tsx` |
| **Contexto** | Cálculo de frete na página de checkout |
| **Problema** | O componente `CheckoutShipping` chamava `setShippingOptions(options)` sem passar o `quoteId` retornado pela cotação assíncrona (Frenet/multi). Isso fazia com que `shipping.quoteId` ficasse sempre `null` quando o frete era calculado no checkout (e não no carrinho). Como consequência, o servidor nunca recebia `shipping_quote_id`, impedindo a validação canônica de frete e o vínculo `used_by_order_id` na tabela `shipping_quotes`. |
| **Segundo problema** | O `cartItems` montado no `CheckoutShipping` não incluía `product_id`, `variant_id`, `free_shipping` e `free_shipping_method`, impedindo o motor de frete grátis por produto de funcionar corretamente no checkout. |
| **Correção** | (1) Extrair `quote_id` do resultado assíncrono e passá-lo como segundo argumento de `setShippingOptions`. (2) Incluir campos completos (`product_id`, `variant_id`, `free_shipping`, `free_shipping_method`) no `cartItems` enviado ao `quoteAsync`. |
| **Comparação** | O componente `ShippingEstimator` (carrinho) já fazia ambas as coisas corretamente. O `CheckoutShipping` estava desatualizado. |
| **Afeta** | `order_price_audit.shipping_quote_id`, `shipping_quotes.used_by_order_id`, `orders.shipping_quote_id` |
| **Resultado** | Todos os pedidos criados a partir de agora terão `shipping_quote_id` preenchido quando o frete for calculado via Frenet/multi. |

### Nota sobre cobertura de auditoria (order_price_audit)

O código de auditoria de preços no `checkout-create-order` foi reimplantado em 2026-03-13. Pedidos anteriores (#1-#32) foram criados antes da existência deste código. O pedido #33 foi o primeiro a registrar auditoria com sucesso. A reimplantação garante que todos os pedidos futuros gerem registros de auditoria automaticamente.

---

## Validação de CPF no Checkout

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Lógica / Validação |
| **Localização** | `src/lib/formatCpf.ts`, `src/components/storefront/checkout/CheckoutForm.tsx`, `src/components/storefront/checkout/CheckoutStepWizard.tsx` |
| **Contexto** | Campo "CPF" nos dois formatos de checkout (formulário padrão e wizard por etapas) |
| **Descrição** | Validação matemática real do CPF usando algoritmo oficial dos dígitos verificadores (módulo 11), aplicada antes de permitir avanço no checkout |
| **Comportamento** | 1. Máscara aplicada enquanto digita (`000.000.000-00`). 2. Ao tentar avançar, valida: campo obrigatório → 11 dígitos → rejeita sequências repetidas (111.111.111-11) → calcula dígitos verificadores. 3. Se inválido, exibe "CPF inválido. Verifique os números digitados." e impede avanço. |
| **Condições** | Validação roda em ambos os formatos de checkout. Não se aplica ao cadastro de cliente no painel admin (campo livre). |
| **Afeta** | `pagarme-create-charge`, `mercadopago-create-charge`, `pagbank-create-charge` — CPFs inválidos nunca mais chegam às operadoras |
| **Erros/Edge cases** | CPFs com todos os dígitos iguais são rejeitados. CPFs com menos de 11 dígitos são rejeitados. Campo vazio exibe "CPF é obrigatório". |

### Utilitário `formatCpf.ts`

| Função | Descrição |
|--------|-----------|
| `extractCpfDigits(value)` | Remove tudo que não é dígito |
| `formatCpf(value)` | Aplica máscara `000.000.000-00` |
| `isValidCpf(value)` | Validação completa: 11 dígitos + rejeita repetidos + dígitos verificadores (módulo 11) |
| `handleCpfInput(value)` | Para uso em `onChange` — limita a 11 dígitos e aplica máscara |
