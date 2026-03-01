# Builder — Regras e Especificações

> **Status:** CONCLUÍDO E PROTEGIDO ✅ — Qualquer alteração estrutural requer aprovação do usuário.

---

## 🎯 WYSIWYG Unificado (Regra Principal)

O Storefront Builder opera em **um único modo**: o próprio editor É o preview/teste. Não existem modos separados.

### Princípio Fundamental

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BUILDER = PREVIEW = TESTE                             │
├─────────────────────────────────────────────────────────────────────────┤
│  • Não existem modos "Editar", "Preview" ou "Testar"                    │
│  • O canvas reflete alterações em tempo real durante a edição           │
│  • Interações funcionais (hover, cliques) estão habilitadas por padrão  │
│  • O usuário vê exatamente o que o cliente final verá                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Arquitetura de Eventos

Para permitir que hovers e interações funcionem durante a edição, o `BlockRenderer.tsx` utiliza `onMouseDown` (não `onClick`) para seleção de blocos:

```tsx
// ✅ CORRETO - onMouseDown permite :hover funcionar
<div onMouseDown={handleMouseDown}>
  <Button className="sf-btn-primary"> // Recebe :hover normalmente
</div>

// ❌ ERRADO - onClick bloqueia :hover durante bubble
<div onClick={handleClick}>
  <Button className="sf-btn-primary">
</div>
```

### Seleção de Blocos Aninhados (REGRA CRÍTICA)

Para garantir que blocos aninhados (como Header/Footer dentro de Page) sejam selecionados corretamente, o `handleMouseDown` DEVE incluir `stopPropagation()`:

```tsx
const handleMouseDown = (e: React.MouseEvent) => {
  if (!isEditing || !onSelect) return;
  
  // CRITICAL: Stop propagation to prevent parent blocks from stealing selection
  // Sem isso, clicar no Header do Checkout seleciona o bloco Page (pai)
  e.stopPropagation();
  
  // ... resto da lógica
};
```

| Sem stopPropagation | Com stopPropagation |
|---------------------|---------------------|
| Clique no Header → seleciona Page (pai) | Clique no Header → seleciona Header ✓ |
| Painel de props fica vazio | Painel de props exibe configurações do Header ✓ |

### Regras de Interatividade

| Componente | Comportamento no Builder |
|------------|--------------------------|
| Botões com `sf-btn-*` | Hover effects funcionam (CSS injetado) |
| Links internos | Navegação bloqueada, hover funciona |
| Cards de produto | Hover effects funcionam, clique seleciona bloco |
| Inputs/Forms | Interação real habilitada |
| Carrossel | Navegação funcional |

### Proibições

| Proibido | Motivo |
|----------|--------|
| Criar "Modo Preview" separado | Viola princípio WYSIWYG unificado |
| Criar "Modo Testar" separado | Viola princípio WYSIWYG unificado |
| Usar `pointer-events-none` em wrappers de bloco | Bloqueia hover effects |
| Usar `onClick` para seleção de blocos | Interfere com bubble de eventos CSS |

### Arquivos Relacionados

| Arquivo | Responsabilidade |
|---------|------------------|
| `BlockRenderer.tsx` | Wrapper com `onMouseDown` + overlay non-blocking |
| `useBuilderThemeInjector.ts` | Injeção de CSS de hover em `.storefront-container` |
| `ProductCard.tsx` | Card sem `pointer-events-none` para permitir hovers |
| `ProductCTAs.tsx` | Botões funcionais mesmo em modo edição |

---

## Botões de Visualização no Toolbar (Regra Estrutural)

O toolbar do builder possui dois botões distintos para visualização:

### Botão "Preview" (Eye icon)

- **Visibilidade:** Sempre visível
- **Função:** Abre a loja em nova aba com `?preview=1`
- **Comportamento:** Exibe conteúdo **DRAFT** (não publicado) da loja
- **Ícone:** `Eye`
- **Uso:** Permite ao lojista visualizar como a loja ficará ANTES de publicar

### Botão "Ver loja" (Globe icon)

- **Visibilidade:** Somente quando `is_published = true` em `store_settings`
- **Função:** Abre a loja pública em nova aba (sem `?preview`)
- **Comportamento:** Exibe conteúdo **PUBLICADO** da loja
- **Ícone:** `Globe`
- **Uso:** Permite ao lojista ver a loja como os clientes a veem

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BOTÕES DE VISUALIZAÇÃO                               │
├─────────────────────────────────────────────────────────────────────────┤
│  [Preview]     → primaryOrigin + previewUrl + ?preview=1               │
│  [Ver loja]    → primaryOrigin + previewUrl (sem parâmetro)            │
│                                                                          │
│  isPublished = false → apenas [Preview] visível                         │
│  isPublished = true  → [Preview] + [Ver loja] visíveis                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Arquivos Relacionados

| Arquivo | Responsabilidade |
|---------|------------------|
| `BuilderToolbar.tsx` | Renderiza os botões Preview e Ver loja |
| `VisualBuilder.tsx` | Busca `is_published` e passa para toolbar |
| `usePrimaryPublicHost.ts` | Resolve URL pública correta (domínio custom ou plataforma) |

---

## Sistema de Estrutura Padrão (Bloco Agrupado)

> **Implementado em:** 2025-01-30

O menu lateral do builder agrupa todos os blocos essenciais de cada página em um único item visual chamado **"Estrutura Padrão"** (ou nome específico da página, ex: "Estrutura do Produto").

### Princípio Fundamental

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  ESTRUTURA PADRÃO vs BLOCOS PERSONALIZADOS               │
├─────────────────────────────────────────────────────────────────────────┤
│  ESTRUTURA PADRÃO (agrupada):                                            │
│  • Contém blocos essenciais da página (ProductDetails, ProductGrid, etc) │
│  • Pode ser MOVIDA (reposicionada em relação a blocos personalizados)   │
│  • NÃO abre painel de propriedades ao clicar                            │
│  • NÃO pode ser excluída                                                │
│  • Configurações em "Tema → Páginas"                                    │
│                                                                          │
│  BLOCOS PERSONALIZADOS:                                                  │
│  • Adicionados via "+ Adicionar seção"                                  │
│  • Podem ser movidos livremente                                         │
│  • Podem ser editados (abre painel de propriedades)                     │
│  • Podem ser excluídos                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Blocos Agrupados por Página

| Página | Nome do Grupo | Blocos Incluídos |
|--------|---------------|------------------|
| Produto | Estrutura do Produto | `ProductDetails`, `CompreJuntoSlot` |
| Categoria | Estrutura da Categoria | `CategoryBanner`, `ProductGrid`, `CategoryPageLayout` |
| Carrinho | Estrutura do Carrinho | `Cart` |
| Checkout | Estrutura do Checkout | `Checkout` |
| Obrigado | Confirmação do Pedido | `ThankYou` |
| Conta | Área do Cliente | `AccountHub` |
| Pedidos | Meus Pedidos | `OrdersList` |
| Detalhes Pedido | Detalhes do Pedido | `OrderDetail` |

### Comportamento no BuilderSidebar

```tsx
// ❌ ANTES - Cada bloco aparecia individualmente (confuso para usuários)
[ProductDetails]   ← não pode editar via painel
[Banner Hero]      ← pode editar
[Produtos Relacionados] ← não pode excluir

// ✅ DEPOIS - Agrupamento visual claro
[📦 Estrutura do Produto]  ← arraste para reposicionar, configurações em Tema > Páginas
  └─ ProductDetails
  └─ CompreJuntoSlot
[Banner Hero]              ← pode editar, mover, excluir
[Produtos Relacionados]    ← pode editar, mover
```

### Constantes de Configuração

