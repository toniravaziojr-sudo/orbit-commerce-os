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
| `showRelatedProducts` | boolean | true | Exibe grid de produtos relacionados |
| `showBuyTogether` | boolean | true | Exibe seção "Compre Junto" |
| `showReviews` | boolean | true | Exibe avaliações e formulário |
| `showAddToCartButton` | boolean | true | Exibe botão adicionar ao carrinho |
| `showWhatsAppButton` | boolean | true | Exibe botão comprar pelo WhatsApp |
| `buyNowButtonText` | string | "Comprar agora" | Texto do botão principal |
| `openMiniCartOnAdd` | boolean | true | Abre mini-cart ao adicionar |

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

**Estrutura básica:**

- Slot para imagem principal, slots menores para imagens secundárias até máximo 10 imagens, slots para selos, abaixo dele as 5 estrelas de referência das avaliações, abaixo das estrelas o nome do produto, abaixo do nome os valores, abaixo do valor destaque de pagamento ("bandeirinhas" com as formas de pagamento com destaque para pix com desconto), abaixo vem a descrição curta do produto, abaixo vem as opções de variações (se tiver ativa), depois botão para adicionar quantidade, ao lado o botão principal "Comprar agora", abaixo o botão de adicionar ao carrinho, abaixo o botão de comprar pelo whatsapp, abaixo a calculadora de frete, abaixo "bandeirinhas editáveis" para colocar informações de garantia, etc, abaixo vem o Compre junto (se estiver ativo), depois vem a parte da descrição completa, depois as avaliações do produto, depois os produtos relacionados.

**Observação:** As informações dos produtos são puxadas do cadastro dos produtos, se o cliente não tiver produtos no cadastro, no builder vamos apenas exemplificar com "exemple name" valor simbolico, etc, somente para uma visalização do cliente de como vai ficar a página dos produtos dele, se ele tiver produtos cadastrados o sistema busca um produto real do cliente aleatório para exemplificar. Mesma lógica da página de categoria.

**Funcionalidades:**

- Mostrar galeria (mostra ou esconde as imagens secundárias do cadastro do produto, a imagem principal nunca some)
- Mostrar descrição (mostra ou esconde a descrição curta dos produtos, nunca esconde a descrição completa, a descrição curta é puxada do cadastro dos produtos)
- Mostrar ou não as variantes (variações do produto, como cor, tamanho, etc, são puxadas do cadastro do produto)
- Mostrar ou não o estoque (puxado do cadastro do produto)
- Mostrar ou esconder produtos relacionados (grid de produtos relacionados também é cadastrada no cadastro dos produtos)
- Mostrar ou esconder Compre junto (Configurado no menu Aumentar ticket)
- Mostrar ou esconder avaliações (se desativada esconde todas as avaliações, inclusive o input para o cliente fazer uma avaliação)
- Ativar ou desativar função de carrinho suspenso na página do produto (ao ativada se o cliente clicar no botão adicionar ao carrinho abre o carrinho suspenso, quando desativada simplesmente adiciona o produto ao carrinho e permanece na página do produto e o botão Adicionar ao carrinho fica bloqueado e muda para "Adicionado")
- Ativar ou desativar Carrinho rápido (quando ativo funciona assim, se o cliente já tiver algum produto adicionado ao carrinho aparece um popup pequeno no canto inferior direito no formato do carrinho da loja e mostrando a quantidade de itens adicionados, se o cliente clicar ele vai para a página do carrinho com os produtos adicionados, quando a função está desativada não aparece esse popup)
- Mostrar ou esconder botão "Comprar pelo whatsapp"
- Mostrar ou esconder botão Adicionar ao carrinho
- Campo personalizado para editar o nome do botão principal "Comprar agora"

---

#### Carrinho

<!-- Placeholder - conteúdo a ser definido -->

---

#### Checkout

<!-- Placeholder - conteúdo a ser definido -->

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
