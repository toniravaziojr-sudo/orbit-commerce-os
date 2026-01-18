# REGRAS — Comando Central

> **REGRA PRINCIPAL:** NUNCA INTERPRETAR AS REGRAS DESTE DOCS, SEMPRE SEGUIR ELAS A RISCA, SE TIVER DÚVIDAS SOBRE ALGUMA IMPLEMENTAÇÃO, CONSULTAR O USUÁRIO ANTES DE PROSSEGUIR.

## Propósito

Este documento é a **FONTE ÚNICA DE VERDADE** para todas as especificações funcionais, contratos de UI/UX, fluxos e regras de negócio do Comando Central.

---

## Como Usar Este Documento

> **OBRIGATÓRIO:** A Lovable deve **SEMPRE** ler este documento (`docs/REGRAS.md`) antes de iniciar qualquer implementação ou ajuste em qualquer módulo do sistema.

---

## Regra de Imutabilidade

| Regra | Descrição |
|-------|-----------|
| **Proibição de edição autônoma** | A Lovable **NÃO PODE** editar, atualizar, reescrever ou "melhorar" este documento por conta própria. |
| **Alteração somente por comando explícito** | Este documento só pode ser alterado quando o usuário pedir explicitamente usando o formato: `ATUALIZAR REGRAS: [instruções exatas + onde inserir]`. |
| **Reporte de lacunas/conflitos** | Se a Lovable identificar inconsistência, lacuna ou melhoria necessária, ela deve apenas **REPORTAR** e propor um texto sugerido para o usuário aprovar — **SEM ALTERAR O ARQUIVO**. |

---

## Índice (TOC)