```tsx
// Blocos de infraestrutura (nunca aparecem no menu)
const INFRASTRUCTURE_BLOCKS = new Set(['Header', 'Footer', 'Page', 'Section']);

// Blocos de sistema (agrupados em "Estrutura Padrão")
const SYSTEM_BLOCKS = new Set([
  'CategoryBanner', 'ProductGrid', 'CategoryPageLayout',
  'ProductDetails', 'CompreJuntoSlot',
  'Cart', 'Checkout', 'ThankYou',
  'CrossSellSlot', 'UpsellSlot',
  'AccountHub', 'OrdersList', 'OrderDetail',
  'TrackingLookup', 'BlogListing',
]);
```

### Regras Obrigatórias

1. **NUNCA** permitir exclusão de blocos agrupados em "Estrutura Padrão"
2. **NUNCA** abrir painel de propriedades ao clicar em "Estrutura Padrão" — configurações ficam em "Tema → Páginas"
3. **SEMPRE** permitir arrastar "Estrutura Padrão" para reposicionar em relação a blocos personalizados
4. **SEMPRE** exibir contagem de blocos no badge (ex: `[3]`)
5. **SEMPRE** permitir expandir/colapsar para ver quais blocos estão incluídos

### Arquivos Relacionados

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/components/builder/BuilderSidebar.tsx` | Menu lateral com "Estrutura Padrão" |
| `src/components/builder/BlockTree.tsx` | Árvore hierárquica (alternativa) |
| `src/lib/builder/essentialBlocks.ts` | Definição de blocos essenciais por página |
| `src/lib/builder/pageContracts.ts` | Contratos de páginas (blocos obrigatórios) |

---


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
│  • HeaderBlock/FooterBlock: auto-suficientes (fetching próprio do DB)   │
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

---

## Sistema de Tipografia Global

A tipografia da loja é gerenciada **exclusivamente** em **Configuração do tema > Tipografia** (`TypographySettings.tsx`).

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    THEME SETTINGS (draft_content)                        │
│  Arquivo: storefront_template_sets.draft_content.themeSettings          │
├─────────────────────────────────────────────────────────────────────────┤
│  typography: {                                                           │
│    headingFont: string,      ← Fonte dos títulos (H1-H6)               │
│    bodyFont: string,         ← Fonte do corpo (p, span, button, etc)   │
│    baseFontSize: number,     ← Tamanho base em px (12-20)              │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    FONT FAMILY MAP                                       │
│  Arquivo: src/hooks/usePublicThemeSettings.ts                           │
├─────────────────────────────────────────────────────────────────────────┤
│  FONT_FAMILY_MAP = {                                                     │
│    'inter': "'Inter', sans-serif",                                       │
│    'playfair': "'Playfair Display', serif",                              │
│    'bebas-neue': "'Bebas Neue', sans-serif",                             │
│    ...                                                                   │
│  }                                                                       │
│  Mapeia chave de fonte → CSS font-family                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    CSS INJECTION                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  STOREFRONT PÚBLICO:                                                     │
│  StorefrontThemeInjector.tsx                                             │
│  → Injeta <style> no <head> com CSS para .storefront-container          │
│  → Injeta variáveis CSS de tipografia E cores do tema                   │
│                                                                          │
│  BUILDER PREVIEW:                                                        │
│  useBuilderThemeInjector.ts                                              │
│  → Injeta <style> no <head> para preview em tempo real                  │
│  → Inclui AMBOS: tipografia (--sf-*) E cores (--theme-button-*)          │
│  → Aplica classes .sf-btn-primary e .sf-btn-secondary                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### CSS Variables Geradas

#### Tipografia
| Variável | Descrição |
|----------|-----------|
| `--sf-heading-font` | font-family para H1-H6 |
| `--sf-body-font` | font-family para p, span, button, input, etc |
| `--sf-base-font-size` | Tamanho base em px |

#### Cores do Tema (Injetadas por AMBOS os injetores)
| Variável | Descrição |
|----------|-----------|
| `--theme-button-primary-bg` | Background de botões primários |
| `--theme-button-primary-text` | Texto de botões primários |
| `--theme-button-secondary-bg` | Background de botões secundários |
| `--theme-button-secondary-text` | Texto de botões secundários |
| `--theme-text-primary` | Cor de texto principal |
| `--theme-text-secondary` | Cor de texto secundário |
| `--theme-price-color` | Cor do valor principal (preço com desconto) |

### Seletores Aplicados

```css
/* Container principal */
.storefront-container {
  font-family: var(--sf-body-font);
  font-size: var(--sf-base-font-size);
}

/* Títulos */
.storefront-container h1, h2, h3, h4, h5, h6 {
  font-family: var(--sf-heading-font);
}

/* Corpo e elementos de UI */
.storefront-container p, span, a, button, input, textarea, select, label, li {
  font-family: var(--sf-body-font);
}
```

### Fontes Disponíveis

| Categoria | Fontes |
|-----------|--------|
| **Sans-serif** | Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Raleway, Source Sans Pro, Ubuntu, Mulish, Work Sans, Quicksand, DM Sans, Manrope, Outfit, Plus Jakarta Sans |
| **Serif** | Playfair Display, Merriweather, Lora, PT Serif, Crimson Text, Libre Baskerville, Cormorant Garamond, EB Garamond, Bitter |
| **Display** | Abril Fatface, Bebas Neue, Oswald, Josefin Sans, Righteous |

### Arquivos Relacionados

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/hooks/useThemeSettings.ts` | CRUD de themeSettings no draft_content |
| `src/hooks/usePublicThemeSettings.ts` | Leitura de published_content + FONT_FAMILY_MAP |
| `src/hooks/useBuilderThemeInjector.ts` | Injeção CSS no builder preview |
| `src/components/storefront/StorefrontThemeInjector.tsx` | Injeção CSS no storefront público |
| `src/components/builder/theme-settings/TypographySettings.tsx` | UI de configuração |

### Regras Obrigatórias

1. **NUNCA** adicionar configurações de fonte em outros lugares além de `themeSettings.typography`
2. **SEMPRE** usar `getFontFamily()` para converter chave → CSS font-family
3. **SEMPRE** incluir `StorefrontThemeInjector` no layout público
4. **SEMPRE** usar `useBuilderThemeInjector` no builder para preview em tempo real
5. A tipografia se aplica a **TODOS** os blocos (padrões e personalizados) via CSS global

---

## Sistema de Cores Global e Injeção de Tema

As cores do tema são gerenciadas **exclusivamente** em **Configuração do tema > Cores** (`ColorSettings.tsx`) e **injetadas dinamicamente** via CSS no storefront.

### ⚠️ REGRA CRÍTICA: Override de `--primary` do Tailwind

O sistema **SOBRESCREVE** a variável `--primary` do Tailwind dentro dos escopos `.storefront-container` e `.builder-preview-canvas` para garantir que as cores do tema sejam aplicadas corretamente.

```css
/* INJETADO DINAMICAMENTE pelos theme injectors */
.storefront-container,
.builder-preview-canvas {
  --primary: [HSL do tema convertido de hex];
  --primary-foreground: [HSL do tema convertido de hex];
}
```

**Por que isso é necessário:**
- O Tailwind usa `hsl(var(--primary))` para classes como `bg-primary`, `text-primary`, `border-primary`
- Sem esse override, essas classes usariam o valor padrão do `index.css` (indigo/azul)
- Com o override, todas as classes `*-primary` respeitam as cores definidas em "Configurações do Tema"

### Injeção de Cores (StorefrontThemeInjector)

