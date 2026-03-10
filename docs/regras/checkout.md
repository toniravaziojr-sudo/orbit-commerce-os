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
| `src/pages/storefront/StorefrontCheckout.tsx` | Este documento (lógica de herança header/footer) |
| `src/hooks/useGlobalLayoutIntegration.ts` | Este documento (lógica de herança no Builder) |
| `src/hooks/useCheckoutPayment.ts` | Este documento |
| `src/hooks/useCheckoutTestimonials.ts` | Este documento |
| `supabase/functions/checkout-create-order/*` | Este documento + `edge-functions.md` |
| `supabase/functions/pagarme-create-charge/*` | Este documento + `edge-functions.md` |
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

### Sidebar Sticky — Resumo do Pedido

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Visual |
| **Localização** | `CheckoutStepWizard.tsx`, `index.css` |
| **Descrição** | O resumo do pedido fica fixo (sticky top-4) na sidebar direita enquanto o usuário rola o formulário |
| **Comportamento** | O grid usa `align-items: start` para impedir que a coluna da sidebar se estique verticalmente. O container sticky contém o cupom + resumo. **Depoimentos ficam FORA do grid `sf-checkout-layout`** (não apenas fora do sticky), evitando qualquer sobreposição ao scrollar. No desktop, a wrapper `.sf-checkout-testimonials-wrapper` tem `max-width: 380px; margin-left: auto` para alinhar visualmente à coluna da sidebar. |
| **CSS** | `.sf-checkout-layout { align-items: start }` no container query `min-width: 768px`. `.sf-checkout-testimonials-wrapper { max-width: 380px; margin-left: auto }` |
| **Erros/Edge cases** | Se os depoimentos ficarem DENTRO da mesma coluna do grid que tem o sticky, o resumo passa por cima deles ao scrollar. SEMPRE manter fora do grid. |

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

## Pendências Conhecidas

| Item | Status | Descrição |
|------|--------|-----------|
| **Parcelamento (installments)** | 🔴 Pendente | UI de seleção de parcelas não implementada; padrão `installments=1` |
| **Desconto real PIX** | 🔴 Pendente | Desconto de 5% é apenas visual (badge); recálculo real do total no backend não implementado |
| **CheckoutContent.tsx** | 🟡 Limpeza | Código legado que pode ser removido após migração completa para `CheckoutStepWizard` |
