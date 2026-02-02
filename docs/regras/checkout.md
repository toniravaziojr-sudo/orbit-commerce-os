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

## Cores Personalizadas (Builder)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `buttonPrimaryBg` | string | '' | Cor de fundo do botão primário (herda do tema se vazio) |
| `buttonPrimaryText` | string | '' | Cor do texto do botão primário (herda do tema se vazio) |
| `buttonPrimaryHover` | string | '' | Cor de hover do botão primário (herda do tema se vazio) |
| `buttonSecondaryBg` | string | '' | Cor de fundo do botão secundário (herda do tema se vazio) |
| `buttonSecondaryText` | string | '' | Cor do texto do botão secundário (herda do tema se vazio) |
| `buttonSecondaryHover` | string | '' | Cor de hover do botão secundário (herda do tema se vazio) |

### Regra de Herança

1. Se a cor estiver **vazia** (`''`), o botão usa as cores do **tema global**
2. Se a cor estiver **preenchida**, ela **sobrescreve** o tema
3. Configuração em: **Configurações do Tema > Páginas > Checkout > Cores Personalizadas**

### Arquitetura de Injeção

- **Builder (preview):** `useBuilderThemeInjector.ts` lê o draft de `useBuilderDraftPageSettings` e injeta variáveis CSS
- **Loja pública:** `PageColorsInjector.tsx` + `usePageColors.ts` leem do `published_content` e injetam CSS

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