O sistema injeta variáveis CSS e classes para botões diretamente no `<head>` do documento, garantindo que as cores do tema sejam aplicadas em toda a loja.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLOW DE INJEÇÃO DE CORES                              │
├─────────────────────────────────────────────────────────────────────────┤
│  1. storefront_template_sets.published_content.themeSettings.colors     │
│     ↓                                                                    │
│  2. usePublicThemeSettings(tenantSlug)                                   │
│     ↓                                                                    │
│  3. getStorefrontThemeCss(themeSettings) + hexToHslValues()              │
│     ↓                                                                    │
│  4. StorefrontThemeInjector → <style id="storefront-theme-styles">      │
│     ↓                                                                    │
│  5. CSS Variables + Classes + OVERRIDE de --primary aplicados           │
└─────────────────────────────────────────────────────────────────────────┘
```

### CSS Variables de Cores Injetadas

O sistema organiza as cores em **5 grupos** para facilitar a configuração:

#### 🔵 Botão Primário
| Variável | Origem | Uso |
|----------|--------|-----|
| `--primary` | `colors.buttonPrimaryBg` (convertido para HSL) | **OVERRIDE** da variável Tailwind |
| `--primary-foreground` | `colors.buttonPrimaryText` (convertido para HSL) | **OVERRIDE** da variável Tailwind |
| `--theme-button-primary-bg` | `colors.buttonPrimaryBg` | Background de botões primários |
| `--theme-button-primary-text` | `colors.buttonPrimaryText` | Texto de botões primários |

#### ⚪ Botão Secundário
| Variável | Origem | Uso |
|----------|--------|-----|
| `--theme-button-secondary-bg` | `colors.buttonSecondaryBg` | Background de botões secundários |
| `--theme-button-secondary-text` | `colors.buttonSecondaryText` | Texto de botões secundários |

#### 💬 Botão WhatsApp
| Variável | Origem | Uso |
|----------|--------|-----|
| `--theme-whatsapp-color` | `colors.whatsappColor` | Cor do texto/borda do botão WhatsApp (padrão: `#25D366`) |
| `--theme-whatsapp-hover` | `colors.whatsappHover` | Cor de fundo no hover do botão WhatsApp (padrão: `#128C7E`) |

#### 📝 Texto e Destaque
| Variável | Origem | Uso |
|----------|--------|-----|
| `--theme-text-primary` | `colors.textPrimary` | Cor de texto principal |
| `--theme-text-secondary` | `colors.textSecondary` | Cor de texto secundário |
| `--theme-accent-color` | `colors.accentColor` | Cor de destaque (preços PIX, selos, etc.) |

#### 💰 Valor Principal
| Variável | Origem | Uso |
|----------|--------|-----|
| `--theme-price-color` | `colors.priceColor` | Cor exclusiva do valor principal (preço com desconto). Fallback: `--theme-text-primary` → `currentColor` |

> **Nota:** Essa variável é aplicada via inline style `color: var(--theme-price-color, ...)` em todos os componentes que exibem o preço final: `ProductCard.tsx`, `CollectionSectionBlock.tsx`, `BlockRenderer.tsx` (ProductDetail), `BuyTogetherSection.tsx`, `CompreJuntoSlotBlock.tsx`, `RelatedProductsSection.tsx`.

#### 🏷️ Tags Especiais
| Variável | Origem | Uso |
|----------|--------|-----|
| `--theme-promo-bg` | `colors.promoBg` | Background de tags promocionais |
| `--theme-promo-text` | `colors.promoText` | Texto de tags promocionais |

### Classes CSS Injetadas (com !important)

```css
/* Botão Primário Sólido - !important para sobrescrever Tailwind */
.storefront-container .sf-btn-primary {
  background-color: var(--theme-button-primary-bg, #1a1a1a) !important;
  color: var(--theme-button-primary-text, #ffffff) !important;
}
.storefront-container .sf-btn-primary:hover {
  background-color: var(--theme-button-primary-hover) !important;
  transform: translateY(-1px) !important;
}

/* Botão Primário Outline - Hover preenche com cor primária */
.storefront-container .sf-btn-outline-primary {
  background-color: transparent !important;
  color: var(--theme-button-primary-bg, #1a1a1a) !important;
  border: 1px solid var(--theme-button-primary-bg, #1a1a1a) !important;
}
.storefront-container .sf-btn-outline-primary:hover {
  background-color: var(--theme-button-primary-bg, #1a1a1a) !important;
  color: var(--theme-button-primary-text, #ffffff) !important;
  transform: translateY(-1px) !important;
}

/* Botão Secundário Sólido */
.storefront-container .sf-btn-secondary {
  background-color: var(--theme-button-secondary-bg, #f5f5f5) !important;
  color: var(--theme-button-secondary-text, #1a1a1a) !important;
}
.storefront-container .sf-btn-secondary:hover {
  background-color: var(--theme-button-secondary-hover) !important;
  transform: translateY(-1px) !important;
}

/* Botão Secundário Outline */
.storefront-container .sf-btn-outline-secondary {
  background-color: transparent !important;
  color: var(--theme-button-secondary-text, #1a1a1a) !important;
  border: 1px solid var(--theme-button-secondary-bg, #e5e5e5) !important;
}
.storefront-container .sf-btn-outline-secondary:hover {
  background-color: var(--theme-button-secondary-bg, #e5e5e5) !important;
  transform: translateY(-1px) !important;
}
```

### Fallbacks Neutros (NÃO AZUL)

| Contexto | Fallback Antigo | Fallback Atual |
|----------|-----------------|----------------|
| Botão primário BG | `#3b82f6` (azul) | `#1a1a1a` (preto) |
| Botão primário texto | `#ffffff` | `#ffffff` |
| Botão secundário BG | `#e5e7eb` | `#f5f5f5` |
| Botão secundário texto | `#1f2937` | `#1a1a1a` |

### Uso das Classes sf-btn-*

| Componente | Classe | Arquivo |
|------------|--------|---------|
| Botão "Finalizar" do carrinho | `sf-btn-primary` | `CartSummary.tsx` |
| Botões de navegação do checkout | `sf-btn-primary` | `CheckoutStepWizard.tsx` |
| Botão "Visualizar Boleto" | `sf-btn-primary` | `PaymentResult.tsx` |
| Botões CTA em blocos do builder | `sf-btn-primary` | Blocos individuais |
| ProductCard "Comprar agora" | `sf-btn-primary` | `ProductCard.tsx` |
| ProductCard "Adicionar" | `sf-btn-outline-primary` | `ProductCard.tsx` |
| ProductCTAs "Comprar agora" | `sf-btn-primary` | `ProductCTAs.tsx` |

### Arquivos Relacionados

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/hooks/usePublicThemeSettings.ts` | Hook + `getStorefrontThemeCss()` + `hexToHslValues()` |
| `src/components/storefront/StorefrontThemeInjector.tsx` | Injeção no DOM público |
| `src/hooks/useBuilderThemeInjector.ts` | Preview no builder + override de --primary |

### ❌ Proibições Absolutas

| Proibido | Motivo |
|----------|--------|
| Usar `bg-primary` sem `.sf-btn-primary` em botões do storefront | Pode não ter override aplicado |
| Hardcodar cores hex (`#3b82f6`, `#6366f1`) em componentes | Ignora tema do cliente |
| Usar fallbacks azuis em qualquer lugar | Confunde usuários |
| Criar estilos inline com cores fixas em blocos | Quebra herança do tema |

---

## Hierarquia de Aplicação de Cores

As cores do tema são gerenciadas **exclusivamente** em **Configuração do tema > Cores** (`ColorSettings.tsx`).

### Hierarquia de Aplicação

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HIERARQUIA DE ESTILOS                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  1. GLOBAL (menor prioridade)                                            │
│     - Variáveis CSS: --primary, --secondary, --background, etc.         │
│     - Classes Tailwind: text-foreground, bg-primary, text-muted-foreground│
│     - Aplicadas via index.css e tailwind.config.ts                      │
│                                                                          │
│  2. LOCAL (maior prioridade - sobrescreve global)                        │
│     - Props do bloco: backgroundColor, textColor, buttonColor, etc.     │
│     - Aplicadas via style={{ color: valor }}                            │
│     - Só aplicam quando valor é explicitamente definido                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Padrão de Implementação em Blocos

