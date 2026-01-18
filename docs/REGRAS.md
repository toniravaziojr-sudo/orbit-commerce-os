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