1. [Arquitetura Builder vs Storefront Público](#arquitetura-builder-vs-storefront-público)
   1. [Fluxo de Dados](#fluxo-de-dados)
   2. [Fonte de Verdade dos Settings](#fonte-de-verdade-dos-settings)
   3. [Padrão de Settings por Página](#padrão-de-settings-por-página)
   4. [Integração com Carrinho](#integração-com-carrinho)
   5. [Comportamento Builder vs Público](#comportamento-builder-vs-público)
2. [Loja Virtual / Builder](#loja-virtual--builder)
   1. [Funções Padrões (globais, independentes de tema)](#funções-padrões-globais-independentes-de-tema)
   2. [Páginas Padrão](#páginas-padrão)
      - [Página Inicial](#página-inicial)
      - [Categoria](#categoria)
      - [Produto](#produto)
      - [Carrinho](#carrinho)
      - [Checkout](#checkout)
      - [Obrigado](#obrigado)
      - [Minha Conta](#minha-conta)
      - [Pedidos](#pedidos)
      - [Pedido](#pedido)
      - [Rastreio](#rastreio)
      - [Blog](#blog)

---

## Arquitetura Builder vs Storefront Público

> **REGRA CRÍTICA:** Esta seção define a arquitetura obrigatória para TODAS as páginas do Builder/Storefront. Qualquer nova página DEVE seguir estes padrões.

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAMADA DE PÁGINA                                 │
│  Arquivos: src/pages/storefront/Storefront*.tsx                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Buscar dados reais do banco (produtos, categorias, etc)              │
│  • Buscar settings do template PUBLICADO (published_content)            │
│  • Detectar modo preview (?preview=1)                                   │
│  • Montar BlockRenderContext completo                                   │
│  • Passar tudo para PublicTemplateRenderer                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                     PUBLIC TEMPLATE RENDERER                             │
│  Arquivo: src/components/storefront/PublicTemplateRenderer.tsx          │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Renderizar estrutura global (Header/Footer)                          │
│  • Gerenciar slots (afterHeaderSlot, afterContentSlot)                  │
│  • Aplicar overrides de página                                          │
│  • Passar context para BlockRenderer                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         BLOCK RENDERER                                   │
│  Arquivo: src/components/builder/BlockRenderer.tsx                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Mapear block.type para componente React                              │
│  • Passar props + context para cada bloco                               │
│  • Gerenciar isEditing vs público                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    BLOCK LAYOUT COMPONENT                                │
│  Ex: CategoryPageLayout, ProductDetailsBlock, CartBlock                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Ler settings específicos do context (categorySettings, etc)          │
│  • Aplicar toggles de visibilidade                                      │
│  • Integrar com useCart para funcionalidade real                        │
│  • Comportamento diferente baseado em isEditing                         │
│  • Renderizar UI final                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fonte de Verdade dos Settings

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STOREFRONT_TEMPLATE_SETS                              │
├─────────────────────────────────────────────────────────────────────────┤
│  draft_content: {                     ← Usado no BUILDER                │
│    home: BlockNode,                                                      │
│    category: BlockNode,                                                  │
│    product: BlockNode,                                                   │
│    ...                                                                   │
│    themeSettings: {                                                      │
│      headerConfig: {...},                                                │
│      footerConfig: {...},                                                │
│      miniCartEnabled: boolean,                                           │
│      pageSettings: {                  ← Settings por página             │
│        category: CategorySettings,                                       │
│        product: ProductSettings,                                         │
│        cart: CartSettings,                                               │
│        checkout: CheckoutSettings,                                       │
│        thankYou: ThankYouSettings,                                       │
│      }                                                                   │
│    }                                                                     │
│  }                                                                       │
│                                                                          │
│  published_content: {...}             ← Usado no STOREFRONT PÚBLICO     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Regra de Leitura:**
- **Builder/Editor:** Sempre usa `draft_content`
- **Storefront Público:** Sempre usa `published_content`
- **Preview (?preview=1):** Usa `draft_content` para teste antes de publicar

### Padrão de Settings por Página

#### Categoria (CategorySettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showRatings` | boolean | true | Exibe estrelas de avaliação nas thumbs |
| `showBadges` | boolean | true | Exibe selos do menu "Aumentar Ticket" |
| `showAddToCartButton` | boolean | true | Exibe botão "Adicionar ao carrinho" |
| `quickBuyEnabled` | boolean | false | Botão principal vai direto ao checkout |
| `buyNowButtonText` | string | "Comprar agora" | Texto do botão principal |
| `customButtonEnabled` | boolean | false | Exibe botão personalizado |
| `customButtonText` | string | "" | Texto do botão personalizado |
| `customButtonColor` | string | "" | Cor do botão personalizado |
| `customButtonLink` | string | "" | URL do botão personalizado |
| `showBanner` | boolean | true | Exibe banner da categoria |

#### Produto (ProductSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showGallery` | boolean | true | Exibe galeria de imagens secundárias |
| `showDescription` | boolean | true | Exibe descrição curta |
| `showVariants` | boolean | true | Exibe seletor de variantes |
| `showStock` | boolean | true | Exibe quantidade em estoque |
| `showReviews` | boolean | true | Exibe avaliações e formulário |
| `showBuyTogether` | boolean | true | Exibe seção "Compre Junto" |
| `showRelatedProducts` | boolean | true | Exibe grid de produtos relacionados |
| `showWhatsAppButton` | boolean | true | Exibe botão "Comprar pelo WhatsApp" |
| `showAddToCartButton` | boolean | true | Exibe botão "Adicionar ao carrinho" |
| `showBadges` | boolean | true | Exibe selos do produto (Novo, Mais Vendido, etc) |
| `showShippingCalculator` | boolean | true | Exibe calculadora de frete |
| `showAdditionalHighlight` | boolean | false | Exibe banners de destaque adicional |
| `showFloatingCart` | boolean | true | Exibe popup de carrinho rápido |
| `buyNowButtonText` | string | "Comprar agora" | Texto do botão principal |
| `cartActionType` | CartActionType | "miniCart" | Ação ao clicar em "Adicionar ao carrinho" |
| `additionalHighlightImagesMobile` | string[] | [] | URLs de imagens mobile (até 3) |
| `additionalHighlightImagesDesktop` | string[] | [] | URLs de imagens desktop (até 3) |

#### Carrinho (CartSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showCrossSell` | boolean | true | Exibe produtos sugeridos |
| `showCouponField` | boolean | true | Exibe campo de cupom |
| `showTrustBadges` | boolean | true | Exibe selos de confiança |
| `showShippingCalculator` | boolean | true | Exibe calculadora de frete |

#### Checkout (CheckoutSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderSummary` | boolean | true | Exibe resumo do pedido |
| `showCouponField` | boolean | true | Exibe campo de cupom |
| `allowGuestCheckout` | boolean | true | Permite checkout sem login |

#### Obrigado (ThankYouSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderDetails` | boolean | true | Exibe detalhes do pedido |
| `showRelatedProducts` | boolean | true | Exibe produtos relacionados |
| `showTrackingInfo` | boolean | true | Exibe info de rastreio |

### Integração com Carrinho

#### Regras Obrigatórias

1. **SEMPRE** usar `useCart()` do `@/contexts/CartContext` para operações de carrinho
2. **SEMPRE** renderizar `MiniCartDrawer` quando `miniCartEnabled !== false`
3. **SEMPRE** implementar feedback visual "Adicionado" quando mini-cart está desabilitado
4. **SEMPRE** usar `getPublicCheckoutUrl(tenantSlug)` para compra rápida

#### Padrão de Handler

```typescript
const handleAddToCart = (product: Product, e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  const cartItem = {
    product_id: product.id,
    name: product.name,
    price: product.price,
    quantity: 1,
    image_url: product.images?.[0]?.url,
    sku: product.sku || product.slug,
  };
  
  addItem(cartItem, (addedItem) => {
    if (miniCartEnabled && openMiniCartOnAdd) {
      setMiniCartOpen(true);
    } else {
      setAddedProducts(prev => new Set(prev).add(product.id));
      toast.success('Produto adicionado ao carrinho');
      setTimeout(() => {
        setAddedProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(product.id);
          return newSet;
        });
      }, 2000);
    }
  });
};
```

### Comportamento Builder vs Público

| Aspecto | Builder (isEditing=true) | Público (isEditing=false) |
|---------|--------------------------|---------------------------|
| **Dados** | Produtos de exemplo ou amostra aleatória | Dados reais do banco |
| **Cliques** | Bloqueados ou modo interativo | Funcionais |
| **Carrinho** | Simulado ou desabilitado | useCart real |
| **Links** | Não navegam | Navegam normalmente |
| **Settings** | draft_content | published_content |

#### Regras de Implementação

1. **NUNCA** fazer queries de settings dentro dos blocos - sempre receber via context
2. **SEMPRE** usar `published_content` no público e `draft_content` no builder
3. **SEMPRE** ter fallback para `storefront_page_templates` (legacy)
4. **NUNCA** duplicar lógica entre páginas - criar hooks/utils compartilhados
5. **SEMPRE** seguir os defaults definidos neste documento

### Dados Demo vs Dados Reais (REGRA GLOBAL OBRIGATÓRIA)

> **REGRA CRÍTICA:** Dados demo/fictícios só podem aparecer no Builder (modo edição). O storefront público NUNCA deve exibir dados fictícios.

#### Princípio Fundamental

| Contexto | Comportamento |
|----------|---------------|
| **Builder** (`isEditing === true`) | Exibe dados demo como fallback quando não há dados reais |
| **Storefront Público** (`isEditing === false`) | Exibe APENAS dados reais; se não houver, retorna `null` (bloco não renderiza) |

#### Padrão de Implementação Obrigatório

```typescript
// PADRÃO CORRETO para todos os blocos com dados demo
const hasRealData = data && data.length > 0;
const displayData = hasRealData ? data : (isEditing ? defaultData : []);

// Se não há dados para exibir, não renderiza nada
if (displayData.length === 0) {
  return null;
}
```

#### Indicador Visual no Editor

Quando um bloco está usando dados demo no builder, **DEVE** exibir uma mensagem indicativa:

```tsx
{isUsingDemoData && isEditing && (
  <p className="text-xs text-center text-muted-foreground mt-4">
    [Exemplo demonstrativo] Configure dados reais em <a href="/link">Módulo</a>
  </p>
)}
```

#### Componentes que Seguem esta Regra

| Componente | Arquivo | Verificado |
|------------|---------|------------|
| ReviewsBlock | `src/components/builder/blocks/ReviewsBlock.tsx` | ✅ |
| CrossSellSlotBlock | `src/components/builder/blocks/slots/CrossSellSlotBlock.tsx` | ✅ |
| CompreJuntoSlotBlock | `src/components/builder/blocks/slots/CompreJuntoSlotBlock.tsx` | ✅ |
| UpsellSlotBlock | `src/components/builder/blocks/slots/UpsellSlotBlock.tsx` | ✅ |
| CheckoutTestimonials | `src/components/storefront/checkout/CheckoutTestimonials.tsx` | ✅ |
| PersonalizedProductsBlock | `src/components/builder/blocks/interactive/PersonalizedProductsBlock.tsx` | ✅ |
| FAQBlock | `src/components/builder/blocks/interactive/FAQBlock.tsx` | ✅ |
| ContactFormBlock | `src/components/builder/blocks/interactive/ContactFormBlock.tsx` | ✅ |
| TestimonialsBlock | `src/components/builder/blocks/interactive/TestimonialsBlock.tsx` | ✅ |
| InfoHighlightsBlock | `src/components/builder/blocks/InfoHighlightsBlock.tsx` | ✅ |

#### Fluxo de Publicação (Testimonials e dados com draft/published)

Para dados que seguem fluxo de publicação (como Testimonials):

1. Usar campo `published_at` para controlar visibilidade no público
2. Regra: `is_active = true` + `published_at IS NOT NULL` = visível no storefront
3. Publicar automaticamente quando o template é publicado (via `useTemplateSetSave`)

```typescript
// Hook useStorefrontTestimonials verifica:
// - Se isEditing: mostra todos os ativos
// - Se público: mostra apenas os que têm published_at
```

#### Regra Anti-Vazamento

- **PROIBIDO:** Importar `demoData`/`defaultProducts`/`defaultItems` diretamente em componentes de produção
- **PERMITIDO:** Manter dados demo apenas em:
  - Arquivos `defaults.ts` para templates iniciais
  - Props `defaultProps` do registry
  - Constantes locais no próprio componente, controladas por `isEditing`

---

## Loja Virtual / Builder

### Funções Padrões (globais, independentes de tema)

> **NOTA OBRIGATÓRIA:** Estas regras valem para templates antigos, atuais e futuros. O template muda **apenas** o visual e o conteúdo inicial editável. **Nenhuma regra funcional pode variar por template.**

---

### Páginas Padrão

#### Página Inicial

**Estrutura básica:**

- Para loja iniciada do zero, não precisa ter nada, somente header e footer normal.
- Para templates precisa ter uma estrutura de blocos e seções estratégicas com visual, imagens e produtos fictícios para melhor visualização, mas todos 100% editáveis (ou seja, criado com os blocos do nosso builder).

**Funcionalidades:**

- Nenhuma.

---

#### Categoria

**Estrutura básica:**

- Para templates iniciado do zero, precisa ter apenas o slot visual vazio de onde fica o banner, slots visuais vazios de produtos "simulando" os produtos de uma categoria (se o cliente já tiver produtos cadastrados pode mostrar qualquer produto aleatoriamente somente para fins de preenchimento), filtros de busca avançada+listagem de produtos+ordenação(básico).
- Já para templates, pode ter banner e produtos fictícios para exemplificar o visual do template.

**Funcionalidades:**

- Ativar compra rápida (se ativo ao clicar no botão comprar agora(botão principal) vai direto para o checkout, quando desativado vai para a página do produto)
- Exibir ou ocultar banner (o banner é a primeira seção da página de categoria, e a imagem dele é configurado no menu categorias para cada categoria, se já tiver categorias configuradas com banners, pode mostrar qualquer uma aleatório somente para visualização)
- Exibir ou ocultar avaliações dos produtos (a média das estrelas das avaliações reais dos produtos do menu avaliações, deve aparecer logo abaixo do nome do produto na thumb)
- Exibir ou ocultar botão adicionar ao carrinho da thumb dos produtos (abre carrinho lateral/suspenso se estiver ativo, se não o botão some)
- Alterar nomeclatura do botão de "Comprar agora"(botão principal)
- Opção de mostrar selos ou não (os selos são criados no menu Aumentar ticket)
- Opção de ocultar ou não botão personalizado (texto, cor e link). O botão personalizado deve ficar sempre no meio.
  - Se "Adicionar ao carrinho" estiver ativo: 1º Adicionar ao carrinho, 2º Botão personalizado, 3º "Comprar agora" (sempre por último).
  - Se "Adicionar ao carrinho" estiver desativado: 1º Botão personalizado, 2º "Comprar agora" (sempre por último).

**Regra adicional:**

- Antes de implementar qualquer coisa relacionada a Home/Categoria, verifique o que já existe ou está "meia criado" e complete/reaproveite (não recriar do zero, não duplicar lógica).

---

#### Produto

**Estrutura visual (ordem fixa):**

| Coluna Esquerda | Coluna Direita |
|-----------------|----------------|
| Imagem principal | Selos do produto (Novo, Mais Vendido, Frete Grátis, personalizados) |
| Galeria secundária (até 10 imagens) | Estrelas de avaliação (média real) |
| | Nome do produto |
| | Preços (valor atual, comparativo riscado) |
| | Bandeirinhas de pagamento (PIX com desconto, cartão, boleto, débito) |
| | Descrição curta |
| | Seletor de variantes (se houver) |
| | Informação de estoque |
| | Seletor de quantidade + Botão "Comprar agora" |
| | Botão "Adicionar ao carrinho" |
| | Botão "Comprar pelo WhatsApp" |
| | Calculadora de frete |
| | Destaques adicionais (até 3 banners) |
| | Bandeirinhas de garantia |

**Seções abaixo do produto (ordem fixa):**

1. **Compre Junto** (cross-sell) - configurado no menu Aumentar Ticket
2. **Descrição completa** - texto HTML do cadastro do produto
3. **Avaliações do produto** - reviews reais + formulário para nova avaliação
4. **Produtos relacionados** - grid de produtos relacionados (ÚLTIMO, antes do footer)

**Observação:** Se o cliente não tiver produtos cadastrados, o builder exibe dados de exemplo para visualização. Se tiver, busca um produto real aleatório para exemplificar.

**Funcionalidades (13 toggles + 1 campo de texto + 1 seletor):**

| Toggle | Default | Descrição |
|--------|---------|-----------|
| `showGallery` | true | Exibe/oculta imagens secundárias (principal sempre visível) |
| `showDescription` | true | Exibe/oculta descrição curta (completa sempre visível) |
| `showVariants` | true | Exibe/oculta seletor de variantes |
| `showStock` | true | Exibe/oculta quantidade em estoque |
| `showReviews` | true | Exibe/oculta avaliações e formulário de avaliação |
| `showBuyTogether` | true | Exibe/oculta seção "Compre Junto" |
| `showRelatedProducts` | true | Exibe/oculta grid de produtos relacionados |
| `showWhatsAppButton` | true | Exibe/oculta botão "Comprar pelo WhatsApp" |
| `showAddToCartButton` | true | Exibe/oculta botão "Adicionar ao carrinho" |
| `showBadges` | true | Exibe/oculta selos do produto |
| `showShippingCalculator` | true | Exibe/oculta calculadora de frete |
| `showAdditionalHighlight` | false | Exibe/oculta banners de destaque adicional |
| `showFloatingCart` | true | Exibe/oculta popup de carrinho rápido (canto inferior direito) |

| Campo | Default | Descrição |
|-------|---------|-----------|
| `buyNowButtonText` | "Comprar agora" | Texto personalizável do botão principal |

**Destaques Adicionais (configuração extra):**
- `additionalHighlightImagesMobile`: Array de até 3 URLs de imagens para mobile
- `additionalHighlightImagesDesktop`: Array de até 3 URLs de imagens para desktop

**Ação do Carrinho (configuração unificada):**

| Opção | Valor | Comportamento |
|-------|-------|---------------|
| Carrinho Suspenso | `miniCart` | Adiciona produto e abre drawer lateral do mini-cart |
| Ir para Carrinho | `goToCart` | Adiciona produto e redireciona para `/cart` |
| Desativado | `none` | Adiciona produto, exibe toast "Adicionado" e permanece na página |

**Localização das configurações:** Configurações do tema → Páginas → Página do Produto

**Regras de segurança:**
- Se o produto possui variantes obrigatórias, os botões de compra ficam desabilitados até o cliente selecionar uma opção
- Produto sem estoque (`stock_quantity <= 0` e `allow_backorder = false`) desabilita todos os botões de compra
- No Builder, botões ficam desabilitados (exceto no modo "Interagir")

**Tracking de marketing:**
- `trackViewContent`: Disparado ao carregar a página do produto
- `trackAddToCart`: Disparado ao adicionar produto ao carrinho

---

#### Carrinho

**Estrutura visual:**

| Área | Descrição |
|------|-----------|
| Banner promocional | Banner configurável (desktop/mobile separados) com link opcional |
| Barra de benefício | Barra de progresso para frete grátis ou brinde |
| Lista de itens | Produtos no carrinho com imagem, nome, SKU, preço, quantidade e ações |
| Calculadora de frete | Campo CEP + seleção de opções de envio |
| Campo de cupom | Input para aplicar cupom de desconto |
| Cross-sell | Seção de produtos sugeridos (regras do menu Aumentar Ticket) |
| Resumo do pedido | Subtotal, desconto, frete e total + botão finalizar |
| Barra mobile | Resumo fixo no mobile com total e botão checkout |

**Funcionalidades (toggles configuráveis):**

| Toggle | Default | Descrição |
|--------|---------|-----------|
| `showCrossSell` | true | Exibe seção de cross-sell |
| `showCouponField` | true | Exibe campo de cupom |
| `showShippingCalculator` | true | Exibe calculadora de frete |
| `showTrustBadges` | true | Exibe selos de confiança |
| `showBenefitBar` | true | Exibe barra de progresso de benefício |

**Banner promocional (configuração em Carrinho & Checkout → Carrinho):**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `bannerDesktopEnabled` | boolean | Ativa banner desktop |
| `bannerDesktopUrl` | string | URL da imagem desktop |
| `bannerMobileEnabled` | boolean | Ativa banner mobile |
| `bannerMobileUrl` | string | URL da imagem mobile |
| `bannerLink` | string | URL de destino ao clicar |
| `bannerDisplay` | enum | Onde exibir: `cart_page`, `mini_cart` ou `both` |

**Cross-sell (regras):**

- Produtos sugeridos vêm da tabela `offer_rules` com `type='cross_sell'`
- Produtos já no carrinho são automaticamente filtrados (não aparecem como sugestão)
- Desconto pode ser aplicado: `percent`, `fixed` ou `none`
- Limite configurável de itens exibidos (`max_items`)

**Barra de benefício (configuração em Carrinho & Checkout → Barra de Benefício):**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `enabled` | boolean | Ativa/desativa barra |
| `mode` | enum | `free_shipping` ou `gift` |
| `thresholdValue` | number | Valor mínimo para ganhar benefício |
| `rewardLabel` | string | Texto do benefício (ex: "Frete Grátis") |
| `successLabel` | string | Texto ao atingir meta |
| `progressColor` | string | Cor da barra de progresso |

**Regra crítica de ofertas (REGRA FIXA do Knowledge):**

| Tipo de Oferta | Local Correto |
|----------------|---------------|
| Cross-sell | Carrinho |
| Order Bump | Checkout |
| Compre Junto | Página do Produto |

**Localização das configurações:** Carrinho & Checkout → aba Carrinho

**Carrinho vazio:**
- Exibe mensagem "Seu carrinho está vazio"
- Botão "Continuar comprando" redireciona para home
- Banner promocional ainda é exibido (se configurado)

---

#### Checkout

**Arquivos principais:**

| Arquivo | Função |
|---------|--------|
| `src/pages/storefront/StorefrontCheckout.tsx` | Entrada pública do checkout |
| `src/components/storefront/checkout/CheckoutStepWizard.tsx` | Gerencia etapas (wizard) |
| `src/components/builder/blocks/CheckoutDemoBlock.tsx` | Preview no builder (apenas visual) |

**Estrutura de Etapas (wizard):**

| Etapa | Componente | Função |
|-------|------------|--------|
| 1. Dados | `CheckoutForm.tsx` | CPF, nome, email, telefone |
| 2. Endereço | `CheckoutShipping.tsx` | CEP, rua, número, bairro, cidade, estado |
| 3. Frete | `CheckoutShipping.tsx` | Seleção de opção de envio |
| 4. Pagamento | `PaymentMethodSelector.tsx` | PIX, Boleto, Cartão de Crédito |

**Estrutura visual:**

| Área | Descrição |
|------|-----------|
| Wizard de etapas | Indicador visual das 4 etapas com navegação |
| Formulário principal | Campos da etapa atual |
| Order Bump | Oferta adicional (configurada em Aumentar Ticket) |
| Resumo do pedido | Itens, subtotal, frete, descontos, total |
| Testimonials | Prova social (depoimentos de clientes) |
| Selos de segurança | Badges de confiança e segurança |

**Componentes de UI:**

| Componente | Arquivo | Função |
|------------|---------|--------|
| `CheckoutForm` | `checkout/CheckoutForm.tsx` | Formulário de dados pessoais |
| `CheckoutShipping` | `checkout/CheckoutShipping.tsx` | Endereço e cálculo de frete |
| `PaymentMethodSelector` | `checkout/PaymentMethodSelector.tsx` | Seleção de forma de pagamento |
| `PaymentResult` | `checkout/PaymentResult.tsx` | Exibe resultado/status do pagamento |
| `CheckoutOrderSummary` | `checkout/CheckoutOrderSummary.tsx` | Resumo lateral do pedido |
| `OrderBumpSection` | `checkout/OrderBumpSection.tsx` | Ofertas de order bump |
| `CheckoutTestimonials` | `checkout/CheckoutTestimonials.tsx` | Depoimentos de prova social |

**Hooks de lógica:**

| Hook | Arquivo | Função |
|------|---------|--------|
| `useCheckoutPayment` | `hooks/useCheckoutPayment.ts` | Processamento de pagamento |
| `useCheckoutTestimonials` | `hooks/useCheckoutTestimonials.ts` | CRUD de testimonials |
| `useActiveOfferRules` | `hooks/useOfferRules.ts` | Busca regras de Order Bump |

**Edge Functions (backend):**

| Function | Função |
|----------|--------|
| `checkout-create-order` | Criação atômica do pedido (items, customer, address) |
| `pagarme-create-charge` | Processamento de pagamento via Pagar.me |

**Configurações (store_settings.checkout_config):**

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

**Regras de Testimonials (prova social):**

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

**Regras de Order Bump:**

- Ofertas vêm da tabela `offer_rules` com `type='order_bump'`
- Apenas ofertas ativas (`is_active=true`) são exibidas
- Produtos já no carrinho são filtrados automaticamente
- Desconto pode ser: `percent`, `fixed` ou `none`

**Formas de pagamento suportadas:**

| Método | Gateway | Campos adicionais |
|--------|---------|-------------------|
| PIX | Pagar.me | Exibe QR Code + código copia/cola |
| Boleto | Pagar.me | Exibe código de barras + link PDF |
| Cartão de Crédito | Pagar.me | Número, validade, CVV, parcelas |

**Fluxo de criação de pedido:**

```
1. Validação de dados do formulário
2. Chamada à Edge Function `checkout-create-order`
   → Cria/atualiza customer
   → Cria address
   → Cria order com items_snapshot
   → Cria order_items
3. Chamada à Edge Function `pagarme-create-charge`
   → Processa pagamento no gateway
   → Atualiza order.payment_status
4. Redirecionamento para página de Obrigado
```

**Validações obrigatórias:**

| Campo | Validação |
|-------|-----------|
| CPF | Formato válido (11 dígitos + algoritmo) |
| Email | Formato de email válido |
| Telefone | Mínimo 10 dígitos |
| CEP | 8 dígitos + validação via API |
| Cartão | Luhn algorithm + data de validade futura |

**Regra crítica de ofertas (REGRA FIXA):**

| Tipo de Oferta | Local Correto |
|----------------|---------------|
| Cross-sell | Carrinho |
| **Order Bump** | **Checkout** |
| Compre Junto | Página do Produto |

**Localização das configurações:** Carrinho & Checkout → aba Checkout

---

#### Obrigado

<!-- Placeholder - conteúdo a ser definido -->

---

#### Minha Conta

<!-- Placeholder - conteúdo a ser definido -->

---

#### Pedidos

<!-- Placeholder - conteúdo a ser definido -->

---

#### Pedido

<!-- Placeholder - conteúdo a ser definido -->

---

#### Rastreio

<!-- Placeholder - conteúdo a ser definido -->

---

#### Blog

<!-- Placeholder - conteúdo a ser definido -->

---

## Mídias e Uploads — Regra Canônica

> **REGRA CRÍTICA:** Todos os uploads de arquivos/imagens em qualquer módulo DEVEM seguir este padrão.

### Fluxo de Upload Automático

| Etapa | Descrição |
|-------|-----------|
| **1. Upload direto** | O upload é feito automaticamente para o storage usando `uploadAndRegisterToSystemDrive()` |
| **2. Registro no Drive** | O arquivo é automaticamente registrado na pasta "Uploads do sistema" (files table) |
| **3. URL gerada** | A URL pública é retornada e salva no campo de configuração correspondente |

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Pedir para o usuário "usar o Meu Drive" e colar URL | Fazer upload automático e mostrar a URL gerada |
| Mostrar toast pedindo ação manual do usuário | Mostrar toast de sucesso após upload concluído |
| Ter abas "URL" e "Upload" onde Upload não funciona | Upload funcional que vai direto para o storage |

### Implementação Obrigatória

```typescript
// Em qualquer componente que precisa de upload
import { uploadAndRegisterToSystemDrive } from '@/lib/uploadAndRegisterToSystemDrive';

const result = await uploadAndRegisterToSystemDrive({
  tenantId,
  userId,
  file,
  source: 'identificador_do_modulo', // ex: 'page_banner_cart', 'category_image'
  subPath: 'pasta_no_storage',       // ex: 'banners', 'categories'
});

if (result?.publicUrl) {
  onChange(result.publicUrl); // Atualizar o campo com a URL
}
```

### Indicador "Em Uso" (para Meu Drive)

| Regra | Descrição |
|-------|-----------|
| **Arquivo em uso** | Mostrar badge/sinalização clara que o arquivo está sendo usado por algum módulo |
| **Aviso ao excluir** | Antes de excluir arquivo em uso, mostrar alerta: "Este arquivo está sendo usado em [módulo]. Deseja excluir mesmo assim?" |
| **Arquivo não usado** | Aparece normal, sem sinalização especial |

### Hooks e Utilitários Canônicos

| Arquivo | Uso |
|---------|-----|
| `src/hooks/useSystemUpload.ts` | Hook React para uploads em componentes |
| `src/lib/uploadAndRegisterToSystemDrive.ts` | Função utilitária para upload + registro |
| `src/lib/registerFileToDrive.ts` | Funções auxiliares (ensureSystemFolderAndGetId, fileExistsInDrive) |

---

## Módulos Aprovados (E2E Completo)

> **Status:** ✅ Módulos 100% funcionais e aprovados para produção.

### Lista de Módulos Aprovados

| # | Módulo | Rota | Status |
|---|--------|------|--------|
| 1 | Pedidos | `/orders` | ✅ Ready |
| 2 | Checkout Abandonado | `/abandoned-checkouts` | ✅ Ready |
| 3 | Produtos | `/products` | ✅ Ready |
| 4 | Categorias | `/categories` | ✅ Ready |
| 5 | Clientes | `/customers` | ✅ Ready |
| 6 | Loja Virtual | `/storefront` | ✅ Ready |
| 7 | Menus | `/menus` | ✅ Ready |
| 8 | Aumentar Ticket | `/offers` | ✅ Ready |
| 9 | Avaliações | `/reviews` | ✅ Ready |
| 10 | Meu Drive | `/files` | ✅ Ready |

---

### 1. Pedidos (`/orders`)

#### Visão Geral

Módulo central de gestão de pedidos com listagem, detalhamento, criação manual e acompanhamento de status.

#### Estrutura de Navegação

```
/orders                    → Lista de pedidos
/orders/:id               → Detalhes do pedido
/orders/new               → Criar novo pedido (venda consultiva)
```

#### Listagem de Pedidos

| Componente | Descrição |
|------------|-----------|
| **Stats Cards** | Pendentes, Em processamento, Enviados |
| **Busca** | Por número do pedido, nome do cliente, email |
| **Filtros** | Status do pedido, Status de pagamento, Status de envio, Período |
| **Paginação** | 50 pedidos por página |

#### Filtros Disponíveis

| Filtro | Opções |
|--------|--------|
| **Status do Pedido** | Pendente, Processando, Enviado, Entregue, Cancelado |
| **Status de Pagamento** | Pendente, Pago, Reembolsado, Falhou |
| **Status de Envio** | Pendente, Processando, Enviado, Entregue |
| **Período** | Data inicial, Data final, Campo de data (criação/atualização) |

#### Detalhes do Pedido

| Aba/Seção | Campos |
|-----------|--------|
| **Aba Detalhes** | Itens do pedido, quantidades, preços, subtotal, frete, descontos, total |
| **Aba Notificações** | Histórico de notificações enviadas ao cliente |
| **Painel Cliente** | Nome, email, telefone, CPF, endereço de entrega |
| **Painel Pagamento** | Método, status, gateway, transaction_id |
| **Painel Remessa** | Transportadora, código de rastreio, status, datas |

#### Ações Disponíveis

| Ação | Descrição |
|------|-----------|
| **Atualizar Status** | Alterar status do pedido (dropdown) |
| **Ver Detalhes** | Navegar para página de detalhes |
| **Excluir** | Remover pedido (com confirmação) |
| **Adicionar Rastreio** | Inserir código de rastreamento |
| **Reenviar Notificação** | Reenviar email de status ao cliente |

#### Novo Pedido (Venda Consultiva)

| Etapa | Campos/Ações |
|-------|--------------|
| **Busca de Cliente** | Buscar cliente existente ou criar novo |
| **Busca de Produtos** | Buscar e adicionar produtos ao pedido |
| **Quantidades** | Ajustar quantidade de cada item |
| **Endereço** | Selecionar endereço do cliente ou adicionar novo |
| **Frete Manual** | Definir valor de frete manualmente |
| **Pagamento** | Selecionar método de pagamento |
| **Finalizar** | Criar pedido com status inicial |

#### Backend

| Recurso | Descrição |
|---------|-----------|
| **Edge Function** | `core-orders` (CRUD completo) |
| **Tabelas** | `orders`, `order_items`, `order_history`, `shipments` |
| **Auditoria** | `core_audit_log` registra todas as alterações |

---

### 2. Checkout Abandonado (`/abandoned-checkouts`)

#### Visão Geral

Dashboard de monitoramento e recuperação de checkouts abandonados.

#### Stats Cards

| Card | Descrição |
|------|-----------|
| **Total** | Quantidade total de checkouts no período |
| **Abandonados** | Checkouts marcados como abandonados |
| **Não recuperados** | Abandonados sem conversão |
| **Valor perdido** | Soma do total estimado dos não recuperados |

#### Filtros

| Filtro | Opções |
|--------|--------|
| **Busca** | Por nome, email ou telefone do cliente |
| **Status** | Ativo, Abandonado, Convertido, Recuperado |
| **Região** | Estado/UF do cliente |
| **Período** | Data inicial e final |

#### Detalhes do Checkout (Sheet)

| Seção | Campos |
|-------|--------|
| **Cliente** | Nome, email, telefone, região |
| **Itens** | Produtos no carrinho, quantidades, preços |
| **Timeline** | Iniciado em, Última atividade, Abandonado em, Recuperado em |
| **UTM/Atribuição** | Dados de origem do tráfego |

#### Fluxo de Abandono

```
1. Cliente inicia checkout
2. Sistema captura contato no step 1 (identificação)
3. checkout_sessions.contact_captured_at é preenchido
4. Se inatividade > 30 min → scheduler-tick marca abandoned_at
5. Evento checkout.abandoned é disparado
6. Cliente pode ser recuperado via email/whatsapp
7. Se converter → recovered_at é preenchido
```

#### Backend

| Recurso | Descrição |
|---------|-----------|
| **Tabela** | `checkout_sessions` |
| **Campos-chave** | `status`, `abandoned_at`, `recovered_at`, `contact_captured_at` |
| **Job** | `scheduler-tick` verifica e marca abandonos |

---

### 3. Produtos (`/products`)

#### Visão Geral

Catálogo completo de produtos com suporte a variantes, kits e gestão de estoque.

#### Estrutura de Navegação

```
/products              → Lista de produtos
/products/new          → Criar produto
/products/:id/edit     → Editar produto
```

#### Abas do Formulário

| Aba | Campos |
|-----|--------|
| **Básico** | Nome, Slug, SKU, Descrição curta, Descrição completa, Status (ativo/rascunho) |
| **Imagens** | Galeria de imagens (ordenável), Imagem principal |
| **Preços** | Preço de venda, Preço comparativo (de/por), Custo |
| **Estoque** | Quantidade, Estoque mínimo, Gerenciar estoque (toggle) |
| **Estrutura (Kit)** | Composição de produtos (para kits/combos) |
| **Relacionados** | Produtos relacionados (cross-sell/up-sell) |
| **SEO** | Título SEO, Descrição SEO, URL canônica |
| **Avançado** | NCM, GTIN/EAN, CEST, Origem fiscal, Peso, Dimensões |

#### Tipos de Produto

| Tipo | Descrição |
|------|-----------|
| **Simples** | Produto único, sem variações |
| **Com Variantes** | Até 3 atributos de variação (cor, tamanho, etc.) |
| **Kit/Combo** | Composição de outros produtos |

#### Campos de Variante

| Campo | Descrição |
|-------|-----------|
| **SKU** | Identificador único da variante |
| **Preço** | Preço específico (ou herda do produto pai) |
| **Estoque** | Quantidade da variante |
| **Atributos** | Valores dos atributos (ex: P, M, G / Azul, Vermelho) |

#### Campos Fiscais

| Campo | Descrição |
|-------|-----------|
| **NCM** | Nomenclatura Comum do Mercosul |
| **GTIN/EAN** | Código de barras |
| **CEST** | Código Especificador da Substituição Tributária |
| **Origem** | Nacional, Importado, etc. |

#### Backend

| Recurso | Descrição |
|---------|-----------|
| **Edge Function** | `core-products` (CRUD completo) |
| **Tabelas** | `products`, `product_images`, `product_variants`, `product_components` |
| **Auditoria** | `core_audit_log` registra todas as alterações |

---

### 4. Categorias (`/categories`)

#### Visão Geral

Gestão de categorias do catálogo com suporte a hierarquia e banners.

#### Campos da Categoria

| Campo | Tipo | Descrição |
|-------|------|-----------|
| **Nome** | string | Nome da categoria |
| **Slug** | string | URL amigável (auto-gerado) |
| **Descrição** | text | Descrição da categoria |
| **Imagem** | url | Thumbnail da categoria |
| **Categoria Pai** | ref | Para subcategorias |
| **Ordem** | number | Ordenação na listagem |
| **Ativa** | boolean | Visibilidade no storefront |

#### Banners

| Tipo | Dimensões | Descrição |
|------|-----------|-----------|
| **Desktop** | 1920x400px | Banner para telas grandes |
| **Mobile** | 768x300px | Banner para dispositivos móveis |

#### SEO

| Campo | Descrição |
|-------|-----------|
| **Título SEO** | Título para mecanismos de busca |
| **Descrição SEO** | Meta description |

#### Aba Produtos

| Funcionalidade | Descrição |
|----------------|-----------|
| **Associar** | Vincular produtos à categoria |
| **Desassociar** | Remover vínculo |
| **Ordenar** | Definir ordem dos produtos na categoria |

#### Backend

| Recurso | Descrição |
|---------|-----------|
| **Tabela** | `categories` |
| **Relacionamento** | `product_categories` (N:N com products) |
| **Hierarquia** | `parent_id` para subcategorias |

---

### 5. Clientes (`/customers`)

#### Visão Geral

CRM completo com visão 360º do cliente, endereços e histórico de pedidos.

#### Estrutura de Navegação

```
/customers             → Lista de clientes
/customers/:id         → Detalhes do cliente (visão 360º)
```

#### Listagem

| Componente | Descrição |
|------------|-----------|
| **Busca** | Por nome, email, telefone, CPF |
| **Filtros** | Tags, Data de cadastro |
| **Paginação** | 50 clientes por página |

#### Visão 360º (Detalhes)

| Seção | Campos |
|-------|--------|
| **Dados Pessoais** | Nome, Email, Telefone, CPF, Data de nascimento |
| **Endereços** | Lista de endereços (múltiplos), Endereço padrão |
| **Histórico de Pedidos** | Lista de pedidos do cliente, status, valores |
| **Notas Internas** | Anotações da equipe sobre o cliente |
| **Tags** | Segmentação/etiquetas customizadas |

#### Ações

| Ação | Descrição |
|------|-----------|
| **Editar** | Alterar dados do cliente |
| **Adicionar Endereço** | Novo endereço |
| **Adicionar Nota** | Nova nota interna |
| **Adicionar Tag** | Nova tag de segmentação |
| **Ver Pedido** | Navegar para pedido específico |

#### Backend

| Recurso | Descrição |
|---------|-----------|
| **Edge Function** | `core-customers` (CRUD completo) |
| **Tabelas** | `customers`, `customer_addresses`, `customer_tags`, `customer_notes` |
| **Auditoria** | `core_audit_log` registra todas as alterações |

---

### 6. Loja Virtual (`/storefront`)

#### Visão Geral

Sistema multi-template com editor visual (Builder) para personalização completa do storefront.

#### Estrutura de Navegação

```
/storefront                                    → Entrada (Templates + Configurações)
/storefront/builder?templateId=X&edit=home     → Editor visual
```

#### Abas da Entrada (`/storefront`)

| Aba | Descrição |
|-----|-----------|
| **Templates** | Gerenciamento de temas/templates |
| **Configurações da Loja** | Dados globais do negócio (tenant-wide) |

#### Seção Templates

| Componente | Descrição |
|------------|-----------|
| **Template Ativo** | Destaque do tema em uso na loja |
| **Outros Templates** | Grid de temas disponíveis |
| **CTA "Personalizar loja"** | Abre o Builder do template ativo |

#### Configurações da Loja (tenant-wide)

| Campo | Descrição |
|-------|-----------|
| **Nome da Loja** | Nome do negócio |
| **Logo** | Logo principal |
| **Favicon** | Ícone do navegador |
| **Contato** | Telefone, WhatsApp, Email |
| **Endereço** | Endereço físico |
| **Horário de Atendimento** | Horários de funcionamento |
| **Redes Sociais** | Links das redes sociais |

#### Editor Visual (Builder)

| Componente | Descrição |
|------------|-----------|
| **Menu Esquerdo** | Lista de blocos/seções da página atual |
| **Canvas Central** | Preview editável da página |
| **Painel Direito** | Propriedades do bloco selecionado |
| **Drawer de Blocos** | Catálogo de blocos disponíveis |

#### Configurações do Tema (template-wide)

| Seção | Campos |
|-------|--------|
| **Tipografia** | Fonte principal, Fonte de títulos |
| **Cores** | Primária, Secundária, Fundo, Texto |
| **Cabeçalho** | Layout, Cores, Menus, Busca, Atendimento |
| **Rodapé** | Layout, Colunas, Links, Redes sociais |
| **Mini-Carrinho** | Habilitado/Desabilitado, Auto-abrir |
| **CSS Personalizado** | CSS adicional do tema |

#### Páginas do Builder

| Página | pageType | Descrição |
|--------|----------|-----------|
| **Home** | `home` | Página inicial |
| **Categoria** | `category` | Listagem de produtos |
| **Produto** | `product` | Detalhes do produto |
| **Carrinho** | `cart` | Carrinho de compras |
| **Checkout** | `checkout` | Finalização do pedido |
| **Obrigado** | `thankYou` | Confirmação do pedido |
| **Minha Conta** | `account` | Área do cliente |
| **Pedidos** | `orders` | Lista de pedidos do cliente |
| **Pedido** | `order` | Detalhes de um pedido |
| **Rastreio** | `tracking` | Rastreamento de pedido |
| **Blog** | `blog` | Listagem de posts |

#### Fluxo de Publicação

```
1. Usuário edita no Builder → salva em draft_content
2. Clica em "Publicar" → draft_content copia para published_content
3. store_settings.published_template_id é atualizado
4. store_settings.is_published = true
5. Storefront público passa a usar o novo conteúdo
```

#### Backend

| Recurso | Descrição |
|---------|-----------|
| **Tabela** | `storefront_template_sets` |
| **Campos** | `draft_content`, `published_content`, `theme_settings` |
| **Relacionamento** | `store_settings.published_template_id` |

---

### 7. Menus (`/menus`)

#### Visão Geral

Gerenciamento de menus de navegação do storefront (Header e Footer).

#### Painéis

| Painel | Location | Descrição |
|--------|----------|-----------|
| **Menu Header** | `header` | Menu principal (navegação superior) |
| **Footer 1** | `footer_1` | Primeira coluna do rodapé |
| **Footer 2** | `footer_2` | Segunda coluna do rodapé |

#### Tipos de Item

| Tipo | Descrição |
|------|-----------|
| **Categoria** | Link para categoria do catálogo |
| **Página** | Link para página institucional |
| **Externo** | URL externa (abre em nova aba) |

#### Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| **Adicionar Item** | Criar novo item no menu |
| **Editar Item** | Alterar label, tipo, destino |
| **Excluir Item** | Remover item do menu |
| **Reordenar (DnD)** | Arrastar para reordenar |
| **Criar Submenu** | Arrastar para direita → vira filho |
| **Remover Submenu** | Arrastar para esquerda → volta ao nível raiz |

#### Reflexo no Storefront

| Menu | Local no Storefront |
|------|---------------------|
| **Header** | Barra secundária do cabeçalho (linha 2) |
| **Footer 1** | Primeira coluna de links do rodapé |
| **Footer 2** | Segunda coluna de links do rodapé |

#### Backend

| Recurso | Descrição |
|---------|-----------|
| **Tabelas** | `menus`, `menu_items` |
| **Campos menu** | `name`, `location`, `tenant_id` |
| **Campos item** | `label`, `item_type`, `ref_id`, `url`, `parent_id`, `sort_order` |

---

### 8. Aumentar Ticket (`/offers`)

#### Visão Geral

Regras de ofertas para aumentar o ticket médio: Cross-sell, Order Bump, Upsell e Compre Junto.

#### Abas

| Aba | Descrição |
|-----|-----------|
| **Ofertas** | Lista e gestão das regras de oferta |
| **Selos** | Selos/badges para produtos |
| **Variações** | Variações globais (cores, tamanhos, etc.) |

#### Tipos de Oferta

| Tipo | Local de Exibição | Descrição |
|------|-------------------|-----------|
| **Cross-sell** | Carrinho | Sugestões de produtos no carrinho |
| **Order Bump** | Checkout | Adicional com 1-click no checkout |
| **Upsell** | Página de Obrigado | Oferta pós-compra |
| **Compre Junto** | Página do Produto | Combo de produtos relacionados |

#### Campos da Regra

| Campo | Descrição |
|-------|-----------|
| **Título** | Nome interno da regra |
| **Tipo** | Cross-sell, Order Bump, Upsell, Compre Junto |
| **Prioridade** | Ordem de exibição (maior = primeiro) |
| **Ativo** | Liga/desliga a regra |
| **Produtos Gatilho** | Produtos que ativam a regra |
| **Produtos Sugeridos** | Produtos oferecidos |
| **Desconto** | Tipo (%, R$) e valor do desconto |
| **Valor Mínimo** | Valor mínimo do carrinho para ativar |
| **Tipo de Cliente** | Novo, Recorrente, Todos |

#### Selos de Produto

| Campo | Descrição |
|-------|-----------|
| **Nome** | Texto do selo (ex: "Mais Vendido", "Novo") |
| **Cor** | Cor de fundo do selo |
| **Produtos** | Produtos que recebem o selo |

#### Backend

| Recurso | Descrição |
|---------|-----------|
| **Tabela** | `offer_rules` |
| **Campos** | `type`, `priority`, `trigger_products`, `suggested_products`, `discount_type`, `discount_value`, `min_cart_value`, `customer_type` |

---

### 9. Avaliações (`/reviews`)

#### Visão Geral

Moderação de avaliações de produtos enviadas pelos clientes no storefront.

#### Stats Cards

| Card | Descrição |
|------|-----------|
| **Total** | Quantidade total de avaliações |
| **Pendentes** | Aguardando moderação |
| **Aprovadas** | Publicadas no storefront |
| **Rejeitadas** | Recusadas pela moderação |

#### Abas de Status

| Aba | Descrição |
|-----|-----------|
| **Todas** | Todas as avaliações |
| **Pendentes** | Aguardando moderação |
| **Aprovadas** | Visíveis no storefront |
| **Rejeitadas** | Recusadas |

#### Filtros

| Filtro | Descrição |
|--------|-----------|
| **Busca** | Por nome do cliente ou conteúdo |
| **Produto** | Filtrar por produto específico |
| **Estrelas** | Filtrar por quantidade de estrelas |

#### Campos da Avaliação

| Campo | Descrição |
|-------|-----------|
| **Produto** | Produto avaliado |
| **Cliente** | Nome do avaliador |
| **Estrelas** | 1 a 5 estrelas |
| **Título** | Título da avaliação |
| **Comentário** | Texto da avaliação |
| **Data** | Data de envio |
| **Status** | Pendente, Aprovada, Rejeitada |

#### Ações

| Ação | Descrição |
|------|-----------|
| **Aprovar** | Publicar no storefront |
| **Rejeitar** | Recusar a avaliação |
| **Excluir** | Remover definitivamente |

#### Fluxo

```
1. Cliente envia avaliação no storefront
2. Status inicial = pending
3. Moderador revisa na área admin
4. Aprova → status = approved → visível no storefront
5. Rejeita → status = rejected → não visível
```

#### Backend

| Recurso | Descrição |
|---------|-----------|
| **Tabela** | `product_reviews` |
| **Campos** | `product_id`, `customer_name`, `rating`, `title`, `content`, `status`, `created_at` |
| **RLS** | Storefront só vê `status = 'approved'` |

---

### 10. Meu Drive (`/files`)

#### Visão Geral

Gerenciador de arquivos e mídias do tenant, similar a um file explorer.

#### Interface

| Componente | Descrição |
|------------|-----------|
| **Breadcrumb** | Navegação por pastas |
| **Grid/Lista** | Visualização de arquivos e pastas |
| **Preview** | Preview de imagens/arquivos selecionados |

#### Pasta do Sistema

| Regra | Descrição |
|-------|-----------|
| **"Uploads do sistema"** | Pasta obrigatória, não pode ser excluída/renomeada |
| **Arquivos do sistema** | Não podem sair da árvore do sistema |
| **is_system_folder** | Flag que identifica pasta do sistema |

#### Ações

| Ação | Descrição |
|------|-----------|
| **Upload** | Enviar novos arquivos |
| **Criar Pasta** | Nova pasta |
| **Renomear** | Alterar nome de arquivo/pasta |
| **Mover** | Mover para outra pasta |
| **Excluir** | Remover arquivo/pasta |
| **Copiar URL** | Copiar URL pública |

#### Badge "Em Uso"

| Regra | Descrição |
|-------|-----------|
| **Detecção** | Sistema detecta se arquivo está referenciado em algum módulo |
| **Badge** | Arquivo em uso exibe indicador visual |
| **Aviso ao excluir** | Confirmação extra ao excluir arquivo em uso |

#### Integração com Outros Módulos

| Componente | Uso |
|------------|-----|
| **MediaLibraryPicker** | Seletor de mídia do Drive em formulários |
| **uploadAndRegisterToSystemDrive()** | Upload automático + registro |

#### Backend

| Recurso | Descrição |
|---------|-----------|
| **Tabela** | `files` |
| **Campos** | `name`, `path`, `folder_id`, `is_system_folder`, `metadata`, `tenant_id` |
| **Storage** | Bucket `tenant-files` |

---

## Regras de Proteção dos Módulos Aprovados

> **REGRA CRÍTICA:** Módulos aprovados estão protegidos. Qualquer alteração estrutural requer aprovação explícita do usuário.

### Proibições

| ❌ Proibido | Motivo |
|-------------|--------|
| Remover campos existentes | Quebra funcionalidade em produção |
| Alterar estrutura de tabelas | Pode causar perda de dados |
| Modificar fluxos de negócio | Quebra expectativa do usuário |
| Alterar comportamento de RLS | Pode expor dados sensíveis |

### Permitido (sem aprovação)

| ✅ Permitido | Exemplo |
|--------------|---------|
| Correção de bugs | Fix de erro de tipagem |
| Melhorias de UI | Ajuste de espaçamento |
| Otimização de performance | Memoização de componentes |
| Adição de features complementares | Novo filtro na listagem |

### Protocolo para Alterações Estruturais

1. Identificar a necessidade de alteração
2. Reportar ao usuário com justificativa
3. Aguardar aprovação explícita
4. Implementar com auditoria
5. Documentar a alteração neste arquivo