```typescript
// ✅ CORRETO - herda do tema quando não personalizado
<h2 style={{ color: textColor || undefined }}>
  Título
</h2>

// ✅ CORRETO - usa classe semântica para herança
<p className="text-muted-foreground">
  Descrição
</p>

// ✅ CORRETO - botão com cores personalizáveis
<button style={{
  backgroundColor: buttonBgColor || undefined, // undefined = herda do tema
  color: buttonTextColor || undefined,
}}>
  Ação
</button>

// ❌ ERRADO - cor fixa que ignora tema
<h2 style={{ color: '#000000' }}>
  Título
</h2>
```

### Blocos com Opção de Personalização de Cores

| Bloco | Props de Cor Disponíveis |
|-------|-------------------------|
| `BannerBlock` | `backgroundColor`, `textColor`, `buttonColor`, `buttonTextColor`, `buttonHoverBgColor`, `buttonHoverTextColor` |
| `ButtonBlock` | `backgroundColor`, `textColor`, `hoverBgColor`, `hoverTextColor` |
| `NewsletterBlock` | `backgroundColor`, `textColor`, `buttonBgColor`, `buttonTextColor` |
| `ContentColumnsBlock` | `backgroundColor`, `textColor`, `iconColor` |
| `FeatureListBlock` | `backgroundColor`, `textColor`, `iconColor` |
| `StepsTimelineBlock` | `backgroundColor`, `accentColor` |
| `AccordionBlock` | `backgroundColor`, `accentColor` |

### Regras Obrigatórias

1. **SEMPRE** usar `valor || undefined` para props de cor (nunca fallback fixo)
2. **SEMPRE** usar classes semânticas Tailwind (`text-foreground`, `bg-muted`) quando não há personalização
3. **NUNCA** usar cores hardcoded (ex: `#000000`, `#1e40af`, `#3b82f6`) em estilos de bloco
4. Cores personalizadas **SOBRESCREVEM** o tema global apenas no bloco específico
5. A configuração legada de cores em `store_settings` foi **REMOVIDA** - usar apenas `themeSettings.colors`
6. **NUNCA** usar classes Tailwind com cores hardcoded (ex: `bg-blue-500`, `text-blue-600`)
7. Defaults no registry e defaults.ts devem usar **strings vazias** (`""`) para permitir herança do tema
8. Fallbacks devem usar **CSS variables** (ex: `var(--theme-button-primary-bg)`) nunca hex codes

### Padrão de Fallback Correto

```typescript
// ✅ CORRETO - usa CSS variable como fallback
backgroundColor: noticeBgColor || 'var(--theme-button-primary-bg, var(--primary))'

// ✅ CORRETO - string vazia no default permite herança
const DEFAULTS = {
  noticeBgColor: '', // Herda do tema
  button_bg_color: '', // Herda do tema
};

// ❌ ERRADO - hex code hardcoded
backgroundColor: noticeBgColor || '#1e40af'

// ❌ ERRADO - classe Tailwind com cor fixa
className="bg-blue-500"
```

---

## Fonte de Verdade dos Settings

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

---

## ⚠️ CRÍTICO: Invalidação de Cache após Publicação

Ao publicar um template, **AMBOS** os hooks de publicação **DEVEM** invalidar as queries públicas para que visitantes vejam as atualizações imediatamente.

### Queries que DEVEM ser Invalidadas

| Query Key | Responsabilidade |
|-----------|------------------|
| `public-template` | Conteúdo do template publicado (home, category, product, etc) |
| `public-theme-settings` | Cores, tipografia, configurações visuais |
| `public-page-template` | Páginas institucionais publicadas |
| `category-settings-published` | Settings de categoria (badges, botões, etc) |
| `public-storefront` | Header/Footer menus, store settings |
| `storefront-testimonials` | Depoimentos do checkout |

### Arquivos que Implementam Invalidação

| Arquivo | Função | Queries Invalidadas |
|---------|--------|---------------------|
| `useTemplateSetSave.ts` | `publishTemplateSet` | TODAS acima ✅ |
| `useTemplatesSets.ts` | `publishMutation` | TODAS acima ✅ |

### Implementação Obrigatória

```typescript
// Em QUALQUER mutation de publicação de template:
onSuccess: () => {
  // 1. Invalidar queries ADMIN
  queryClient.invalidateQueries({ queryKey: ['template-set-content', templateSetId] });
  queryClient.invalidateQueries({ queryKey: ['template-sets'] });
  queryClient.invalidateQueries({ queryKey: ['store-settings'] });
  queryClient.invalidateQueries({ queryKey: ['storefront-testimonials', tenantId] });
  
  // 2. CRÍTICO: Invalidar queries PÚBLICAS
  queryClient.invalidateQueries({ queryKey: ['public-template'] });
  queryClient.invalidateQueries({ queryKey: ['public-theme-settings'] });
  queryClient.invalidateQueries({ queryKey: ['public-page-template'] });
  queryClient.invalidateQueries({ queryKey: ['category-settings-published'] });
  queryClient.invalidateQueries({ queryKey: ['public-storefront'] });
}
```

### ❌ Proibições

| Proibido | Consequência |
|----------|--------------|
| Publicar sem invalidar `public-template` | Visitantes continuam vendo versão antiga |
| Usar `staleTime` > 5 minutos em queries públicas | Delay excessivo para ver atualizações |
| Invalidar apenas queries admin | Storefront público não atualiza |

### Cache Timing Recomendado

| Query | staleTime | gcTime | Motivo |
|-------|-----------|--------|--------|
| `public-template` | 2 min | 10 min | Permite atualizações rápidas após publicação |
| `public-theme-settings` | 2 min | 10 min | Permite atualizações rápidas após publicação |
| `public-page-template` | 2 min | 10 min | Permite atualizações rápidas após publicação |

> **Nota (2025-01-30):** staleTime reduzido de 15min→2min para garantir que visitantes vejam atualizações rapidamente após publicação.

---

## Settings por Página

### Categoria (CategorySettings)

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
| `showCategoryName` | boolean | true | Exibe nome da categoria |

### CategoryBanner (Defaults do Builder)

| Prop | Default | Descrição |
|------|---------|-----------|
| `showTitle` | true | Exibe título da categoria sobre o banner |
| `titlePosition` | 'center' | Posição do título: 'left', 'center', 'right' |
| `overlayOpacity` | 0 | Opacidade do overlay escuro (0-100). Default 0 = sem escurecimento |
| `height` | 'md' | Altura do banner: 'sm', 'md', 'lg' |

> **Nota (2025-01-25):** `overlayOpacity` default alterado de 40→0 em `defaults.ts` e `pageContracts.ts` para evitar escurecimento automático.

### Produto (ProductSettings)

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
| `showBadges` | boolean | true | Exibe selos do produto |
| `showShippingCalculator` | boolean | true | Exibe calculadora de frete |
| `showAdditionalHighlight` | boolean | false | Exibe banners de destaque adicional |
| `showFloatingCart` | boolean | true | Exibe popup de carrinho rápido |
| `buyNowButtonText` | string | "Comprar agora" | Texto do botão principal |
| `cartActionType` | CartActionType | "miniCart" | Ação ao clicar em "Adicionar ao carrinho" |

### Carrinho (CartSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showCrossSell` | boolean | true | Exibe produtos sugeridos |
| `showCouponField` | boolean | true | Exibe campo de cupom |
| `showTrustBadges` | boolean | true | Exibe selos de confiança |
| `showShippingCalculator` | boolean | true | Exibe calculadora de frete |

### Checkout (CheckoutSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderSummary` | boolean | true | Exibe resumo do pedido |
| `showCouponField` | boolean | true | Exibe campo de cupom |
| `allowGuestCheckout` | boolean | true | Permite checkout sem login |

### Obrigado (ThankYouSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderDetails` | boolean | true | Exibe detalhes do pedido |
| `showRelatedProducts` | boolean | true | Exibe produtos relacionados |
| `showTrackingInfo` | boolean | true | Exibe info de rastreio |

---

## Integração com Carrinho

### Regras Obrigatórias

