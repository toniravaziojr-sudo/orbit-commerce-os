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
| `checkout-create-order` | Criação atômica do pedido (items, customer, address) |
| `pagarme-create-charge` | Processamento de pagamento via Pagar.me |
| `mercadopago-create-charge` | Processamento de pagamento via Mercado Pago |
| `mercadopago-storefront-webhook` | Webhook de status de pagamento do Mercado Pago (storefront) |

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

### Correção (v8.2.5) — Pedidos duplicados e órfãos

**Problema:** Cada tentativa de pagamento criava um novo pedido, poluindo a lista. Pedidos sem transação ficavam como "órfãos".

**Correções:**
- `useCheckoutPayment`: Agora armazena `pendingOrderRef` (orderId + orderNumber) no state. Se o pagamento falha, a próxima tentativa reutiliza o pedido existente ao invés de criar outro.
- `resetPayment()` limpa o ref para permitir um novo pedido em caso de mudança de contexto.
- `pagarme-create-charge` (v8.2.4): Já sincroniza `orders.status` imediatamente quando o gateway retorna falha.

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
| **Localização** | `checkout-create-order/index.ts` (v3.0), `mercadopago-create-charge/index.ts` (v2.0), `pagarme-create-charge/index.ts` (v2.0), tabela `order_price_audit` |
| **Descrição** | O total do pedido é recalculado no servidor usando preços do banco de dados, frete do snapshot canônico e desconto revalidado. Valores enviados pelo navegador são ignorados para fins de cobrança. |
| **Fluxo** | 1. Checkout cria pedido → busca preços reais dos produtos no banco → recalcula subtotal canônico → busca frete canônico do shipping_quote → revalida desconto → calcula `canonical_total` → persiste no pedido e na tabela de auditoria |
| **Cobrança** | Funções de cobrança (Pagar.me e Mercado Pago) buscam `canonical_total` do pedido no banco e usam esse valor para cobrar. Se `canonical_total` não existir, usam o valor enviado como fallback. |
| **Auditoria** | Tabela `order_price_audit` registra: `submitted_subtotal`, `submitted_shipping`, `submitted_discount`, `submitted_total` vs `canonical_subtotal`, `canonical_shipping`, `canonical_discount`, `canonical_total`. Colunas geradas: `subtotal_drift`, `total_drift`, `has_drift`. |
| **Drift Detection** | Log estruturado `[PRICE_AUDIT] ⚠️ DRIFT DETECTED` quando diferença > R$0.01 entre submitted e canonical. |
| **Modo atual** | SIMULAÇÃO — divergências são registradas mas não bloqueiam o pedido. Enforcement futuro rejeitará pedidos com drift significativo. |
| **Performance** | 1 query adicional (buscar preços dos produtos), 1 query condicional (revalidar desconto). Sem impacto perceptível — ambas usam índices existentes por tenant_id. |