1. **SEMPRE** usar `useCart()` do `@/contexts/CartContext` para operações de carrinho
2. **SEMPRE** renderizar `MiniCartDrawer` quando `cartActionType === 'miniCart'`
3. **SEMPRE** implementar feedback visual "Adicionado" quando `cartActionType === 'none'`
4. **SEMPRE** usar `getPublicCheckoutUrl(tenantSlug)` para compra rápida
5. **NUNCA** usar `miniCartEnabled` ou `openMiniCartOnAdd` diretamente - usar `cartActionType` de `themeSettings.miniCart`

### Configuração Unificada (cartActionType)

A configuração de ação do carrinho é centralizada em **Configurações do Tema → Carrinho Suspenso** (`MiniCartSettings.tsx`).

| Valor | Comportamento |
|-------|---------------|
| `'miniCart'` | Abre drawer lateral ao adicionar |
| `'goToCart'` | Redireciona para página do carrinho |
| `'none'` | Apenas toast de confirmação |

### Blocos que Respeitam themeSettings.miniCart

> **Atualizado em:** 2025-01-30

Todos os blocos de produtos do builder respeitam a configuração `themeSettings.miniCart.cartActionType`:

| Bloco | Arquivo | Suporte miniCart |
|-------|---------|------------------|
| `ProductGrid` | `ProductGridBlock.tsx` | ✅ |
| `FeaturedProducts` | `FeaturedProductsBlock.tsx` | ✅ |
| `ProductCarousel` | `ProductCarouselBlock.tsx` | ✅ |
| `CategoryPageLayout` | `CategoryPageLayout.tsx` | ✅ |
| `ProductDetails` | `ProductDetailsBlock.tsx` | ✅ |

Cada bloco:
1. Lê `themeSettings.miniCart.cartActionType` do contexto
2. Renderiza `MiniCartDrawer` condicionalmente (quando `cartActionType === 'miniCart'`)
3. Abre o drawer ao adicionar produto ao carrinho (via `setMiniCartOpen(true)`)

### Padrão de Handler

```typescript
// Ler do themeSettings.miniCart
const themeSettings = context?.themeSettings || {};
const miniCartConfig = themeSettings.miniCart || {};
const cartActionType = miniCartConfig.cartActionType ?? 'miniCart';
const miniCartEnabled = cartActionType === 'miniCart';

// Estado para controlar o drawer
const [miniCartOpen, setMiniCartOpen] = useState(false);

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
  
  addItem(cartItem);
  toast.success('Produto adicionado ao carrinho!');
  
  if (cartActionType === 'miniCart') {
    setMiniCartOpen(true);
  } else if (cartActionType === 'goToCart') {
    navigate(getPublicCartUrl(tenantSlug, isPreview));
  }
  // Se 'none', apenas o toast já foi exibido
  
  // Feedback visual no botão
  setAddedProducts(prev => new Set(prev).add(product.id));
  setTimeout(() => {
    setAddedProducts(prev => {
      const newSet = new Set(prev);
      newSet.delete(product.id);
      return newSet;
    });
  }, 2000);
};

// Renderizar MiniCartDrawer condicionalmente
{miniCartEnabled && (
  <MiniCartDrawer
    open={miniCartOpen}
    onOpenChange={setMiniCartOpen}
    tenantSlug={tenantSlug}
    isPreview={context?.isPreview}
  />
)}
```

---

## Comportamento Builder vs Público

| Contexto | Dados Reais | Dados Demo |
|----------|-------------|------------|
| **Builder** (`isEditing=true`) | ✅ Exibe | ✅ Exibe como fallback |
| **Storefront Público** (`isEditing=false`) | ✅ Exibe | ❌ Não renderiza |

### Indicadores Visuais de Demo

| Indicador | Estilo | Descrição |
|-----------|--------|-----------|
| Opacidade | `opacity-50` | Elementos demo ficam semi-transparentes |
| Badge | `[Demo]` | Tag visual indicando conteúdo fictício |
| Border | `border-dashed` | Borda tracejada em alguns elementos |

---

## Responsividade — Container Queries

| Classe | Breakpoint | Uso |
|--------|------------|-----|
| `.sf-*-mobile` | Container < 768px | Exibe versão mobile |
| `.sf-*-desktop` | Container ≥ 768px | Exibe versão desktop |

**Regra Fixa:** Usar classes `sf-*` (container queries) em vez de `md:`, `lg:` (media queries) dentro do storefront.

---

## Sistema de Edição de Texto Rico (RichText)

### Arquitetura Canônica

O sistema de edição inline usa uma arquitetura **uncontrolled** para estabilidade visual:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CANVAS RICH TEXT CONTEXT                            │
│  Arquivo: src/components/builder/CanvasRichTextContext.tsx              │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Registrar/desregistrar instâncias de editores ativos                 │
│  • Salvar e restaurar seleções de texto                                 │
│  • Sincronizar seleção com o estado global do Builder                   │
│  • Gerenciar lock de formatação durante operações                       │
│  • Capturar seleções via eventos globais (selectionchange + mouseup)    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         RICH TEXT BLOCK                                  │
│  Arquivo: src/components/builder/blocks/content/RichTextBlock.tsx       │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Renderizar contentEditable para edição inline                        │
│  • Registrar instância no CanvasRichTextContext                         │
│  • Bloquear atalhos globais (Backspace/Delete) durante edição           │
│  • Sincronizar innerHTML com estado global via commit (debounce/blur)   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    RICH TEXT EDITOR (PAINEL LATERAL)                    │
│  Arquivo: src/components/builder/panels/RichTextEditor.tsx              │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Exibir controles de formatação (Negrito, Itálico, Fonte, Tamanho)   │
│  • Restaurar seleção antes de aplicar comandos                          │
│  • Aplicar comandos via execCommand no canvas                           │
│  • Gerenciar tamanhos de fonte em PX (12px a 48px)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Sincronização de Seleção

| Evento | Ação | Propósito |
|--------|------|-----------|
| `selectionchange` | `autoSaveSelection()` | Captura seleções durante arraste |
| `mouseup` | `autoSaveSelection()` + delay | Garante captura quando mouse termina fora do canvas |
| `onBlockSelect` | `store.selectBlock(blockId)` | Sincroniza com estado global do Builder |

**Regra Crítica:** A seleção de texto SEMPRE notifica o Builder para exibir o painel de propriedades, independentemente de onde o ponteiro do mouse termina.

### Controles de Formatação

| Controle | Fonte | Valores |
|----------|-------|---------|
| Negrito | Painel lateral | Toggle via execCommand |
| Itálico | Painel lateral | Toggle via execCommand |
| Sublinhado | Painel lateral | Toggle via execCommand |
| Fonte | Painel lateral | Lista de fontes do tema |
| Tamanho | Painel lateral | 12px, 14px, 16px, 18px, 20px, 24px, 28px, 32px, 36px, 40px, 48px |

**Regra Fixa:** Editor flutuante foi REMOVIDO. Todos os controles são centralizados no painel lateral (menu principal).

### Regras de Implementação

1. **NUNCA** usar edição controlada (React state) para conteúdo inline — causa flickering
2. **SEMPRE** usar commit via debounce ou blur para sincronizar com estado global
3. **SEMPRE** bloquear eventos de teclado globais (Delete/Backspace) dentro do bloco
4. **SEMPRE** registrar instância no CanvasRichTextContext ao montar
5. **SEMPRE** restaurar seleção antes de aplicar formatação via painel lateral

---

## Sistema de Real-time Preview e Salvamento Manual Unificado

> **Implementado em:** 2025-01-29 | **Expandido em:** 2025-01-30

O builder utiliza um sistema de **preview em tempo real** com **salvamento manual unificado**, garantindo feedback visual instantâneo sem persistência automática para **TODAS** as configurações (tema + páginas).

### Princípio Fundamental

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  SALVAMENTO UNIFICADO (REGRA PRINCIPAL)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  • Todas as alterações ficam em estado LOCAL (draft) até clicar Salvar  │
│  • Configurações do Tema (cores, tipografia, CSS) → useBuilderDraftTheme│
│  • Configurações de Página (toggles, opções) → useBuilderDraftPageSettings│
│  • NÃO existe auto-save/debounce em nenhum painel                       │
│  • Ao sair sem salvar, TODAS as alterações são perdidas                 │
│  • isDirty = store.isDirty || themeDraft.hasDraftChanges || pageDraft.hasDraftChanges│
└─────────────────────────────────────────────────────────────────────────┘
```

### Arquitetura de Drafts

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DRAFT THEME CONTEXT                                   │
│  Arquivo: src/hooks/useBuilderDraftTheme.tsx                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Estado Local (useState):                                                │
│  • draftColors: ThemeColors | null                                       │
│  • draftTypography: ThemeTypography | null                               │
│  • draftCustomCss: string | null                                         │
│                                                                          │
│  Quando NOT NULL: indica alterações não salvas                          │
│  Quando NULL: usa valores do banco (saved)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    +
┌─────────────────────────────────────────────────────────────────────────┐
│                    DRAFT PAGE SETTINGS CONTEXT                           │
│  Arquivo: src/hooks/useBuilderDraftPageSettings.tsx                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Estado Local (useState):                                                │
│  • draftPageSettings: Record<PageSettingsKey, PageSettingsType | null>  │
│    - home: HomeSettings | null                                           │
│    - category: CategorySettings | null                                   │
│    - product: ProductSettings | null                                     │
│    - cart: CartSettings | null                                           │
│    - checkout: CheckoutSettings | null                                   │
│    - thank_you: ThankYouSettings | null                                  │
│                                                                          │
│  Quando NOT NULL: indica alterações não salvas para aquela página       │
│  Quando NULL: usa valores do banco (saved)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    BUILDER THEME INJECTOR                                │
│  Arquivo: src/hooks/useBuilderThemeInjector.ts                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Prioridade de Valores:                                                  │
│  1. Draft (local, não salvo) — MAIOR PRIORIDADE                         │
│  2. Saved (banco de dados)                                               │
│  3. Defaults                                                             │
│                                                                          │
│  Injeta <style id="builder-theme-styles"> no <head>                     │
│  Atualiza instantaneamente ao detectar mudanças no draft                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    VISUAL BUILDER (ORQUESTRADOR)                         │
│  Arquivo: src/components/builder/VisualBuilder.tsx                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Providers hierárquicos:                                                 │
│    BuilderDraftThemeProvider                                             │
│      BuilderDraftPageSettingsProvider                                    │
│        ├─ BuilderThemeInjectorInner                                      │
│        ├─ DraftThemeRefSync                                              │
│        └─ Resto do builder...                                            │
│                                                                          │
│  isDirty = store.isDirty                                                 │
│         || draftTheme.hasDraftChanges                                    │
│         || draftPageSettings?.hasDraftChanges                            │
│                                                                          │
│  handleSave():                                                           │
│    1. Merge theme draft into themeSettings (colors, typography, css)    │
│    2. Merge page settings draft into pageSettings por tipo de página    │
│    3. Save to storefront_template_sets.draft_content                    │
│    4. setQueryData theme-settings (cache síncrono)                      │
│    5. setQueryData page settings por tipo (category, product, etc.)     │
│    6. requestAnimationFrame + setTimeout(0) — portão de sincronização   │
│    7. Call draftTheme.clearDraft() após sucesso                         │
│    8. Call draftPageSettings.clearDraft() após sucesso                  │
│    9. notifyPageSettingsSaveCompleted() — reload baseline               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Dados — Tema

| Ação do Usuário | Componente de Origem | Destino | Persistência |
|-----------------|---------------------|---------|--------------|
| Muda cor | `ColorsSettings.tsx` | `draftTheme.setDraftColors()` | **NÃO** (local) |
| Muda tipografia | `TypographySettings.tsx` | `draftTheme.setDraftTypography()` | **NÃO** (local) |
| Muda CSS custom | `CustomCSSSettings.tsx` | `draftTheme.setDraftCustomCss()` | **NÃO** (local) |

### Fluxo de Dados — Páginas

| Ação do Usuário | Componente de Origem | Destino | Persistência |
|-----------------|---------------------|---------|--------------|
| Toggle em Home | `PageSettingsContent.tsx` | `draftPageSettings.setDraftPageSettings('home', ...)` | **NÃO** (local) |
| Toggle em Category | `CategorySettingsPanel.tsx` | `draftPageSettings.setDraftPageSettings('category', ...)` | **NÃO** (local) |
| Toggle em Product | `ProductSettingsPanel.tsx` | `draftPageSettings.setDraftPageSettings('product', ...)` | **NÃO** (local) |
| Toggle em Cart | `CartSettingsPanel.tsx` | `draftPageSettings.setDraftPageSettings('cart', ...)` | **NÃO** (local) |
| Toggle em Checkout | `CheckoutSettingsPanel.tsx` | `draftPageSettings.setDraftPageSettings('checkout', ...)` | **NÃO** (local) |
| Toggle em Thank You | `ThankYouSettingsPanel.tsx` | `draftPageSettings.setDraftPageSettings('thank_you', ...)` | **NÃO** (local) |

### Fluxo de Dados — Salvamento

| Ação do Usuário | Componente | Destino | Persistência |
|-----------------|------------|---------|--------------|
| Clica "Salvar" | `VisualBuilder.tsx` | Supabase + `clearDraft()` (ambos) | **SIM** (banco) |
| Clica "Publicar" | `useTemplateSetSave.ts` | `published_content` | **SIM** (público) |

### Implementação nos Painéis de Settings

Cada painel de configuração de página segue este padrão:

```tsx
// ❌ ANTES (auto-save com mutation)
const { updateCategorySettings } = usePageSettings(tenantId, templateSetId);

const handleToggle = (key: string, value: boolean) => {
  updateCategorySettings({ ...settings, [key]: value }); // Salva imediatamente!
};

// ✅ DEPOIS (draft local)
const draftPageSettings = useBuilderDraftPageSettings();

const handleToggle = (key: string, value: boolean) => {
  const newSettings = { ...settings, [key]: value };
  draftPageSettings?.setDraftPageSettings('category', newSettings); // Apenas local!
};

// Para exibir valores atuais (prioriza draft > saved)
const effectiveSettings = draftPageSettings?.getEffectiveSettings<CategorySettings>(
  'category',
  savedSettings
) || savedSettings;
```

### Comportamento de Reset

| Cenário | Comportamento |
|---------|---------------|
| Muda de página sem salvar | Draft é resetado (useState desmontado) |
| Fecha aba/navegador com alterações | Aviso via `beforeunload` |
| Clica "Salvar" | Draft persistido + cleared (ambos contexts) |
| Clica "Publicar" | `draft_content` → `published_content` |

### Regras Obrigatórias

1. **NUNCA** usar auto-save/debounce em configurações de tema ou página — apenas salvamento manual
2. **NUNCA** chamar mutations de update diretamente dos painéis de settings
3. **SEMPRE** envolver o builder em `BuilderDraftThemeProvider` + `BuilderDraftPageSettingsProvider`
4. **SEMPRE** verificar `hasDraftChanges` de AMBOS os contexts para indicador de alterações pendentes
5. **SEMPRE** chamar `clearDraft()` de AMBOS os contexts após persistência bem-sucedida
6. **SEMPRE** usar `getEffectiveSettings()` para exibir valores (prioriza draft > saved)
7. **NUNCA** persistir diretamente do componente de settings — apenas via `handleSave` central
8. **SEMPRE** atualizar os caches de page settings via `setQueryData` antes de `clearDraft()` — caso contrário, o canvas reverte para dados stale (ex: `customButtonEnabled` volta ao valor antigo)

### Caches de Page Settings — Query Keys

| Page Type | Query Key | Hook |
|-----------|-----------|------|
| `category` | `['category-settings-builder', tenantId, templateSetId]` | `useCategorySettings` |
| `product` | `['product-settings-builder', tenantId, templateSetId]` | `useProductSettings` |
| `cart` | `['cart-settings-builder', tenantId, templateSetId]` | `useCartSettings` |
| `checkout` | `['checkout-settings-builder', tenantId, templateSetId]` | `useCheckoutSettings` |
| `thank_you` | `['thankYou-settings-builder', tenantId, templateSetId]` | `useThankYouSettings` |

> **CRÍTICO:** Após salvar `draft_content`, o `handleSave` DEVE chamar `setQueryData` para cada page type que tenha settings salvos, ANTES de `clearDraft()`. Sem isso, `clearDraft()` remove o draft → `getEffectiveSettings()` retorna `savedSettings` → cache stale → canvas mostra estado antigo.

### Arquivos Relacionados

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/hooks/useBuilderDraftTheme.tsx` | Context + state local de draft para tema |
| `src/hooks/useBuilderDraftPageSettings.tsx` | Context + state local de draft para páginas |
| `src/hooks/useBuilderThemeInjector.ts` | Injeção CSS com prioridade draft > saved |
| `src/components/builder/VisualBuilder.tsx` | Orquestração + handleSave unificado |
| `src/components/builder/theme-settings/ColorsSettings.tsx` | Edição de cores → draft |
| `src/components/builder/theme-settings/TypographySettings.tsx` | Edição de tipografia → draft |
| `src/components/builder/theme-settings/CustomCSSSettings.tsx` | Edição de CSS → draft |
| `src/components/builder/theme-settings/PageSettingsContent.tsx` | Toggles de página Home → draft |
| `src/components/builder/CategorySettingsPanel.tsx` | Toggles de Category → draft |
| `src/components/builder/ProductSettingsPanel.tsx` | Toggles de Product → draft |
| `src/components/builder/CartSettingsPanel.tsx` | Toggles de Cart → draft |
| `src/components/builder/CheckoutSettingsPanel.tsx` | Toggles de Checkout → draft |
| `src/components/builder/ThankYouSettingsPanel.tsx` | Toggles de Thank You → draft |

---

## Sistema de Cores Dinâmicas (Accent Color)

> **Implementado em:** 2025-01-29

O sistema elimina cores hardcoded substituindo-as por variáveis CSS dinâmicas que herdam das configurações do tema.

### Variáveis CSS de Destaque

| Variável | Descrição | Fallback |
|----------|-----------|----------|
| `--theme-accent-color` | Cor de destaque principal | `#22c55e` (verde) |
| `--theme-highlight-bg` | Background de destaques (bumps, urgência) | `#fef3c7` (amber-100) |
| `--theme-warning-bg` | Background de avisos/timers | `#fef3c7` (amber-100) |
| `--theme-danger-bg` | Background de badges de desconto | `#ef4444` (red) |

### Uso de `color-mix()` para Opacidade

```css
/* Background com 10% de opacidade */
background-color: color-mix(in srgb, var(--theme-accent-color) 10%, transparent);

/* Borda com 30% de opacidade */
border-color: color-mix(in srgb, var(--theme-accent-color) 30%, transparent);

/* Texto sólido */
color: var(--theme-accent-color);
```

### Componentes Migrados (2025-01-29)

| Componente | Cores Antigas | Cores Novas |
|------------|---------------|-------------|
| `PaymentBadges.tsx` | `text-green-600`, `bg-green-50` | `--theme-accent-color` + color-mix |
| `CheckoutShipping.tsx` | `text-green-600` | `--theme-accent-color` |
| `CartSummary.tsx` | `text-green-600`, `bg-green-50` | `--theme-accent-color` + color-mix |
| `MiniCartPreview.tsx` | `text-green-600`, `bg-amber-50` | `--theme-accent-color`, `--theme-warning-bg` |
| `BundlesSection.tsx` | `text-green-600`, `bg-green-50` | `--theme-accent-color` + color-mix |
| `BuyTogetherSection.tsx` | `text-green-600`, `bg-green-50` | `--theme-accent-color` + color-mix |
| `CrossSellSection.tsx` | `text-green-600`, `bg-green-50` | `--theme-accent-color` + color-mix |
| `ProductCTAs.tsx` | `bg-green-500` (WhatsApp) | `--theme-accent-color` |
| `ThankYouContent.tsx` | `text-green-600`, `bg-green-50` | `--theme-accent-color` + color-mix |
| `ProductReviewsSection.tsx` | `text-green-600` | `--theme-accent-color` |
| `CheckoutDemoBlock.tsx` | `bg-amber-50`, `border-amber-200` | `--theme-highlight-bg` |
| `ProductCard.tsx` | `bg-destructive` | `--theme-danger-bg` |
| `BlockRenderer.tsx` | classes hardcoded | `--theme-danger-bg` |
| `CouponInput.tsx` | `text-green-600`, `bg-green-50` | `--theme-accent-color` + color-mix |

### Regras Obrigatórias

1. **NUNCA** usar `text-green-*`, `bg-green-*`, `text-amber-*`, `bg-amber-*` em componentes do storefront
2. **SEMPRE** usar `var(--theme-accent-color)` para cores de sucesso/destaque
3. **SEMPRE** usar `color-mix()` para backgrounds com opacidade
4. **SEMPRE** incluir fallback nas variáveis CSS: `var(--theme-accent-color, #22c55e)`
5. Cores de feedback (sucesso, aviso, perigo) herdam do accentColor caso não definidas

---

## Padrão de Sincronização de Cache (React Query)

> **Implementado em:** 2025-02-02  
> **Corrige:** Race conditions que causam "flash" de dados antigos após salvar

### Problema Identificado

Ao salvar configurações no builder, a UI brevemente exibia valores antigos (ex: cor azul voltava por 200ms após salvar verde) mesmo quando a persistência estava correta. Isso ocorria devido a **race conditions** entre:

1. `clearDraft()` — remove estado local, UI volta a ler do cache
2. `invalidateQueries()` — dispara refetch assíncrono
3. Cache ainda contém dados **stale** até o refetch completar

### Solução: Cache Síncrono + Delay de Sincronização

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PADRÃO OBRIGATÓRIO — onSuccess                       │
├─────────────────────────────────────────────────────────────────────────┤
│  ❌ ERRADO (causa race condition):                                      │
│  onSuccess: () => {                                                      │
│    queryClient.invalidateQueries({ queryKey: ['my-data'] });            │
│  }                                                                       │
│                                                                          │
│  ✅ CORRETO (atualização síncrona):                                     │
│  onSuccess: (savedData) => {                                             │
│    queryClient.setQueryData(['my-data', tenantId], (old) => ({          │
│      ...old,                                                             │
│      ...savedData,                                                       │
│    }));                                                                   │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Padrão Completo com Drafts

Quando o fluxo envolve estados de draft (local) que são limpos após salvamento:

```tsx
// Em VisualBuilder.tsx ou similar
const handleSave = async () => {
  // 1. Salvar no banco
  await saveMutation.mutateAsync(dataToSave);
  
  // 2. Atualizar cache SÍNCRONAMENTE com dados salvos
  queryClient.setQueryData(['theme-settings', tenantId, templateSetId], savedData);
  
  // 3. CRÍTICO: Aguardar React processar a atualização do cache
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
  
  // 4. SOMENTE AGORA limpar drafts — cache já tem dados frescos
  draftContext.clearDraft();
};
```

### Por Que o Delay é Necessário?

| Sem Delay | Com Delay (requestAnimationFrame + setTimeout) |
|-----------|-----------------------------------------------|
| `setQueryData` atualiza cache | `setQueryData` atualiza cache |
| `clearDraft()` executa imediatamente | React processa re-render com cache novo |
| ThemeInjector re-renderiza com cache stale (batching) | DOM é atualizado com valores novos |
| Flash de cor antiga | `clearDraft()` executa |
| | ThemeInjector já vê dados corretos |

### Arquivos Corrigidos com Este Padrão

| Arquivo | Mutation(s) Corrigida(s) |
|---------|--------------------------|
| `src/components/builder/VisualBuilder.tsx` | `handleSave` — tema e page settings |
| `src/hooks/useGlobalLayoutIntegration.ts` | `updateGlobalHeader`, `updateGlobalFooter`, `updateCheckoutHeader`, `updateCheckoutFooter`, `migrateFromHome`, `updateVisibilityToggles` |
| `src/hooks/useThemeSettings.ts` | `updateThemeSettings` (usa optimistic update via `onMutate`) |

### Regras Obrigatórias

1. **NUNCA** usar `invalidateQueries` em `onSuccess` para dados que a UI lê imediatamente após save
2. **SEMPRE** retornar os dados salvos do `mutationFn` para uso no `onSuccess`
3. **SEMPRE** usar `setQueryData` síncrono no `onSuccess` com os dados salvos
4. **SEMPRE** aguardar `requestAnimationFrame` + microtask ANTES de limpar drafts
5. **SEMPRE** que o `mutationFn` modificar dados, retornar os dados modificados (não `void`)
6. `invalidateQueries` é aceitável apenas para dados que NÃO afetam UI imediata (ex: `public-global-layout`)

### Template de Mutation Segura

```tsx
const updateSomething = useMutation({
  mutationFn: async (newData: SomeType) => {
    const { error } = await supabase
      .from('my_table')
      .update(newData)
      .eq('tenant_id', tenantId);
    
    if (error) throw error;
    
    // CRÍTICO: Retornar dados para onSuccess
    return newData;
  },
  onSuccess: (savedData) => {
    // CRÍTICO: Atualização síncrona do cache
    queryClient.setQueryData(['my-query-key', tenantId], (old: MyType | undefined) => {
      if (!old) return savedData;
      return { ...old, ...savedData };
    });
  },
});
```

### Verificação de Conformidade

Ao criar ou modificar mutations no builder, verificar:

- [ ] `mutationFn` retorna os dados salvos (não `void`)?
- [ ] `onSuccess` recebe os dados salvos como parâmetro?
- [ ] `onSuccess` usa `setQueryData` (não `invalidateQueries`)?
- [ ] Se há estados de draft, o `clearDraft()` ocorre APÓS o delay de sincronização?
- [ ] Query keys incluem `tenantId` para isolamento multi-tenant?

---

## Template Padrão ("Standard Preset")

> **Implementado em:** 2025-02-02

O sistema oferece um **Template Padrão** pré-configurado baseado no design "Respeite o Homem", disponível para todos os tenants como ponto de partida profissional.

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STANDARD PRESET STRUCTURE                             │
│  Arquivo: src/lib/builder/standardPreset.ts                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Exports:                                                                │
│  • standardHomeTemplate          ← Template da página inicial           │
│  • standardCategoryTemplate      ← Template de categorias               │
│  • standardProductTemplate       ← Template de produto                  │
│  • standardCartTemplate          ← Template do carrinho                 │
│  • standardCheckoutTemplate      ← Template do checkout (header escuro) │
│  • standardThankYouTemplate      ← Template de obrigado                 │
│  • standardAccountTemplate       ← Template da área do cliente          │
│  • standardAccountOrdersTemplate ← Template de pedidos                  │
│  • standardAccountOrderDetailTemplate ← Template de detalhes do pedido  │
│  • standardThemeSettings         ← Cores e footer pré-configurados      │
│  • getStandardTemplate()         ← Busca template por pageType          │
│  • getAllStandardTemplates()     ← Retorna todos os templates           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Criação

```
┌────────────────────────────────────────────────────────────────────────┐
│  FLUXO TEMPLATE PADRÃO ("Usar este modelo"):                           │
│  1. Usuário clica em "Ver loja modelo" → Abre PresetPreviewDialog      │
│  2. Dialog mostra preview com viewport desktop/mobile                   │
│  3. Usuário clica em "Usar este modelo"                                 │
│  4. useTemplatesSets.createTemplate({ name: 'Padrão', basePreset })    │
│  5. getAllStandardTemplates() retorna array com todos os templates      │
│  6. Template é criado e usuário vai direto para o Builder               │
│                                                                          │
│  FLUXO INICIAR DO ZERO ("Criar novo modelo"):                           │
│  1. Usuário clica em "Criar novo modelo"                                │
│  2. Abre CreateTemplateDialog pedindo nome do template                  │
│  3. Usuário insere nome e confirma                                      │
│  4. useTemplatesSets.createTemplate({ name, basePreset: 'blank' })     │
│  5. Template vazio é criado e usuário vai para o Builder                │
└────────────────────────────────────────────────────────────────────────┘
```

### Características do Template Padrão

#### Páginas Incluídas

| Página | Conteúdo |
|--------|----------|
| **Home** | Banner (modo carrossel), CategoriesGrid, FeaturedProducts |
| **Categoria** | CategoryBanner, ProductGrid |
| **Produto** | ProductDetails, CompreJuntoSlot |
| **Carrinho** | Cart, RecommendedProducts |
| **Checkout** | Header escuro customizado, Checkout, Footer escuro, badges de pagamento |
| **Obrigado** | ThankYou |
| **Conta** | AccountHub |
| **Pedidos** | OrdersList |
| **Detalhe Pedido** | OrderDetail |

#### Theme Settings Padrão

```typescript
standardThemeSettings = {
  colors: {
    primary: '30 50% 15%',      // Verde escuro premium
    secondary: '40 20% 90%',    // Bege suave
    accent: '35 80% 45%',       // Dourado/âmbar
    background: '40 30% 96%',   // Off-white quente
    foreground: '30 30% 15%',   // Texto escuro
    muted: '40 15% 92%',        // Cinza quente
    mutedForeground: '30 15% 45%',
    card: '0 0% 100%',          // Cards brancos
    cardForeground: '30 30% 15%',
    border: '40 20% 88%',
    ring: '35 80% 45%',         // Focus ring dourado
  },
  typography: {
    headingFont: 'playfair',    // Fonte elegante
    bodyFont: 'inter',          // Fonte legível
    baseFontSize: 16,
  },
  footerElements: [
    { type: 'social', enabled: true, title: 'Redes Sociais' },
    { type: 'links', enabled: true, title: 'Links Úteis', links: [...] },
    { type: 'contact', enabled: true, title: 'Contato' },
    { type: 'newsletter', enabled: true, title: 'Newsletter' },
    { type: 'payments', enabled: true, title: 'Formas de Pagamento' },
  ],
}
```

### Proibições

| Proibido | Motivo |
|----------|--------|
| Modificar `standardPreset.ts` com dados específicos de tenant | Template deve ser genérico |
| Usar URLs de imagens reais do tenant "Respeite o Homem" | Template usa placeholders |
| Remover badges de pagamento do checkout padrão | Elemento de confiança obrigatório |
| Alterar estrutura de cores sem consultar design system | Cores são harmonizadas |

### Arquivos Relacionados

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/builder/standardPreset.ts` | Definição dos templates e theme settings |
| `src/lib/builder/index.ts` | Export do standardPreset |
| `src/hooks/useTemplatesSets.ts` | Lógica de criação com preset |
| `src/components/storefront-admin/StorefrontTemplatesTab.tsx` | UI de seleção de preset |
| `src/components/storefront-admin/CreateTemplateDialog.tsx` | Dialog de criação (apenas blank) |
| `src/components/storefront-admin/PresetPreviewDialog.tsx` | Dialog de preview com features e viewport toggle |

### Extensibilidade

Para adicionar novos presets no futuro:

1. Criar arquivo `src/lib/builder/[nomePreset]Preset.ts`
2. Exportar em `src/lib/builder/index.ts`
3. Adicionar tipo ao `CreateTemplateParams.basePreset`
4. Adicionar lógica no `createTemplate` mutation
5. Adicionar UI no `StorefrontTemplatesTab.tsx`
6. Documentar neste arquivo
