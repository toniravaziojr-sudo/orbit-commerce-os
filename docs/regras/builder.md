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

> ⚠️ **REGRA CRÍTICA DE PARIDADE:** Toda alteração em blocos React do Builder DEVE ser replicada no compilador HTML (Edge). Consultar obrigatoriamente: **`docs/regras/paridade-builder-publico.md`** antes de qualquer mudança.

---

## Botões de Visualização no Toolbar (Regra Estrutural)

O toolbar do builder possui dois botões distintos para visualização:

### Botão "Preview" (Eye icon)

- **Visibilidade:** Sempre visível
- **Função:** Abre a loja em nova aba com `?preview=1`
- **Domínio:** Subdomínio da plataforma (`tenantSlug.shops.comandocentral.com.br`)
- **Comportamento:** Exibe conteúdo **DRAFT** (não publicado) da loja, renderizado pelo Cloudflare Worker
- **Ícone:** `Eye`
- **Uso:** Permite ao lojista visualizar como a loja ficará ANTES de publicar
- **Motivo do domínio shops:** O Worker intercepta a requisição e entrega o HTML completo; no domínio do app isso não acontece, resultando em página em branco.

### Botão "Ver loja" (Globe icon)

- **Visibilidade:** Somente quando `is_published = true` em `store_settings`
- **Função:** Abre a loja pública em nova aba (sem `?preview`)
- **Domínio:** Domínio público primário (custom domain se ativo, senão subdomínio shops)
- **Comportamento:** Exibe conteúdo **PUBLICADO** da loja
- **Ícone:** `Globe`
- **Uso:** Permite ao lojista ver a loja como os clientes a veem

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BOTÕES DE VISUALIZAÇÃO                               │
├─────────────────────────────────────────────────────────────────────────┤
│  [Preview]     → shopsOrigin (tenant.shops.domain) + path + ?preview=1 │
│  [Ver loja]    → primaryOrigin + path (sem parâmetro preview)          │
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
| `canonicalDomainService.ts` | `getPlatformSubdomainUrl()` gera URL do subdomínio shops |

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
  transition: all 0.2s ease !important;
}
@media(hover:hover) {
  .storefront-container .sf-btn-primary:hover {
    background-color: var(--theme-button-primary-hover) !important;
    transform: translateY(-1px) !important;
    filter: brightness(1.1) !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
  }
}
.storefront-container .sf-btn-primary:active {
  transform: scale(0.93) !important;
  filter: brightness(0.88) !important;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2) !important;
  transition: transform 0.08s !important;
}

/* Botão Primário Outline - Hover preenche com cor primária */
.storefront-container .sf-btn-outline-primary {
  background-color: transparent !important;
  color: var(--theme-button-primary-bg, #1a1a1a) !important;
  border: 1px solid var(--theme-button-primary-bg, #1a1a1a) !important;
  transition: all 0.2s ease !important;
}
@media(hover:hover) {
  .storefront-container .sf-btn-outline-primary:hover {
    background-color: var(--theme-button-primary-bg, #1a1a1a) !important;
    color: var(--theme-button-primary-text, #ffffff) !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
  }
}
.storefront-container .sf-btn-outline-primary:active {
  transform: scale(0.93) !important;
  filter: brightness(0.88) !important;
  background-color: var(--theme-button-primary-bg, #1a1a1a) !important;
  color: var(--theme-button-primary-text, #ffffff) !important;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2) !important;
  transition: transform 0.08s !important;
}

/* Botão Secundário Sólido */
.storefront-container .sf-btn-secondary {
  background-color: var(--theme-button-secondary-bg, #f5f5f5) !important;
  color: var(--theme-button-secondary-text, #1a1a1a) !important;
  transition: all 0.2s ease !important;
}
@media(hover:hover) {
  .storefront-container .sf-btn-secondary:hover {
    background-color: var(--theme-button-secondary-hover) !important;
    transform: translateY(-1px) !important;
    filter: brightness(1.1) !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
  }
}
.storefront-container .sf-btn-secondary:active {
  transform: scale(0.93) !important;
  filter: brightness(0.88) !important;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2) !important;
  transition: transform 0.08s !important;
}

/* Botão Secundário Outline */
.storefront-container .sf-btn-outline-secondary {
  background-color: transparent !important;
  color: var(--theme-button-secondary-text, #1a1a1a) !important;
  border: 1px solid var(--theme-button-secondary-bg, #e5e5e5) !important;
  transition: all 0.2s ease !important;
}
@media(hover:hover) {
  .storefront-container .sf-btn-outline-secondary:hover {
    background-color: var(--theme-button-secondary-bg, #e5e5e5) !important;
    transform: translateY(-1px) !important;
  }
}
.storefront-container .sf-btn-outline-secondary:active {
  transform: scale(0.93) !important;
  filter: brightness(0.88) !important;
  transition: transform 0.08s !important;
}
```

### Regras de Feedback Visual (v8.5.1)

| Regra | Valor |
|-------|-------|
| **Hover (desktop)** | `translateY(-1px)`, `brightness(1.1)`, `box-shadow: 0 2px 8px` — protegido por `@media(hover:hover)` |
| **Active (touch + click)** | `scale(0.93)`, `brightness(0.88)`, `box-shadow: inset 0 2px 4px` — sempre ativo |
| **Transição hover** | `all 0.2s ease` |
| **Transição active** | `transform 0.08s` (rápida para feedback imediato) |
| **Tap highlight** | `-webkit-tap-highlight-color: transparent` (evita flash azul em mobile) |

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
| ProductCard "Adicionar" | `sf-btn-secondary border` | `ProductCard.tsx` |
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

## Configurações do Tema — Catálogo Completo de Funções

> **Arquivo principal:** `src/components/builder/ThemeSettingsPanel.tsx`
> **Acesso:** Builder → Barra lateral → Botão ⚙️ "Configurações do tema"

O painel de configurações do tema é organizado em **9 seções** acessíveis via menu lateral:

| # | Seção | Componente | Salvamento | Descrição |
|---|-------|-----------|------------|-----------|
| 1 | Páginas | `PagesSettings.tsx` → `PageSettingsContent.tsx` | Draft (botão Salvar) | Configurações estruturais por página |
| 2 | Cabeçalho | `HeaderSettings.tsx` | Draft (botão Salvar) | Cores, barra superior, menus, logo |
| 3 | Rodapé | `FooterSettings.tsx` | Draft (botão Salvar) | Cores, seções, imagens, newsletter |
| 4 | Carrinho Suspenso | `MiniCartSettings.tsx` | Draft (botão Salvar) | Mini-cart lateral, frete grátis, timer |
| 5 | Popup Newsletter | `PopupSettings.tsx` | Draft (botão Salvar) | Popup de captura de leads |
| 6 | Cores | `ColorsSettings.tsx` | Draft (botão Salvar) | Paleta de cores global do tema |
| 7 | Tipografia | `TypographySettings.tsx` | Draft (botão Salvar) | Fontes e tamanho base |
| 8 | CSS customizado | `CustomCSSSettings.tsx` | Draft (botão Salvar) | CSS livre com validação |

---

### 1. Páginas (PagesSettings → PageSettingsContent)

Lista de páginas configuráveis. Ao clicar, navega para a página no canvas e abre suas configurações.

| Página | ID | Tem Settings? | Descrição |
|--------|----|--------------|-----------|
| Página Inicial | `home` | ✅ | SEO e configurações gerais |
| Categoria | `category` | ✅ | Banner, nome e avaliações |
| Produto | `product` | ✅ | Galeria, compre junto, avaliações |
| Carrinho | `cart` | ✅ | Frete, cupom, cross-sell |
| Checkout | `checkout` | ✅ | Timeline, order bump, depoimentos |
| Obrigado | `thank_you` | ✅ | Upsell e WhatsApp |
| Minha Conta | `account` | ❌ | Área do cliente |
| Pedidos | `account_orders` | ❌ | Lista de pedidos |
| Pedido | `account_order_detail` | ❌ | Detalhe do pedido |
| Rastreio | `tracking` | ✅ | Formulário de rastreio |
| Blog | `blog` | ✅ | Listagem de posts |

---

#### 1.1 Página Inicial (home)

| Campo | Tipo | Descrição | Comportamento |
|-------|------|-----------|---------------|
| `seo_title` | Input texto | Título SEO da home | Máx 60 caracteres, exibe contador |
| `seo_description` | Textarea | Descrição SEO da home | Máx 160 caracteres, exibe contador |
| **Botão "Gerar com IA"** | Ação | Gera título e descrição SEO automaticamente | Usa IA baseada nas informações do negócio (tipo de loja, produtos principais, nicho) para gerar SEO otimizado |

---

#### 1.2 Categoria (category) — Grupos: structure, buttons

**Grupo: Configurações estruturais da página**

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showCategoryName` | Toggle | `true` | Exibir nome da categoria | Mostra/oculta o título da categoria na página |
| `showBanner` | Toggle | `true` | Exibir banner da categoria | Mostra/oculta o banner de imagem da categoria |
| `bannerOverlayOpacity` | Slider (0-100) | `0` | Escurecimento do banner | Controla a opacidade do overlay escuro sobre o banner (0=sem escurecer, 100=preto) |
| `showRatings` | Toggle | `true` | Mostrar avaliações nos produtos | Exibe estrelas de avaliação nas thumbs de produtos |
| `showBadges` | Toggle | `true` | Mostrar selos nos produtos | Exibe selos configurados no submódulo "Aumentar Ticket" (dentro de Marketing Básico) |

**Grupo: Botões da Thumb**

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showAddToCartButton` | Toggle | `true` | Exibir "Adicionar ao carrinho" | Mostra botão secundário "Adicionar ao carrinho" na thumb |
| `quickBuyEnabled` | Toggle | `false` | Ativar compra rápida | Quando ativada, ao clicar no CTA principal "Comprar agora" em QUALQUER lugar da loja (grids, página produto, categorias), direciona o cliente direto ao checkout. Se desativado, segue para o carrinho conforme regras configuradas |
| `customButtonEnabled` | Toggle | `false` | Botão personalizado | Adiciona um botão extra na thumb do produto |
| ↳ `customButtonText` | Input | `""` | Texto do botão | Texto exibido no botão personalizado (aparece quando `customButtonEnabled=true`) |
| ↳ `customButtonColor` | Color picker | `""` | Cor do botão | Cor de fundo do botão personalizado |
| ↳ `customButtonLink` | Input URL | `""` | URL do botão | Link de destino ao clicar |
| `buyNowButtonText` | Input | `"Comprar agora"` | Texto do botão principal | Texto exibido no CTA principal de todos os grids |

---

#### 1.3 Produto (product) — Lista simples (sem grupos)

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showGallery` | Toggle | `true` | Mostrar Galeria | Exibe galeria de imagens secundárias do produto |
| `showDescription` | Toggle | `true` | Mostrar Descrição | Exibe a descrição curta do produto |
| `showVariants` | Toggle | `true` | Mostrar variações | Exibe seletor de variantes (cor, tamanho, etc.) |
| `showStock` | Toggle | `true` | Mostrar Estoque | Exibe quantidade disponível em estoque (hookado do estoque real do cadastro) |
| `showShippingCalculator` | Toggle | `true` | Calculadora de frete | Cálculo de frete por CEP na página do produto |
| `showRelatedProducts` | Toggle | `true` | Mostrar Produtos Relacionados | Exibe grid de produtos relacionados |
| ↳ `relatedProductsTitle` | Input | `"Produtos Relacionados"` | Título da seção | Texto do título da seção de relacionados |
| `showBuyTogether` | Toggle | `true` | Mostrar Compre Junto | Exibe seção "Compre Junto" — configuração definida no submódulo "Aumentar Ticket" (dentro de Marketing Básico) |
| `showReviews` | Toggle | `true` | Mostrar Avaliações | Exibe avaliações e formulário de avaliação |
| `showBadges` | Toggle | `true` | Mostrar Selos | Exibe selos configurados no submódulo "Aumentar Ticket" (dentro de Marketing Básico) |
| `showAdditionalHighlight` | Toggle | `false` | Destaque adicional | Exibe até 3 mini-banners clicáveis que direcionam para a categoria configurada |
| ↳ Mobile images | Upload | `[]` | Mini-banners Mobile (768×200px) | Até 3 imagens responsivas para mobile |
| ↳ Desktop images | Upload | `[]` | Mini-banners Desktop (400×150px) | Até 3 imagens responsivas para desktop |
| `showWhatsAppButton` | Toggle | `true` | Mostrar botão WhatsApp | Exibe botão "Comprar pelo WhatsApp" |

**Seção: Ação do Carrinho** (após Separator)

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `cartActionType` | Toggle + Radio | `"miniCart"` | Ativar ação do carrinho | O que acontece ao clicar em "Adicionar ao carrinho" |
| ↳ `miniCart` | Radio | selecionado | Carrinho Suspenso | Abre o mini-carrinho lateral |
| ↳ `goToCart` | Radio | — | Ir para Carrinho | Redireciona para a página do carrinho |
| ↳ `none` (desativado) | — | — | Desativado | Apenas mostra "Adicionado" no botão |
| `showAddToCartButton` | Toggle | `true` | Mostrar "Adicionar ao carrinho" | Obrigatório quando ação está ativa (forçado `true` quando `cartActionType !== 'none'`) |

---

#### 1.4 Carrinho (cart) — Grupos: features, offers, banner, colors

**Grupo: Funcionalidades**

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `shippingCalculatorEnabled` | Toggle | `true` | Calculadora de frete | Permite calcular frete antes do checkout |
| `couponEnabled` | Toggle | `true` | Cupom de desconto | Exibe campo para aplicar cupom |

**Grupo: Ofertas**

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showCrossSell` | Toggle | `true` | Mostrar Cross-sell | Sugestões de produtos configuradas no submódulo "Aumentar Ticket > Cross-sell" (dentro de Marketing Básico) |

**Grupo: Banner Promocional**

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `bannerDesktopEnabled` | Toggle | `false` | Banner Desktop | Banner 1920×250px. Quando ativo, exibe upload (URL ou arquivo, máx 5MB) |
| `bannerMobileEnabled` | Toggle | `false` | Banner Mobile | Banner 768×200px. Quando ativo, exibe upload |
| ↳ `bannerLink` | Input URL | `""` | Link do banner (opcional) | URL para onde o banner redireciona ao clicar |
| ↳ `bannerDisplay` | Radio | `"cart_page"` | Onde exibir o banner | Opções: Somente na página do carrinho / Somente no carrinho lateral / Ambos |

**Grupo: Cores Personalizadas** (color pickers especiais)

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `buttonPrimaryBg` | Color picker | `""` | 🔵 Botão Primário > Fundo | Cor de fundo do botão primário (sobrescreve tema) |
| `buttonPrimaryText` | Color picker | `""` | 🔵 Botão Primário > Texto | Cor do texto do botão primário |
| `buttonPrimaryHover` | Color picker | `""` | 🔵 Botão Primário > Hover | Cor de fundo ao passar o mouse |
| `buttonSecondaryBg` | Color picker | `""` | ⚪ Botão Secundário > Fundo | Cor de fundo do botão secundário |
| `buttonSecondaryText` | Color picker | `""` | ⚪ Botão Secundário > Texto | Cor do texto do botão secundário |
| `buttonSecondaryHover` | Color picker | `""` | ⚪ Botão Secundário > Hover | Cor de fundo hover do botão secundário |
| **Limpar todas** | Botão link | — | Limpar todas e usar cores do tema | Reseta todas as cores personalizadas para herdar do tema |

---

#### 1.5 Checkout (checkout) — Grupos: features, payment, offers, pixels, colors

**Grupo: Funcionalidades**

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `couponEnabled` | Toggle | `true` | Cupom de desconto | Exibe campo para aplicar cupom no checkout |
| `testimonialsEnabled` | Toggle | `true` | Depoimentos | Exibe depoimentos de clientes (configurados de forma personalizada e individual AQUI MESMO nas configurações — NÃO são os mesmos de "Avaliações") |
| ↳ **Gerenciar Depoimentos** | `TestimonialsManagerCompact` | — | Gerenciador inline | Quando ativo, exibe gerenciador inline para cadastrar/editar depoimentos específicos do checkout |
| `showTimeline` | Toggle | `true` | Timeline de etapas | Mostra progresso do checkout (Contato > Entrega > Pagamento) usando cores personalizadas |
| `showTrustBadges` | Toggle | `true` | Selos de confiança | Exibe selos de confiança (ex: compra segura, satisfação garantida) no checkout |
| `showSecuritySeals` | Toggle | `true` | Selos de segurança | Exibe selos de segurança (ex: SSL, pagamento protegido) no checkout |

**Grupo: Formas de Pagamento** (componente especial `PaymentMethodsConfig`)

| Funcionalidade | Descrição |
|----------------|-----------|
| Reordenação drag-and-drop | Permite alterar a ordem de exibição das formas de pagamento no checkout |
| Labels personalizados | Permite alterar o nome exibido para cada forma de pagamento |
| **NÃO controla ativação/desativação** | A ativação das formas de pagamento é feita no módulo principal > Integrações > Pagamentos |

**Grupo: Visibilidade de Formas de Pagamento**

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showPix` | Toggle | `true` | Exibir PIX | Controla se a opção PIX aparece no seletor de pagamento do checkout |
| `showBoleto` | Toggle | `true` | Exibir Boleto | Controla se a opção Boleto aparece no seletor de pagamento do checkout |
| `showCreditCard` | Toggle | `true` | Exibir Cartão de Crédito | Controla se a opção Cartão de Crédito aparece no seletor de pagamento do checkout |

> **Nota:** Estes toggles controlam apenas a **visibilidade** no UI do checkout. A **ativação/desativação** real das formas de pagamento continua sendo feita em Integrações > Pagamentos.

**Grupo: Ofertas**

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showOrderBump` | Toggle | `true` | Mostrar Order Bump | Oferta adicional no checkout — configurado no submódulo "Aumentar Ticket" (dentro de Marketing Básico) |

**Grupo: Pixels de Marketing**

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `purchaseEventAllOrders` | Toggle | `true` | Evento em todos os pedidos | **Ativado:** dispara evento Purchase para QUALQUER pedido gerado (inclusive boletos e pedidos não pagos). **Desativado:** dispara somente após confirmação de pagamento |

**Grupo: Cores Personalizadas** (color pickers especiais)

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `buttonPrimaryBg` | Color picker | `""` | 🔵 Botão Primário > Fundo | Sobrescreve cor do tema apenas no checkout |
| `buttonPrimaryText` | Color picker | `""` | 🔵 Botão Primário > Texto | Sobrescreve texto do botão primário |
| `buttonPrimaryHover` | Color picker | `""` | 🔵 Botão Primário > Hover | Sobrescreve hover do botão primário |
| `flagsColor` | Color picker | `""` | 🏷️ Flags / Tags > Cor | Cor das tags como "Grátis", "Frete Grátis", badges de desconto. Injetada via `--theme-flags-color` |
| **Limpar todas** | Botão link | — | Limpar todas e usar cores do tema | Reseta cores personalizadas do checkout |

---

#### 1.6 Obrigado (thank_you) — Lista simples

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showUpsell` | Toggle | `true` | Mostrar Upsell | Ofertas pós-compra |
| `showWhatsApp` | Toggle | `true` | Mostrar WhatsApp | Link para suporte via WhatsApp |
| `showSocialShare` | Toggle | `false` | Compartilhamento Social | Botões para compartilhar a compra em redes sociais |

---

#### 1.7 Rastreio (tracking) — Lista simples

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showTitle` | Toggle | `true` | Mostrar título | Exibe título na página de rastreio |
| `showDescription` | Toggle | `true` | Mostrar descrição | Exibe descrição na página de rastreio |

---

#### 1.8 Blog (blog) — Lista simples

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showExcerpt` | Toggle | `true` | Mostrar resumo | Exibe resumo/excerpt dos posts |
| `showImage` | Toggle | `true` | Mostrar imagem | Exibe imagem de capa dos posts |
| `showTags` | Toggle | `true` | Mostrar tags | Exibe tags associadas aos posts |
| `showPagination` | Toggle | `true` | Mostrar paginação | Exibe controles de paginação |

---

### 2. Cabeçalho (HeaderSettings)

> **Salvamento:** Auto-save com debounce 400ms (switches imediato).

#### Seção: Cores

| Setting | Tipo | Default | Label |
|---------|------|---------|-------|
| `headerBgColor` | Color picker | `""` (herda tema) | Cor de Fundo |
| `headerTextColor` | Color picker | `""` | Cor do Texto |
| `headerIconColor` | Color picker | `""` | Cor dos Ícones |

#### Seção: Barra Superior (Notice Bar)

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `noticeEnabled` | Toggle | `false` | Exibir Barra Superior | Ativa/desativa barra de aviso no topo |
| `noticeAnimation` | Select | `"fade"` | Efeito de Animação | Opções: Nenhuma (estático), Fade (suave), Slide Vertical, Slide Horizontal, Marquee (rolagem contínua) |
| `noticeText` | Input | `""` | Texto do Aviso | Texto único (para marquee ou estático) |
| `noticeTexts` | Array de inputs | `[]` | Frases (alternam automaticamente) | Múltiplas frases para modos Fade/Slide (botão "+ Adicionar Frase") |
| `noticeBgColor` | Color picker | `""` | Cor de Fundo | Herda do tema se vazio |
| `noticeTextColor` | Color picker | `""` | Cor do Texto | Herda do tema se vazio |
| `noticeLinkEnabled` | Toggle | `false` | Exibir Link | Adiciona link clicável na barra |
| ↳ `noticeLinkLabel` | Input | `"Clique Aqui"` | Texto do Link | |
| ↳ `noticeLinkUrl` | Input | `""` | URL do Link | |
| ↳ `noticeLinkColor` | Color picker | `"#60a5fa"` | Cor do Link | |

#### Seção: Visual Menus

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `menuVisualStyle` | Select | `"classic"` | Estilo do Dropdown | Clássico (setas/cabeçalhos), Elegante (animações suaves/fade), Minimalista (limpo, sem bordas) |
| `menuShowParentTitle` | Toggle | `true` | Exibir Título da Categoria | Mostra o nome da categoria no topo do dropdown |

#### Seção: Configurações Gerais

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `logoSize` | Select | `"medium"` | Tamanho da Logo | Pequeno (32px), Médio (40px), Grande (56px) |
| `navBarHeight` | Select | `"medium"` | Altura da Extensão (Navegação) | Pequeno (32px), Médio (40px), Grande (52px) |
| `stickyOnMobile` | Toggle | `true` | Fixar ao rolar (Mobile) | Header fixo no mobile |
| `sticky` | Toggle | `true` | Fixo no Topo (Desktop) | Header fixo no desktop |
| `showSearch` | Toggle | `true` | Mostrar Busca | Exibe campo de busca |
| `showCart` | Toggle | `true` | Mostrar Carrinho | Exibe ícone do carrinho |
| `customerAreaEnabled` | Toggle | `false` | Exibir "Minha Conta" | Exibe link para área do cliente |
| `featuredPromosEnabled` | Toggle | `false` | Exibir Promoções em Destaque | Adiciona link de promoções no header |
| ↳ `featuredPromosLabel` | Input | `""` | Label do Link | Ex: "🔥 Promoções" |
| ↳ `featuredPromosTarget` | Select | `""` | Destino | Seleciona categoria ou página institucional como destino |
| ↳ `featuredPromosTextColor` | Color picker | `""` | Cor do Texto | |
| ↳ `featuredPromosBgColor` | Color picker | `""` | Cor do Destaque | |
| ↳ `featuredPromosThumbnail` | Upload imagem | `""` | Miniatura (Desktop) | Mini-banner de "Categoria em Destaque" — exibido ao passar o mouse no link de promoções no desktop. Já funcional. Recomendado: 240×96px |

---

### 3. Rodapé (FooterSettings)

> **Salvamento:** Auto-save com debounce 400ms (switches imediato).

#### Seção: Cores do Rodapé

| Setting | Tipo | Default | Label |
|---------|------|---------|-------|
| `footerBgColor` | Color picker | `""` | Cor de Fundo |
| `footerTextColor` | Color picker | `""` | Cor do Texto |
| `footerTitlesColor` | Color picker | `""` | Cor dos Títulos |

#### Seção: Seções do Rodapé

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showLogo` | Toggle | `true` | Mostrar Logo | Exibe logo no rodapé |
| `showStoreInfo` | Toggle | `true` | Mostrar Informações da Loja | Exibe nome, CNPJ e descrição |
| `showSac` | Toggle | `true` | Mostrar Atendimento (SAC) | Exibe seção de contato |
| `showSocial` | Toggle | `true` | Mostrar Redes Sociais | Exibe links das redes sociais |
| `showCopyright` | Toggle | `true` | Mostrar Copyright | Exibe texto de direitos autorais |

#### Seção: Visual Menus

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `menuVisualStyle` | Select | `"classic"` | Estilo dos Links | Clássico (sublinhado no hover), Elegante (mudança de cor), Minimalista (apenas opacidade) |
| `badgeSize` | Select | `"medium"` | Tamanho dos Selos | Pequeno (24/32px), Médio (32/40px), Grande (40/48px). Bandeiras de pagamento são 30% menores |

#### Seção: Formas de Pagamento (`paymentMethods`)

| Funcionalidade | Descrição |
|----------------|-----------|
| Título da seção | Input texto para o título exibido |
| Lista de itens | Cada item tem: Imagem (upload ou SVG preset "payment") + Link opcional |
| Quick Select | Seleção rápida de ícones de pagamento pré-definidos |
| Adicionar/Remover | Botões para gerenciar lista de bandeiras |

#### Seção: Selos de Segurança (`securitySeals`)

| Funcionalidade | Descrição |
|----------------|-----------|
| Título + Lista de itens | Imagem (upload ou SVG preset "security") + Link opcional |

#### Seção: Formas de Envio (`shippingMethods`)

| Funcionalidade | Descrição |
|----------------|-----------|
| Título + Lista de itens | Imagem (upload ou SVG preset "shipping") + Link opcional |

#### Seção: Lojas Oficiais (`officialStores`)

| Funcionalidade | Descrição |
|----------------|-----------|
| Título + Lista de itens | Locais onde o usuário pode adicionar links externos para outros canais de venda (marketplaces, etc). Cada item tem Imagem + Link **obrigatório** |

#### Seção: Newsletter do Rodapé

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showNewsletter` | Toggle | `false` | Exibir Newsletter | Ativa formulário de captura no rodapé |
| ↳ `newsletterListId` | Select (EmailListSelector) | `""` | Lista de Destino | Lista de email marketing para onde os leads serão enviados |
| ↳ `newsletterTitle` | Input | `""` | Título | Ex: "Receba nossas promoções" |
| ↳ `newsletterSubtitle` | Input | `""` | Subtítulo | |
| ↳ `newsletterPlaceholder` | Input | `""` | Placeholder do campo | Ex: "Seu e-mail" |
| ↳ `newsletterButtonText` | Input | `""` | Texto do botão | Vazio = mostra apenas ícone de envio |
| ↳ `newsletterSuccessMessage` | Input | `""` | Mensagem de sucesso | Ex: "Inscrito com sucesso!" |

#### Seção: Personalizar Títulos do Rodapé

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `sacTitle` | Input | `""` | Título Atendimento | Deixe vazio para usar "Atendimento (SAC)" |
| `footer1Title` | Input | `""` | Título Footer 1 | Primeira coluna de links (padrão: "Categorias") |
| `footer2Title` | Input | `""` | Título Footer 2 | Segunda coluna de links (padrão: "Institucional") |
| `copyrightText` | Textarea | `""` | Texto do Copyright | Deixe vazio para auto-geração com ano + nome da loja |

---

### 4. Carrinho Suspenso (MiniCartSettings)

> **Salvamento:** Auto-save com debounce 500ms (switches imediato).
> **Nota:** A ação principal do carrinho (miniCart/goToCart/none) também aparece em Produto > Ação do Carrinho.

#### Controle Principal

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `cartActionType` | Toggle + Radio | `"miniCart"` | Ação do Carrinho | none/miniCart/goToCart — O que acontece ao adicionar produto |

#### Funcionalidades do Mini-Cart (só aparecem quando `cartActionType === 'miniCart'`)

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `showFreeShippingProgress` | Toggle | `true` | Barra de Frete Grátis | Barra de progresso visual mostrando quanto falta para frete grátis. O valor vem da lógica de frete grátis individual dos produtos (marcado no cadastro) ou de cupons/configurações de frete grátis em Logística |
| `showCrossSell` | Toggle | `true` | Cross-sell (Produtos Relacionados) | Exibe produtos configurados no submódulo "Aumentar Ticket > Cross-sell" (dentro de Marketing Básico) |
| `showCoupon` | Toggle | `true` | Campo de Cupom | Exibe campo para aplicar cupom no mini-cart |
| `showShippingCalculator` | Toggle | `true` | Calculadora de Frete | Cálculo de frete por CEP dentro do mini-cart |
| `showStockReservationTimer` | Toggle | `false` | Timer de Reserva de Estoque | Exibe timer de urgência para completar a compra. É hookado de forma real do estoque dos produtos cadastrados |
| ↳ `stockReservationMinutes` | Input number | `15` | Tempo de reserva (minutos) | 1 a 60 minutos |

---

### 5. Popup Newsletter (PopupSettings)

> **Salvamento:** Auto-save com debounce 500ms. Dados em tabela `newsletter_popup_configs`.

#### Controle Principal

| Setting | Tipo | Default | Label |
|---------|------|---------|-------|
| `is_active` | Toggle | `false` | Popup Ativo — Exibir popup para visitantes |

#### Seção: Geral

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `list_id` | Select | `null` | Lista de Email | Lista de email marketing para captura de leads |
| `layout` | Select | `"centered"` | Layout | Centralizado, Com Imagem Lateral, Canto da Tela, Tela Cheia |
| `title` | Input | `"Inscreva-se na nossa newsletter"` | Título | Título do popup |
| `subtitle` | Textarea | `"Receba ofertas exclusivas..."` | Subtítulo | |
| `button_text` | Input | `"Inscrever"` | Texto do Botão | |
| `success_message` | Input | `"Obrigado por se inscrever!"` | Mensagem de Sucesso | |

#### Seção: Aparência

| Setting | Tipo | Default | Label |
|---------|------|---------|-------|
| `background_color` | Color picker | `"#ffffff"` | Fundo |
| `text_color` | Color picker | `"#000000"` | Texto |
| `button_bg_color` | Color picker | `""` | Fundo do Botão (vazio = herda tema primário) |
| `button_text_color` | Color picker | `"#ffffff"` | Texto do Botão |
| `icon_image_url` | Upload (ImageUploaderWithLibrary) | `""` | Banner (Topo do Popup) — 450×105px. Só aparece quando layout ≠ side-image |
| `image_url` | Upload (ImageUploaderWithLibrary) | `""` | Imagem Lateral — 400×600px. Só aparece quando layout = side-image |

#### Seção: Quando Exibir

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `trigger_type` | Select | `"delay"` | Gatilho | Após X segundos, Ao rolar X%, Ao sair da página (exit intent), Imediatamente |
| `trigger_delay_seconds` | Input number | `5` | Segundos de atraso | 1-60, só quando trigger=delay |
| `trigger_scroll_percent` | Input number | `50` | Porcentagem de rolagem | 1-100, só quando trigger=scroll |
| `show_on_pages` | Checkboxes | `["home","category","product"]` | Exibir nas Páginas | Página Inicial, Categoria, Produto, Carrinho, Blog |
| `show_once_per_session` | Toggle | `true` | Exibir apenas 1x por sessão | |

#### Seção: Campos do Formulário

> Email é sempre obrigatório.

| Campo | Exibir Toggle | Obrigatório Toggle | Descrição |
|-------|--------------|-------------------|-----------|
| Nome | `show_name` | `name_required` | Solicitar nome do visitante |
| Telefone | `show_phone` | `phone_required` | Solicitar telefone |
| Data de Nascimento | `show_birth_date` | `birth_date_required` | Para ofertas de aniversário |

---

### 6. Cores (ColorsSettings)

> **Salvamento:** Draft → botão "Salvar" na toolbar. Preview em tempo real via `useBuilderDraftTheme`.

#### 🔵 Botão Primário

| Setting | Label | Descrição |
|---------|-------|-----------|
| `buttonPrimaryBg` | Fundo | Botão "Comprar agora", "Adicionar ao carrinho", "Finalizar pedido" |
| `buttonPrimaryText` | Texto | Texto dentro dos botões primários |
| `buttonPrimaryHover` | Hover | Cor de fundo ao passar o mouse |

#### ⚪ Botão Secundário

| Setting | Label | Descrição |
|---------|-------|-----------|
| `buttonSecondaryBg` | Fundo | Botões "Cancelar", "Voltar", "Ver detalhes" e ações secundárias |
| `buttonSecondaryText` | Texto | Texto dentro dos botões secundários |
| `buttonSecondaryHover` | Hover | Cor de fundo ao passar o mouse |

#### 💬 Botão WhatsApp

| Setting | Label | Descrição |
|---------|-------|-----------|
| `whatsappColor` | Cor Principal | Cor da borda e texto do botão "Comprar pelo WhatsApp" |
| `whatsappHover` | Hover | Cor de fundo ao passar o mouse sobre o botão WhatsApp |

#### 📝 Textos e Destaque

| Setting | Label | Descrição |
|---------|-------|-----------|
| `accentColor` | Cor de Destaque | Ícones de check, setas, indicadores de etapas, links, "Grátis" e detalhes da interface |
| `textPrimary` | Texto Principal | Títulos, nomes de produtos e textos de destaque |
| `textSecondary` | Texto Secundário | Descrições, legendas, informações de frete e textos auxiliares |

#### 💰 Valor Principal

| Setting | Label | Descrição |
|---------|-------|-----------|
| `priceColor` | Cor valor principal | Cor exclusiva do preço com desconto (valor final). Aplicado em grids, categorias, página do produto, etc. |

#### 🏷️ Tags Especiais

| Setting | Label | Descrição |
|---------|-------|-----------|
| `successBg` / `successText` | Tags Sucesso | Tags "Grátis", "Frete Grátis", "5% OFF", indicadores positivos |
| `warningBg` / `warningText` | Tags Destaque | Tags "Mais Vendido", "Novo", "Promoção" |
| `dangerBg` / `dangerText` | Tags Desconto | Tags "-37%", "Últimas unidades", alertas |
| `highlightBg` / `highlightText` | Tags Info | Tags informativos, badges de categoria |

> **Preview interativo:** O painel inclui preview de botões com hover, cor de destaque, textos e tags.

---

### 7. Tipografia (TypographySettings)

> **Salvamento:** Draft → botão "Salvar" na toolbar. Preview em tempo real via `useBuilderDraftTheme`.

| Setting | Tipo | Default | Label | Descrição |
|---------|------|---------|-------|-----------|
| `headingFont` | Select (31 fontes) | `"inter"` | Fonte dos títulos | Usada em H1, H2, H3 e títulos de seções |
| `bodyFont` | Select (31 fontes) | `"inter"` | Fonte do corpo | Usada em parágrafos, botões e textos gerais |
| `baseFontSize` | Slider (12-20) | `16` | Tamanho base | Tamanho padrão do texto (afeta proporcionalmente outros tamanhos) |

**Fontes disponíveis:** Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Raleway, Source Sans Pro, Ubuntu, Mulish, Work Sans, Quicksand, DM Sans, Manrope, Outfit, Plus Jakarta Sans, Playfair Display, Merriweather, Lora, PT Serif, Crimson Text, Libre Baskerville, Cormorant Garamond, EB Garamond, Bitter, Abril Fatface, Bebas Neue, Oswald, Josefin Sans, Righteous.

> **Preview interativo:** O painel inclui preview com título + parágrafo nas fontes selecionadas.

---

### 8. CSS Customizado (CustomCSSSettings)

> **Salvamento:** Draft → botão "Salvar" na toolbar. Preview em tempo real via `useBuilderDraftTheme`.

| Funcionalidade | Descrição |
|----------------|-----------|
| Textarea CSS | Editor de CSS livre com `min-height: 200px`, fonte mono |
| Validação | Verifica balanceamento de `{` e `}` em tempo real. Exibe ✅ Válido ou ❌ Erro de sintaxe |
| Prefixo obrigatório | `.storefront-container` para garantir escopo correto |
| Exemplo copiável | Exemplo com botões de compra e espaçamento de seções |
| Aviso de segurança | "CSS customizado pode afetar o funcionamento da loja. Teste suas alterações no preview antes de publicar." |

---

### Respostas às Dúvidas Específicas (Referência)

| # | Dúvida | Resposta Documentada |
|---|--------|---------------------|
| 1 | Barra Frete Grátis | Barra de progresso visual. Valor vem de frete grátis individual do produto ou cupom/config de logística |
| 2 | Timer Reserva Estoque | Hookado do estoque real dos produtos |
| 3 | Cross-sell | Configurado em Aumentar Ticket > Cross-sell (Marketing Básico) |
| 4 | Purchase Event todos pedidos | Sim, quando ativo dispara para qualquer pedido inclusive boletos não pagos |
| 5 | Order Bump | Configurado em Aumentar Ticket (Marketing Básico) |
| 6 | Depoimentos checkout | Separados, configurados inline nas configurações do tema > páginas > checkout |
| 7 | Selos (Aumentar Ticket) | Submódulo dentro do módulo principal "Marketing Básico" |
| 8 | Destaque adicional | Mini-banners clicáveis, direcionam para categoria configurada |
| 9 | Compre Junto | Configurado no submódulo Aumentar Ticket |
| 10 | Compra rápida | CTA "Comprar agora" em qualquer lugar da loja direciona ao checkout direto |
| 11 | Miniatura promoções | É o mini-banner de "Categoria em Destaque" no header. Ao passar o mouse no link de promoções (desktop only), a miniatura aparece. Já está funcional. Recomendado: 240×96px |
| 12 | Lojas Oficiais | Links externos para outros canais de venda (marketplaces, etc.) |
| 13 | Exit intent | Gatilho do popup newsletter — detecta quando o cliente move o cursor para fora da viewport (indo em direção ao "X" para fechar o navegador/aba). Dispara o popup nesse momento como última tentativa de captura |
| 14 | Gerar com IA (SEO) | Baseado nas informações do negócio (tipo de loja, produtos, nicho) |
| 15 | Formas de pagamento checkout | Apenas visual (reorder + labels). Ativação em Integrações > Pagamentos |

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

## Sistema de Salvamento — Modelo Único Draft (v8.5.0)

> **Atualizado em:** 2026-03-09

O builder utiliza **um único modelo de salvamento** para TODAS as configurações:

### Draft + Salvamento Manual (botão "Salvar")

Usado por: **TODAS as configurações do builder** (Cores, Tipografia, CSS, Configurações de Página, Cabeçalho, Rodapé, Carrinho Suspenso, Popup Newsletter)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  SALVAMENTO MANUAL (Draft System)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  • Alterações ficam em estado LOCAL (draft) até clicar Salvar           │
│  • Cores/Tipografia/CSS → useBuilderDraftTheme                         │
│  • Configurações de Página → useBuilderDraftPageSettings               │
│  • Header/Footer → useThemeHeader/useThemeFooter (draftUpdates local)  │
│  • MiniCart → useThemeMiniCart (draftUpdates local + globalRef)         │
│  • Popup → PopupSettings (hasDraftChanges local + globalRef)           │
│  • Botão "Salvar" fica habilitado quando há drafts pendentes           │
│  • Ao sair sem salvar, alterações são PERDIDAS (clearDraft)            │
│  • isDirty = store.isDirty || themeDraft || pageDraft || headerDraft   │
│             || footerDraft || miniCartDraft || popupDraft              │
│  • Popup salva em newsletter_popup_configs (tabela separada)           │
│  • Demais salvam em storefront_template_sets.draft_content.themeSettings│
│  • Para refletir no PÚBLICO, o usuário deve clicar "Publicar"           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Regra Universal: NENHUM auto-save no builder

**PROIBIDO** usar auto-save/debounce direto ao banco em qualquer configuração do builder. Todas as alterações devem:
1. Atualizar estado local (draft) para preview em tempo real
2. Ativar o botão "Salvar" via isDirty
3. Persistir no banco SOMENTE quando o usuário clica "Salvar"
4. Ser descartadas se o usuário sair sem salvar

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

---

## Compiladores Edge — Inventário

> Lista de todos os block-compilers em `supabase/functions/_shared/block-compiler/blocks/`.

### ✅ Compiladores Prontos (40 total)

| Bloco | Arquivo | Fase |
|-------|---------|------|
| Page | `page.ts` | Base |
| Section | `section.ts` | Base |
| Container | `container.ts` | 1 |
| Columns + Column | `columns.ts`, `column.ts` | 1 |
| Grid | `grid.ts` | 1 |
| Text | `text.ts` | Base |
| RichText | `rich-text.ts` | Base |
| Image | `image.ts` | Base |
| Button | `button.ts` | Base |
| Spacer | `spacer.ts` | Base |
| Divider | `divider.ts` | Base |
| HeroBanner | `hero-banner.ts` | Base |
| Banner | `banner.ts` | Base |
| ImageCarousel | `image-carousel.ts` | Base |
| InfoHighlights | `info-highlights.ts` | Base |
| FeaturedCategories | `featured-categories.ts` | Base |
| FeaturedProducts | `featured-products.ts` | Base |
| CategoryBanner | `category-banner.ts` | Base |
| CategoryPageLayout | `category-page-layout.ts` | Base |
| ProductDetails | `product-details.ts` | Base |
| FAQ | `faq.ts` | 2 |
| Testimonials | `testimonials.ts` | 2 |
| AccordionBlock | `accordion.ts` | 2 |
| Newsletter / NewsletterForm | `newsletter.ts` | 2 |
| Reviews | `reviews.ts` | 2 |
| YouTubeVideo | `youtube-video.ts` | 3 |
| VideoCarousel | `video-carousel.ts` | 3 |
| VideoUpload | `video-upload.ts` | 3 |
| HTMLSection | `html-section.ts` | 3 |
| ImageGallery | `image-gallery.ts` | 3 |
| CountdownTimer | `countdown-timer.ts` | 4 |
| LogosCarousel | `logos-carousel.ts` | 4 |
| StatsNumbers | `stats-numbers.ts` | 4 |
| ContentColumns | `content-columns.ts` | 4 |
| FeatureList | `feature-list.ts` | 4 |
| StepsTimeline | `steps-timeline.ts` | 4 |
| TextBanners | `text-banners.ts` | 4 |
| Header | Standalone (`storefront-html`) | — |
| Footer | Standalone (`storefront-html`) | — |
| Blog / Institucional | Standalone (`storefront-html`) | — |

### Detalhes dos Compiladores Fase 2 (Interativos)

- **FAQ** (`faq.ts`): HTML nativo `<details>/<summary>`, zero JS. Respeita ícone e estilo de borda.
- **Testimonials** (`testimonials.ts`): Grid responsivo (1→2→3 cols). Estrelas SVG. Imagens otimizadas via wsrv.nl.
- **AccordionBlock** (`accordion.ts`): Variantes `default`, `separated`, `bordered`. Suporta `defaultOpen`.
- **Newsletter** (`newsletter.ts`): 3 layouts (horizontal, vertical, card). Atributos `data-sf-newsletter` para hidratação JS.
- **Reviews** (`reviews.ts`): Carrossel de avaliações com estrelas SVG. Scroll horizontal com setas de navegação. Links para produtos com imagens opcionais.

### Detalhes dos Compiladores Fase 3 (Mídia)

- **YouTubeVideo** (`youtube-video.ts`): iframe responsivo com aspect ratio configurável (16:9, 4:3, 1:1).
- **VideoCarousel** (`video-carousel.ts`): Primeiro vídeo embed + thumbnails dos demais. Hidratação via `data-sf-video-carousel`.
- **VideoUpload** (`video-upload.ts`): Tag `<video>` nativa com fontes desktop/mobile via media query. Suporta autoplay, loop, muted, controls. Aspect ratio e object-fit configuráveis.
- **HTMLSection** (`html-section.ts`): HTML sanitizado inline (remove `<script>`, event handlers, `javascript:` URLs). CSS scoped via `<style>`.
- **ImageGallery** (`image-gallery.ts`): Grid responsivo (2→3→4 cols). Imagens otimizadas. Hover effects CSS.

### Detalhes dos Compiladores Fase 4 (Marketing)

- **CountdownTimer** (`countdown-timer.ts`): Server-render + hidratação JS via `data-sf-countdown`. Mostra dias/horas/min/seg. CTA opcional.
- **LogosCarousel** (`logos-carousel.ts`): Grid responsivo de logos. Suporta grayscale e links. Imagens otimizadas.
- **StatsNumbers** (`stats-numbers.ts`): Layout horizontal ou grid. Animação de números via JS IntersectionObserver. Cor de destaque do tema.
- **ContentColumns** (`content-columns.ts`): Imagem + texto lado a lado. Lista de features com ícones SVG. Posição da imagem configurável.
- **FeatureList** (`feature-list.ts`): Lista vertical com ícones SVG. Cor do ícone herda do tema. CTA opcional.
- **StepsTimeline** (`steps-timeline.ts`): Layout horizontal ou vertical. Círculos numerados. Linha de conexão SVG.
- **TextBanners** (`text-banners.ts`): Texto + 2 imagens lado a lado. Layout text-left/text-right. CTA com sf-btn-primary.

### Detalhes dos Compiladores Fase 5 (E-commerce Avançados)

- **ProductGrid** (`product-grid.ts`): Grid de produtos com colunas configuráveis (desktop/mobile). Usa `renderProductCard` compartilhado. Fonte: all, featured, category.
- **ProductCarousel** (`product-carousel.ts`): Scroll horizontal com snap. Setas de navegação desktop. Cards via `renderProductCard`.
- **CategoryList** (`category-list.ts`): Grid ou lista de categorias. Suporta source custom (items ordenados) ou auto. Imagem + descrição opcionais.
- **CollectionSection** (`collection-section.ts`): Título + "Ver todos" + grid/carousel de produtos. Link para categoria via slug.
- **BannerProducts** (`banner-products.ts`): Banner imagem + grid de produtos lado a lado. Source manual (IDs) ou category. CTA opcional.

### Utilitário Compartilhado

- **product-card-html.ts** (`blocks/shared/`): Função `renderProductCard()` reutilizável. Renderiza badges, ratings, preços, botões add-to-cart/buy-now com `data-sf-action`. Mesma estrutura visual do `featured-products.ts`.

### Detalhes da Fase 6 (Injeções Globais no storefront-html v8.3.0)

#### Marketing Pixels (`generateMarketingPixelScripts`)
- **Fonte de dados**: Tabela `marketing_integrations` (query por `tenant_id`)
- **Pixels suportados**: Meta (Facebook), Google Analytics/Ads, TikTok
- **Carregamento**: Deferred via `requestIdleCallback` (fallback `setTimeout 2000ms`)
- **DNS Prefetch**: `connect.facebook.net`, `googletagmanager.com`, `analytics.tiktok.com`
- **Guard**: `window._sfPixelsLoaded=true` previne duplicação na hidratação SPA
- **Consent**: Integrado com banner LGPD — pixels só disparam se aceito

#### Newsletter Popup (`generateNewsletterPopupHtml`)
- **Fonte de dados**: Tabela `newsletter_popup_configs` (query por `tenant_id`, `is_active=true`)
- **Triggers suportados**: `immediate`, `delay` (configurable seconds), `scroll` (configurable %), `exit_intent`
- **Layouts**: `centered` (modal central), `side-image` (imagem lateral), `corner` (canto inferior direito)
- **Campos opcionais**: Nome (`show_name`), telefone (`show_phone`) com `required` configurável
- **Filtro de páginas**: `show_on_pages` array (home, category, product, blog, other)
- **Submissão**: POST direto para edge function `newsletter-subscribe` com `source: "popup"`
- **Sessão**: `sessionStorage` key `sf_newsletter_dismissed` para `show_once_per_session`

#### Consent Banner LGPD (`generateConsentBannerHtml`)
- **Ativação**: Renderizado quando `marketing_integrations.consent_mode_enabled = true`
- **Persistência**: `localStorage` key `sf_cookie_consent` (valor: `accept` | `reject`)
- **Integração gtag**: Na aceitação, atualiza `analytics_storage` e `ad_storage` para `granted`
- **Link**: Aponta para `/page/politica-de-privacidade`
- **Z-index**: 100 (acima do popup que é 95)

---

## Regras Globais de Compilação Builder ↔ Storefront (v8.2.3)

> **REGRA CRÍTICA:** Estas invariantes devem ser respeitadas em TODOS os block-compilers.

### Cores e Tipografia

| Elemento | Variável/Cor | Regra |
|----------|-------------|-------|
| body text | `#1a1a1a` | **NUNCA** usar `--theme-text-primary` no body — causa "theme bleeding" |
| Títulos (h2, h3) | `color: inherit` | Herda da seção pai, não força cor |
| Nomes de produto/categoria | `color: inherit` | Idem |
| Preços | `var(--theme-price-color, var(--theme-text-primary, #1a1a1a))` | Única exceção — preço pode usar theme vars |
| Filtros/labels de UI | `#1a1a1a` / `#555` / `#666` | Cores fixas, sem theme vars (evita bleed) |

### Botões

| Regra | Descrição |
|-------|-----------|
| Sem JS inline hover | Usar classes `sf-btn-primary`, `sf-btn-outline-primary`, `sf-btn-secondary` |
| Variáveis do tema | `--theme-button-primary-bg`, `--theme-button-primary-text`, `--theme-button-primary-hover` |
| Newsletter footer | Usa `sf-btn-primary` (não cor hardcoded) |

### Dropdowns e Menus

| Regra | Descrição |
|-------|-----------|
| Sem gap de hover | Usar `padding-top bridge` (não `margin-top`) para manter hover contínuo |
| Menus filtrados | Renderizar apenas itens `is_published = true` (páginas e categorias) |
| Featured promo fallback | Se `textColor == bgColor` ou `bgColor == headerBgColor`, usar primary do tema |

### Mobile Nav

| Regra | Descrição |
|-------|-----------|
| Herança de cores | Drawer herda `headerBgColor` e `headerTextColor` via style inline |
| Botão fechar | `color: inherit` (herda do container) |
| Sub-menus | Acordeão colapsável com `opacity: 0.8` para subitens |
| Seção contato | Consome `social_whatsapp`, `contact_phone`, `contact_email` de `store_settings` |

---

## Centralização de Design Tokens (Fase 7)

### Arquitetura

```
┌───────────────────────────────────────────────────────────────────┐
│              TOKENS CENTRALIZADOS (2 arquivos espelhados)         │
├───────────────────────────────────────────────────────────────────┤
│  React: src/lib/storefront-theme-utils.ts                        │
│  Edge:  supabase/functions/_shared/theme-tokens.ts               │
│                                                                    │
│  CONTRATO: Devem SEMPRE estar sincronizados                      │
└───────────────────────────────────────────────────────────────────┘
         ↓                              ↓
┌──────────────────┐          ┌──────────────────────┐
│ CONSUMIDORES React│          │ CONSUMIDORES Edge     │
│                  │          │                      │
│ usePublicTheme   │          │ storefront-html      │
│ useBuilderTheme  │          │ (v8.4.0+)            │
└──────────────────┘          └──────────────────────┘
```

### Funções Compartilhadas

| Função | React | Edge | Descrição |
|--------|-------|------|-----------|
| `FONT_FAMILY_MAP` | ✅ | ✅ | Mapa font-value → CSS font-family |
| `getFontFamily()` | ✅ | ✅ | Resolve font value com fallback Inter |
| `generateColorCssVars()` | ✅ | ✅ | Gera array de variáveis CSS de cor |
| `generateButtonCssRules()` | ✅ | ✅ | CSS de sf-btn-primary/secondary/outline |
| `generateAccentAndTagCssRules()` | ✅ | — | CSS de sf-accent-* e sf-tag-* (scoped) |
| `hexToHslValues()` | ✅ | — | Converte hex → HSL para Tailwind |
| `generateThemeCss()` | — | ✅ | CSS completo para Edge HTML |
| `getGoogleFontsData()` | — | ✅ | Google Fonts link + preload tags |

### Regras de Manutenção

1. **Alteração em variáveis CSS** → Atualizar AMBOS os arquivos
2. **Nova cor de tema** → Adicionar em `generateColorCssVars()` dos 2 arquivos
3. **Novo botão style** → Adicionar em `generateButtonCssRules()` dos 2 arquivos
4. **Nova fonte** → Adicionar em `FONT_FAMILY_MAP` E `FONT_NAME_MAP` dos 2 arquivos

---

## Inventário Completo de Blocos do Builder

> **Total de blocos no registry:** 67 (+ 2 componentes legados fora do registry)
> **Fonte de verdade:** `src/lib/builder/registry.ts`
> **Regra de nomenclatura:** Os blocos são referenciados pelo **label** (nome de navegação), com o `type` (nome técnico) entre parênteses.

### Legenda de Status

| Status | Significado |
|--------|-------------|
| 🟢 Ativo | Bloco funcional, no registry e com compilador |
| 🟡 Sistema | Bloco essencial, não removível, sem propsSchema (config via Tema > Páginas) |
| 🔵 Demo | Bloco de demonstração/preview |
| 🔴 Legado | Componente existente mas substituído ou fora do registry |

---

### 1. Blocos de Layout

#### 1.1 Página (`Page`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Layout (container raiz) |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` (definição) |
| **Contexto** | Container raiz de todas as páginas do builder |
| **Descrição** | Wrapper principal que contém todos os outros blocos de uma página |
| **Comportamento** | Renderiza children dentro de um container com cor de fundo e padding configuráveis |
| **Props** | `backgroundColor` (color, default: transparent), `padding` (select: none/sm/md/lg) |
| **Condições** | `canHaveChildren: true`, `isRemovable: false` — nunca pode ser removido |
| **Afeta** | Todos os blocos filhos herdam o contexto visual |

#### 1.2 Seção (`Section`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Layout |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Wrapper para agrupar blocos com espaçamento e alinhamento |
| **Descrição** | Seção com padding, margem, gap e cor de fundo configuráveis |
| **Props** | `backgroundColor` (color), `paddingX` (0-100px), `paddingY` (0-200px), `marginTop` (0-200px), `marginBottom` (0-200px), `gap` (0-100px), `alignItems` (stretch/flex-start/center/flex-end), `fullWidth` (boolean) |
| **Condições** | `canHaveChildren: true` |
| **Compilador** | `section.ts` (Base) |

#### 1.3 Container (`Container`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Layout |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Container com largura máxima centralizado |
| **Descrição** | Limita a largura do conteúdo com opções de sm/md/lg/xl/full |
| **Props** | `maxWidth` (select: sm=640/md=768/lg=1024/xl=1280/full), `padding` (0-100px), `marginTop` (0-200px), `marginBottom` (0-200px), `gap` (0-100px) |
| **Condições** | `canHaveChildren: true` |
| **Compilador** | `container.ts` (Fase 1) |

#### 1.4 Colunas (`Columns`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Layout |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Grid de colunas para organizar conteúdo lado a lado |
| **Descrição** | Layout em 2/3/4 colunas com opção de empilhar no mobile |
| **Props** | `columns` (select: 2/3/4), `gap` (0-100px), `stackOnMobile` (boolean, default: true), `alignItems` (stretch/flex-start/center/flex-end) |
| **Condições** | `canHaveChildren: true`, `slotConstraints.maxChildren: 4` |
| **Compilador** | `columns.ts` (Fase 1) |

#### 1.5 Divisor (`Divider`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Layout |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Separador visual horizontal entre blocos |
| **Descrição** | Linha divisória com estilo e cor configuráveis |
| **Props** | `style` (select: solid/dashed/dotted), `color` (color, default: #e5e7eb) |
| **Compilador** | `divider.ts` (Base) |

#### 1.6 Espaçador (`Spacer`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Layout |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Espaço em branco vertical entre blocos |
| **Descrição** | Adiciona espaçamento vertical configurável |
| **Props** | `height` (select: xs/sm/md/lg/xl) |
| **Compilador** | `spacer.ts` (Base) |

#### 1.7 Bloco Html (`HTMLSection`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Layout |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts`, renderiza via `IsolatedCustomBlock` (iframe) |
| **Contexto** | Permite inserir HTML/CSS customizado com isolamento total via iframe |
| **Descrição** | Bloco para código HTML e CSS manual, renderizado dentro de iframe para evitar vazamento de estilos |
| **Props** | `htmlContent` (textarea), `cssContent` (textarea), `blockName` (string, default: "Bloco Html"), `baseUrl` (string, para imagens relativas) |
| **Comportamento** | HTML é sanitizado (remove `<script>`, event handlers, `javascript:` URLs). CSS é scoped via `<style>` |
| **Compilador** | `html-section.ts` (Fase 3) |

---

### 2. Blocos de Cabeçalho / Rodapé

#### 2.1 Cabeçalho (`Header`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Infraestrutura |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` (definição), `src/components/storefront/StorefrontHeader*.tsx` (renderização) |
| **Contexto** | Cabeçalho global da loja — presente em todas as páginas |
| **Descrição** | Header completo com logo, menu, busca, carrinho, barra de aviso e contato |
| **Documentação detalhada** | Ver seção "Cabeçalho (HeaderSettings)" neste doc e `docs/regras/header.md` |
| **Condições** | `isRemovable: false` — nunca pode ser removido |
| **Props** | ~30 props (headerStyle, cores, notice bar, contato, promoções) — detalhadas na seção HeaderSettings |
| **Compilador** | Standalone em `storefront-html` |

#### 2.2 Rodapé da Loja (`Footer`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Infraestrutura |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` (definição), `src/components/storefront/StorefrontFooter*.tsx` (renderização) |
| **Contexto** | Rodapé global da loja — presente em todas as páginas |
| **Descrição** | Footer com logo, SAC, redes sociais, informações legais, selos e formas de pagamento |
| **Documentação detalhada** | Ver seção "Rodapé (FooterSettings)" neste doc e `docs/regras/footer.md` |
| **Condições** | `isRemovable: false` — nunca pode ser removido |
| **Props** | ~10 props (seções toggle, cores, arrays de imagens) — detalhadas na seção FooterSettings |
| **Compilador** | Standalone em `storefront-html` |

---

### 3. Blocos de Conteúdo

#### 3.1 Texto (`RichText`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/components/builder/blocks/content/RichTextBlock.tsx` |
| **Contexto** | Bloco de texto com edição inline no canvas |
| **Descrição** | Editor rich text com formatação via painel lateral (negrito, itálico, fonte, tamanho) |
| **Props** | `content` (richtext, default: "Digite seu conteúdo aqui..."), `fontFamily` (select: 35+ fontes), `fontSize` (select: xs/sm/base/lg/xl/2xl), `fontWeight` (select: normal/500/600/bold) |
| **Comportamento** | Edição inline via contentEditable. Sincroniza via debounce/blur. Ver seção "Sistema de Edição de Texto Rico" |
| **Compilador** | `rich-text.ts` (Base) |

#### 3.2 Conteúdo da Página (`PageContent`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Renderiza o conteúdo HTML de páginas institucionais (Sobre, Política, etc.) |
| **Descrição** | Bloco sem props que renderiza o conteúdo da página institucional associada |
| **Props** | Nenhuma (propsSchema vazio) |
| **Comportamento** | Busca e renderiza o HTML da página institucional do banco de dados |

#### 3.3 Botão (`Button`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/components/builder/blocks/content/ButtonBlock.tsx` |
| **Contexto** | Botão CTA customizável com cores, fonte e bordas |
| **Descrição** | Botão renderizado como `<a>` com 4 variantes (primary/secondary/outline/ghost) e cores personalizáveis |
| **Props** | `text` (string), `url` (string), `variant` (select: primary/secondary/outline/ghost), `size` (select: sm/md/lg), `alignment` (select: left/center/right), `fontFamily` (select: 15+ fontes), `fontWeight` (select: normal/500/semibold/bold), `backgroundColor` (color), `textColor` (color), `hoverBgColor` (color), `hoverTextColor` (color), `borderColor` (color), `hoverBorderColor` (color), `borderRadius` (select: none/sm/md/lg/full) |
| **Comportamento** | Gera `<style>` dinâmico com classe única para hover states. Usa `var(--theme-button-*)` como fallback |
| **Compilador** | `button.ts` (Base) |

#### 3.4 Perguntas Frequentes (`FAQ`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/components/builder/blocks/interactive/FAQBlock.tsx` |
| **Contexto** | Seção de FAQ com acordeão expansível |
| **Descrição** | Accordion de perguntas/respostas usando Radix UI. Exibe itens demo apenas no builder |
| **Props** | `title` (string, default: "Perguntas Frequentes"), `titleAlign` (select: left/center/right), `items` (array: {question, answer}), `allowMultiple` (boolean) |
| **Comportamento** | No builder sem itens: exibe 3 itens demo. No público sem itens: não renderiza nada |
| **Compilador** | `faq.ts` (Fase 2) — usa `<details>/<summary>` nativo, zero JS |

#### 3.5 Depoimentos (`Testimonials`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/components/builder/blocks/interactive/TestimonialsBlock.tsx` |
| **Contexto** | Grid de depoimentos de clientes com avaliação por estrelas |
| **Descrição** | Cards com nome, texto, rating (estrelas emoji), role e imagem opcional. Grid 1→2→3 colunas |
| **Props** | `title` (string, default: "O que dizem nossos clientes"), `items` (array: {name, content/text, rating, role, image}) |
| **Comportamento** | No builder sem itens: exibe 3 depoimentos demo. No público sem itens: não renderiza |
| **Compilador** | `testimonials.ts` (Fase 2) — estrelas SVG, imagens otimizadas via wsrv.nl |

#### 3.6 Lista de Features (`FeatureList`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Lista vertical de benefícios/features com ícones |
| **Descrição** | Lista de itens com ícone + texto, título/subtítulo opcionais, CTA opcional |
| **Props** | `title` (string), `subtitle` (string), `items` (array: {id, icon, text}), `iconColor` (color), `textColor` (color), `backgroundColor` (color), `showButton` (boolean), `buttonText` (string), `buttonUrl` (string) |
| **Compilador** | `feature-list.ts` (Fase 4) — ícones SVG, cor herda do tema |

#### 3.7 Conteúdo em Colunas (`ContentColumns`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Imagem + texto lado a lado com features opcionais |
| **Descrição** | Layout de duas colunas com imagem (desktop/mobile), rich text, lista de features e CTA |
| **Props** | `title` (string), `subtitle` (string), `content` (richtext), `imageDesktop` (image), `imageMobile` (image), `imagePosition` (select: left/right), `features` (array), `iconColor` (color), `showButton` (boolean), `buttonText` (string), `buttonUrl` (string), `backgroundColor` (color), `textColor` (color) |
| **Compilador** | `content-columns.ts` (Fase 4) |

#### 3.8 Benefícios da Loja (`InfoHighlights`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Barra de benefícios (frete grátis, parcelamento, compra segura) |
| **Descrição** | Ícones com título e descrição em layout horizontal ou vertical |
| **Props** | `items` (array: {id, icon, title, description}), `layout` (select: horizontal/vertical), `iconColor` (color), `textColor` (color) |
| **Compilador** | `info-highlights.ts` (Base) |

#### 3.9 Texto + Banners (`TextBanners`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Seção de texto com 2 imagens lado a lado |
| **Descrição** | Texto + 2 banners com layout text-left/text-right e CTA customizável |
| **Props** | `title` (string), `text` (textarea), `imageDesktop1/2` (image), `imageMobile1/2` (image), `layout` (select: text-left/text-right), `ctaEnabled` (boolean), `ctaText` (string), `ctaUrl` (string), `ctaBgColor` (color), `ctaTextColor` (color) |
| **Compilador** | `text-banners.ts` (Fase 4) — CTA usa sf-btn-primary |

#### 3.10 Avaliações (`Reviews`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Carrossel de avaliações de clientes |
| **Descrição** | Avaliações com nome, rating (estrelas), texto e visibilidade configurável |
| **Props** | `title` (string), `reviews` (array: {name, rating, text}), `visibleCount` (number: 1-10) |
| **Compilador** | `reviews.ts` (Fase 2) — carrossel com scroll horizontal e setas de navegação |

#### 3.11 Passos / Timeline (`StepsTimeline`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Passos sequenciais (como funciona, processo de compra) |
| **Descrição** | Timeline com números, títulos e descrições em layout horizontal ou vertical |
| **Props** | `title` (string), `subtitle` (string), `steps` (array: {number, title, description}), `layout` (select: horizontal/vertical), `accentColor` (color), `showNumbers` (boolean), `backgroundColor` (color) |
| **Compilador** | `steps-timeline.ts` (Fase 4) — círculos numerados com linha SVG |

#### 3.12 Contador Regressivo (`CountdownTimer`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Timer para promoções por tempo limitado |
| **Descrição** | Contagem regressiva com dias/horas/minutos/segundos e CTA opcional |
| **Props** | `title` (string), `subtitle` (string), `endDate` (datetime), `showDays/Hours/Minutes/Seconds` (boolean), `backgroundColor` (color, default: #dc2626), `textColor` (color, default: #ffffff), `expiredMessage` (string), `buttonText` (string), `buttonUrl` (string) |
| **Compilador** | `countdown-timer.ts` (Fase 4) — server-render + hidratação JS via `data-sf-countdown` |

#### 3.13 Logos / Parceiros (`LogosCarousel`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Grid de logos de parceiros/marcas |
| **Descrição** | Logos com opção de escala de cinza, autoplay e colunas configuráveis |
| **Props** | `title` (string), `subtitle` (string), `logos` (array), `autoplay` (boolean), `grayscale` (boolean), `columns` (select: 3/4/5/6), `backgroundColor` (color) |
| **Compilador** | `logos-carousel.ts` (Fase 4) |

#### 3.14 Estatísticas (`StatsNumbers`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Números de destaque (clientes, aprovação, entrega) |
| **Descrição** | Estatísticas com animação de números via IntersectionObserver |
| **Props** | `title` (string), `subtitle` (string), `items` (array: {number, label}), `layout` (select: horizontal/grid), `animateNumbers` (boolean), `backgroundColor` (color), `accentColor` (color) |
| **Compilador** | `stats-numbers.ts` (Fase 4) |

#### 3.15 Acordeão (`AccordionBlock`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Acordeão genérico (diferente do FAQ, mais estilizável) |
| **Descrição** | Itens expansíveis com 3 variantes visuais e múltiplas opções de comportamento |
| **Props** | `title` (string), `subtitle` (string), `items` (array: {title, content}), `allowMultiple` (boolean), `defaultOpen` (number, -1=nenhum), `variant` (select: default/separated/bordered), `backgroundColor` (color), `accentColor` (color) |
| **Compilador** | `accordion.ts` (Fase 2) |

#### 3.16 Newsletter (`Newsletter`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Seção de inscrição em newsletter |
| **Descrição** | Formulário de email com 3 layouts, incentivo opcional e cores customizáveis |
| **Props** | `title` (string), `subtitle` (string), `placeholder` (string), `buttonText` (string), `successMessage` (string), `layout` (select: horizontal/vertical/card), `showIcon` (boolean), `showIncentive` (boolean), `incentiveText` (string), `backgroundColor` (color), `textColor` (color), `buttonBgColor` (color), `buttonTextColor` (color) |
| **Compilador** | `newsletter.ts` (Fase 2) — atributos `data-sf-newsletter` para hidratação JS |

#### 3.17 Formulário de Contato (`ContactForm`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Formulário de contato com campos configuráveis |
| **Descrição** | Formulário com nome, email, telefone, assunto e mensagem. 3 layouts. Informações de contato opcionais |
| **Props** | `title` (string), `subtitle` (string), `layout` (select: simple/with-info/split), `showName/Phone/Subject` (boolean), labels customizáveis, `buttonText` (string), `successMessage` (string), `showContactInfo` (boolean), `contactEmail/Phone/Address/Hours` (string), `backgroundColor/textColor/buttonBgColor/buttonTextColor` (color) |

#### 3.18 Mapa (`Map`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Mapa incorporado com informações de contato |
| **Descrição** | Google Maps embed com endereço, botão "Como Chegar", info de contato e 3 layouts |
| **Props** | `title` (string), `subtitle` (string), `address` (string), `embedUrl` (string), `latitude/longitude` (string), `zoom` (number: 1-20), `height` (select: sm/md/lg/xl), `showAddress` (boolean), `showDirectionsButton` (boolean), `directionsButtonText` (string), `layout` (select: full/with-info/side-by-side), `showContactInfo` (boolean), `contactTitle/Address/Phone/Email/Hours` (string), `rounded` (boolean), `shadow` (boolean), `backgroundColor` (color) |

#### 3.19 Bloco Importado (`CustomBlock`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/components/builder/blocks/CustomBlockRenderer.tsx`, `src/components/builder/blocks/IsolatedCustomBlock.tsx` |
| **Contexto** | Renderiza HTML/CSS importado de blocos salvos na tabela `custom_blocks` |
| **Descrição** | Busca bloco pelo ID ou recebe HTML/CSS diretamente. Renderiza em iframe isolado (100% CSS isolation) |
| **Props** | `customBlockId` (string, UUID), `htmlContent` (textarea, fallback), `cssContent` (textarea, fallback), `blockName` (string, default: "Conteúdo Importado") |
| **Comportamento** | Se `customBlockId` fornecido: busca da tabela `custom_blocks`. Se não: usa htmlContent/cssContent diretos. Cache de 5min via react-query |

#### 3.20 Feed Social (`SocialFeed`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Grid de posts de redes sociais (Instagram/Facebook/Twitter) |
| **Descrição** | Feed com grid/carrossel/masonry, perfil, botão seguir e stats |
| **Props** | `title` (string), `subtitle` (string), `platform` (select: instagram/facebook/twitter), `posts` (array), `layout` (select: grid/carousel/masonry), `columns` (select: 2/3/4/6), `showCaption` (boolean), `showStats` (boolean), `maxPosts` (number: 2-12), `showProfile` (boolean), `profileUsername` (string), `profileUrl` (string), `followButtonText` (string), `gap` (select: sm/md/lg), `rounded` (boolean), `hoverEffect` (boolean), `backgroundColor` (color) |

#### 3.21 Produtos Personalizados (`PersonalizedProducts`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Recomendações de produtos baseadas em preferências do usuário |
| **Descrição** | Grid ou carrossel de produtos recomendados com IA |
| **Props** | `title` (string), `subtitle` (string), `layout` (select: grid/carousel), `columns` (select: 2/3/4) |

#### 3.22 Comprando Agora (`LivePurchases`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Social proof de compras recentes em tempo real |
| **Descrição** | Exibe compras recentes em 3 formatos: cards, ticker ou popup |
| **Props** | `title` (string), `layout` (select: cards/ticker/popup), `showStats` (boolean) |

#### 3.23 Tabela de Preços (`PricingTable`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Comparação de planos/preços |
| **Descrição** | Tabela de preços com toggle mensal/anual e desconto configurável |
| **Props** | `title` (string), `subtitle` (string), `layout` (select: cards/table), `showAnnualToggle` (boolean), `annualDiscount` (number: 0-50%) |

#### 3.24 Popup/Modal (`PopupModal`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Popup/modal para promoções, newsletter ou anúncios |
| **Descrição** | Modal com 3 tipos (newsletter/promotion/announcement) e 3 layouts (centered/side-image/corner) |
| **Props** | `title` (string), `subtitle` (string), `type` (select: newsletter/promotion/announcement), `layout` (select: centered/side-image/corner), `showEmailInput` (boolean), `buttonText` (string), `discountCode` (string) |

#### 3.25 Listagem do Blog (`BlogListing`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Conteúdo |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Página de listagem de posts do blog |
| **Descrição** | Grid de posts com configurações via Tema > Páginas > Blog |
| **Props** | Nenhuma (propsSchema vazio) — config via pageSettings.blog |
| **Condições** | `isRemovable: false` |
| **Compilador** | Standalone em `storefront-html` |

---

### 4. Blocos de Mídia

#### 4.1 Banner (`Banner`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Mídia |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Banner principal ou carrossel de banners. **Substitui o antigo HeroBanner** |
| **Descrição** | 2 modos: single (banner único) e carousel (múltiplos slides). Overlay de texto e CTA opcionais |
| **Props (Single)** | `imageDesktop` (image), `imageMobile` (image), `linkUrl` (string), `title` (string), `subtitle` (string), `buttonText` (string), `buttonUrl` (string) |
| **Props (Carousel)** | `slides` (array: {imageDesktop, imageMobile, linkUrl, altText}), `autoplaySeconds` (number: 0-30), `showArrows` (boolean), `showDots` (boolean) |
| **Props (Style)** | `height` (select: auto/sm/md/lg/full), `bannerWidth` (select: full/contained), `alignment` (select: left/center/right), `backgroundColor` (color), `textColor` (color), `overlayOpacity` (number: 0-100), `buttonColor` (color), `buttonTextColor` (color), `buttonHoverBgColor` (color), `buttonHoverTextColor` (color) |
| **Compilador** | `banner.ts` (Base) |

#### 4.2 Imagem (`Image`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Mídia |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Imagem responsiva com opções avançadas de enquadramento |
| **Descrição** | Imagem com versões desktop/mobile, aspect ratio, bordas, sombra e link opcional |
| **Props** | `imageDesktop` (image), `imageMobile` (image), `alt` (string), `linkUrl` (string), `width` (select: 25/50/75/full %), `height` (select: auto/200-500px/50-75vh), `aspectRatio` (select: auto/1:1/4:3/16:9/21:9), `objectFit` (select: cover/contain/fill/none), `objectPosition` (select: center/top/bottom/left/right), `rounded` (select: none/sm/md/lg/full), `shadow` (select: none/sm/md/lg) |
| **Compilador** | `image.ts` (Base) |

#### 4.3 Vídeo YouTube (`YouTubeVideo`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Mídia |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Embed de vídeo do YouTube responsivo |
| **Descrição** | Iframe do YouTube com largura e aspect ratio configuráveis |
| **Props** | `title` (string, opcional), `youtubeUrl` (string), `widthPreset` (select: sm/md/lg/xl/full), `aspectRatio` (select: 16:9/4:3/1:1) |
| **Compilador** | `youtube-video.ts` (Fase 3) |

#### 4.4 Carrossel de Vídeos (`VideoCarousel`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Mídia |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Carrossel de múltiplos vídeos (YouTube ou upload) |
| **Descrição** | Primeiro vídeo embed + thumbnails. Suporta YouTube URLs e vídeos uploadados |
| **Props** | `title` (string), `videos` (array), `videosJson` (textarea, alternativo), `showControls` (boolean), `aspectRatio` (select: 16:9/4:3/1:1/9:16), `autoplay` (boolean) |
| **Compilador** | `video-carousel.ts` (Fase 3) — hidratação via `data-sf-video-carousel` |
| **⚠️ Nota** | Bloco aparece **duplicado** no registry (linhas 2036 e 2678). A segunda definição sobrescreve a primeira |

#### 4.5 Vídeo Upload (`VideoUpload`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Mídia |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Vídeo nativo com fontes desktop/mobile |
| **Descrição** | Tag `<video>` nativa com controles, autoplay, loop, mudo e aspect ratio customizável |
| **Props** | `videoDesktop` (video), `videoMobile` (video), `aspectRatio` (select: auto/16:9/9:16/4:3/1:1/4:5/21:9/custom), `aspectRatioCustom` (string), `objectFit` (select: contain/cover/fill), `controls` (boolean), `autoplay` (boolean), `loop` (boolean), `muted` (boolean) |
| **Compilador** | `video-upload.ts` (Fase 3) — fontes mobile via media query |

#### 4.6 Galeria de Imagens (`ImageGallery`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Mídia |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Grid de imagens com lightbox opcional |
| **Descrição** | Galeria responsiva (2→3→4 colunas) com hover effects e lightbox |
| **Props** | `title` (string), `subtitle` (string), `images` (array), `columns` (select: 2/3/4), `gap` (select: sm/md/lg), `enableLightbox` (boolean), `aspectRatio` (select: square/4:3/16:9/auto), `borderRadius` (number: px), `backgroundColor` (color) |
| **Compilador** | `image-gallery.ts` (Fase 3) |

#### 4.7 Carrossel de Imagens (`ImageCarousel`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de Mídia |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Carrossel de imagens com múltiplas configurações |
| **Descrição** | Carrossel com autoplay, setas, dots, lightbox, slides por visualização e aspect ratio configuráveis |
| **Props** | `title` (string), `images` (array), `autoplay` (boolean), `autoplayInterval` (number: 1-30s), `showArrows` (boolean), `showDots` (boolean), `enableLightbox` (boolean), `aspectRatio` (select: 16:9/4:3/1:1/21:9/auto), `slidesPerView` (select: 1/2/3/4), `gap` (select: sm/md/lg) |
| **Compilador** | `image-carousel.ts` (Base) |

---

### 5. Blocos de E-commerce

#### 5.1 Lista de Categorias (`CategoryList`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Grid/lista/carrossel de categorias da loja |
| **Descrição** | Exibe categorias com 3 modos de fonte (auto/parent/custom) e imagens configuráveis |
| **Props** | `title` (string), `source` (select: auto/parent/custom), `items` (categoryMultiSelect, max 12, recomendado: 800×800px), `layout` (select: grid/list/carousel), `columnsDesktop` (select: 2-6), `columnsMobile` (select: 1-2), `showImage` (boolean), `showDescription` (boolean) |
| **Compilador** | `category-list.ts` (Fase 5) |

#### 5.2 Vitrine de Produtos (`ProductGrid`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Grid principal de produtos (destaques, mais vendidos, novidades, por categoria) |
| **Descrição** | Grid responsivo com colunas configuráveis e 4 fontes de dados |
| **Props** | `title` (string), `source` (select: featured/bestsellers/newest/category), `categoryId` (category), `columnsDesktop` (select: 2-6), `columnsMobile` (select: 1-2), `limit` (number: 1-24), `showPrice` (boolean) |
| **Compilador** | `product-grid.ts` (Fase 5) — usa `renderProductCard` compartilhado |

#### 5.3 Listagem de Categoria (`CategoryPageLayout`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Página de categoria com filtros e paginação |
| **Descrição** | Layout completo de listagem de produtos por categoria. Config via Tema > Páginas > Categoria |
| **Props** | Nenhuma (propsSchema vazio) — configurações via CategorySettingsPanel |
| **Condições** | `isRemovable: false` |
| **Compilador** | `category-page-layout.ts` (Base) |

#### 5.4 Carrossel de Produtos (`ProductCarousel`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Scroll horizontal de produtos com setas |
| **Descrição** | Carrossel com snap scroll, 4 fontes de dados e CTA por card |
| **Props** | `title` (string), `source` (select: featured/newest/all/category), `categoryId` (category), `limit` (number: 4-20), `showPrice` (boolean), `showButton` (boolean), `buttonText` (string) |
| **Compilador** | `product-carousel.ts` (Fase 5) — setas desktop, cards via `renderProductCard` |

#### 5.5 Produtos Selecionados (`FeaturedProducts`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Grid de produtos selecionados manualmente |
| **Descrição** | Seleção manual de produtos via multi-select com colunas e CTA configuráveis |
| **Props** | `title` (string), `productIds` (productMultiSelect), `limit` (number: 1-12), `columnsDesktop` (select: 2-6), `columnsMobile` (select: 1-2), `showPrice` (boolean), `showButton` (boolean), `buttonText` (string) |
| **Compilador** | `featured-products.ts` (Base) |

#### 5.6 Card de Produto (`ProductCard`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Card individual de um produto específico |
| **Descrição** | Card de produto único selecionado via product picker |
| **Props** | `productId` (product), `showPrice` (boolean), `showButton` (boolean) |

#### 5.7 Detalhes do Produto (`ProductDetails`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Página de produto (PDP) — galeria, preço, variantes, CTAs |
| **Descrição** | Bloco principal da PDP. Config via Tema > Páginas > Produto |
| **Props** | Nenhuma (propsSchema vazio) — configurações via ProductSettingsPanel |
| **Condições** | `isRemovable: false` |
| **Compilador** | `product-details.ts` (Base) |

#### 5.8 Resumo do Carrinho (`CartSummary`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Resumo do carrinho (totais, frete, cupom) |
| **Descrição** | Widget de resumo usado dentro do carrinho/checkout |
| **Props** | Nenhuma (propsSchema vazio) — config via Tema > Páginas > Carrinho |
| **Condições** | `isRemovable: false` |

#### 5.9 Etapas do Checkout (`CheckoutSteps`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Timeline de progresso do checkout (Contato > Entrega > Pagamento) |
| **Descrição** | Indicador visual de progresso do checkout |
| **Props** | Nenhuma (propsSchema vazio) — config via Tema > Páginas > Checkout |
| **Condições** | `isRemovable: false` |

#### 5.10 Categoria/Coleção (`CollectionSection`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Seção com título + "Ver todos" + grid/carrossel de produtos de uma categoria |
| **Descrição** | Similar ao ProductGrid mas com link "Ver todos" para a categoria |
| **Props** | `title` (string), `categoryId` (category), `displayStyle` (select: grid/carousel), `limit` (number: 4-24), `columns` (select: 3/4/5), `mobileColumns` (select: 1/2), `showViewAll` (boolean), `viewAllText` (string), `showPrice` (boolean), `showButton` (boolean) |
| **Compilador** | `collection-section.ts` (Fase 5) |

#### 5.11 Banner da Categoria (`CategoryBanner`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Banner de imagem no topo da página de categoria |
| **Descrição** | Banner configurado SOMENTE no menu Categorias (admin), sem painel de edição no builder |
| **Props** | Nenhuma (propsSchema vazio) |
| **Compilador** | `category-banner.ts` (Base) |

#### 5.12 Banner + Produtos (`BannerProducts`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Seção com banner de promoção + grid de produtos lado a lado |
| **Descrição** | Banner imagem com grid de produtos, fonte manual (IDs) ou por categoria |
| **Props** | `title` (string), `description` (string), `imageDesktop` (image, recomendado: 600×400px), `imageMobile` (image, recomendado: 400×500px), `source` (select: manual/category), `productIds` (productMultiSelect), `categoryId` (category), `limit` (number: 2-8), `showCta` (boolean), `ctaText` (string), `ctaUrl` (string) |
| **Compilador** | `banner-products.ts` (Fase 5) |

#### 5.13 Categorias em Destaque (`FeaturedCategories`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Categorias em formato circular (estilo Instagram) |
| **Descrição** | Círculos de categorias selecionadas com nome opcional e estilo mobile grid/carrossel |
| **Props** | `title` (string), `items` (categoryMultiSelect, max 12, recomendado: 200×200px circular), `showName` (boolean), `mobileStyle` (select: grid/carousel) |
| **Compilador** | `featured-categories.ts` (Base) |

#### 5.14 Carrinho (`Cart`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Página completa do carrinho de compras |
| **Descrição** | Bloco essencial do carrinho. Config via Tema > Páginas > Carrinho |
| **Props** | Nenhuma (propsSchema vazio) |
| **Condições** | `isRemovable: false` |

#### 5.15 Checkout (`Checkout`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Página completa do checkout |
| **Descrição** | Bloco essencial do checkout. Config via Tema > Páginas > Checkout |
| **Props** | Nenhuma (propsSchema vazio) |
| **Condições** | `isRemovable: false` |

#### 5.16 Confirmação de Pedido (`ThankYou`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Página de agradecimento pós-compra |
| **Descrição** | Confirmação do pedido com upsell, WhatsApp e compartilhamento social |
| **Props** | Nenhuma (propsSchema vazio) — config via Tema > Páginas > Obrigado |
| **Condições** | `isRemovable: false` |

#### 5.17 Hub da Conta (`AccountHub`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Página principal da área do cliente |
| **Descrição** | Hub com acesso a pedidos, dados pessoais e outras funcionalidades da conta |
| **Props** | Nenhuma (propsSchema vazio) |
| **Condições** | `isRemovable: false` |

#### 5.18 Lista de Pedidos (`OrdersList`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Listagem de pedidos do cliente |
| **Descrição** | Lista de pedidos com status, datas e links para detalhes |
| **Props** | Nenhuma (propsSchema vazio) |
| **Condições** | `isRemovable: false` |

#### 5.19 Detalhe do Pedido (`OrderDetail`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Página de detalhes de um pedido específico |
| **Descrição** | Detalhes completos do pedido: itens, valores, endereço, rastreio |
| **Props** | Nenhuma (propsSchema vazio) |
| **Condições** | `isRemovable: false` |

#### 5.20 Rastrear Pedido (`TrackingLookup`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Página de rastreamento de pedido |
| **Descrição** | Busca e exibe status de rastreamento. Config via Tema > Páginas > Rastreio |
| **Props** | Nenhuma (propsSchema vazio) |
| **Condições** | `isRemovable: false` |

#### 5.21 Compre Junto (`CompreJuntoSlot`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce (Slot de Oferta) |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Seção "Compre Junto" na página de produto |
| **Descrição** | Slot que renderiza ofertas de "Compre Junto" configuradas no submódulo "Aumentar Ticket" |
| **Props** | Nenhuma (propsSchema vazio) — config via Tema > Páginas > Produto |

#### 5.22 Sugestões no Carrinho (`CrossSellSlot`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce (Slot de Oferta) |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Sugestões de produtos no carrinho |
| **Descrição** | Slot que renderiza cross-sell configurado no submódulo "Aumentar Ticket > Cross-sell" |
| **Props** | Nenhuma (propsSchema vazio) — config via Tema > Páginas > Carrinho |

#### 5.23 Oferta Pós-Compra (`UpsellSlot`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente de E-commerce (Slot de Oferta) |
| **Status** | 🟡 Sistema |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Oferta pós-compra na página de obrigado |
| **Descrição** | Slot que renderiza ofertas de upsell pós-compra |
| **Props** | Nenhuma (propsSchema vazio) — config via Tema > Páginas > Obrigado |

---

### 6. Blocos Utilitários

#### 6.1 Formulário Newsletter (`NewsletterForm`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente Utilitário |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Formulário de inscrição em newsletter integrado com listas de email marketing |
| **Descrição** | Formulário com campos configuráveis (nome, telefone, data nascimento), integrado com módulo Email Marketing |
| **Props** | `listId` (emailList, **obrigatório**), `title` (string), `subtitle` (string), `showName` (boolean), `showPhone` (boolean), `showBirthDate` (boolean), `buttonText` (string), `successMessage` (string), `layout` (select: vertical/horizontal), `alignment` (select: left/center/right), `backgroundColor` (color), `textColor` (color), `buttonColor` (color), `buttonTextColor` (color), `borderRadius` (number: 0-32px), `inputStyle` (select: outline/filled/underline) |
| **Compilador** | `newsletter.ts` (Fase 2) |

#### 6.2 Popup Newsletter (`NewsletterPopup`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente Utilitário |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Popup de newsletter com gatilhos configuráveis |
| **Descrição** | Popup com 3 triggers (delay/scroll/exit_intent), controle de frequência e páginas de exibição |
| **Exit Intent (v1.1)** | Detecção melhorada: `mouseleave` (cursor saiu pelo topo) + `mousemove` com `clientY < 50` e `movementY < -5` (movimento rápido em direção ao botão fechar). Flag `eiFired` garante disparo único. Delay 2.5s antes de ativar. |
| **Props** | `listId` (string, **obrigatório**), `title` (string), `subtitle` (string), `showName/Phone/BirthDate` (boolean), `buttonText` (string), `successMessage` (string), `triggerType` (select: delay/scroll/exit_intent), `delaySeconds` (number: 1-120), `scrollPercentage` (number: 10-100), `showOnPages` (select: all/specific/current), `showOnMobile` (boolean), `frequency` (select: once/daily/always), `overlayColor` (color), `popupBgColor/TextColor` (color), `buttonColor/TextColor` (color), `borderRadius` (number: 0-48px), `showCloseButton` (boolean) |

#### 6.3 Quiz Interativo (`QuizEmbed`)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente Utilitário |
| **Status** | 🟢 Ativo |
| **Localização** | `src/lib/builder/registry.ts` |
| **Contexto** | Embed de quiz interativo do módulo Marketing |
| **Descrição** | Renderiza um quiz criado no módulo Marketing > Quiz com 3 estilos visuais |
| **Props** | `quizId` (string, **obrigatório**), `showTitle` (boolean), `showDescription` (boolean), `style` (select: card/inline/fullwidth) |

---

### 7. Blocos Demo

#### 7.1 CartDemoBlock

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente Demo |
| **Status** | 🔵 Demo |
| **Localização** | `src/components/builder/blocks/` (verificar existência) |
| **Contexto** | Preview do carrinho no builder quando não há itens reais |
| **Descrição** | Exibe um carrinho de demonstração com produtos fictícios para visualização no editor |
| **Comportamento** | Renderiza apenas no builder (`isEditing=true`). No público: não renderiza |

#### 7.2 CheckoutDemoBlock

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente Demo |
| **Status** | 🔵 Demo |
| **Localização** | `src/components/builder/blocks/` (verificar existência) |
| **Contexto** | Preview do checkout no builder quando não há sessão de checkout real |
| **Descrição** | Exibe um checkout de demonstração com dados fictícios para visualização no editor |
| **Comportamento** | Renderiza apenas no builder (`isEditing=true`). No público: não renderiza |

---

### 8. Componentes Legados / Compatibilidade

#### 8.1 HeroBannerBlock [LEGADO — renderização apenas]

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente Legado |
| **Status** | 🔴 Legado (mantido para compatibilidade) |
| **Localização** | `src/components/builder/blocks/HeroBannerBlock.tsx` |
| **Contexto** | Antigo bloco de banner principal — **substituído pelo bloco Banner (4.1)** |
| **Descrição** | Carrossel de banners com imagens desktop/mobile. Funcionalidade migrada para o bloco unificado "Banner" com modo carousel |
| **Nota** | O arquivo `.tsx` ainda existe e é importado em `BlockRenderer.tsx` como `HeroBanner: HeroBannerBlockWrapper`. Templates antigos que usam `type: 'HeroBanner'` ainda renderizam através deste componente. O compilador `hero-banner.ts` também é mantido. **NÃO está no registry** — não aparece no picker de blocos |

#### 8.2 EmbedSocialPostBlock [ATIVO ✅ — adicionado ao registry]

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente Ativo |
| **Status** | 🟢 Ativo |
| **Localização** | `src/components/builder/blocks/interactive/EmbedSocialPostBlock.tsx` |
| **Contexto** | Embed de posts do Facebook/Instagram/Threads via oEmbed |
| **Descrição** | Usa edge function `meta-oembed` para buscar HTML de embed. Processa scripts do Instagram/Facebook após injeção |
| **Registry** | `type: 'EmbedSocialPost'`, `label: 'Embed de Post Social'`, `category: 'utilities'` |
| **Props** | `url` (string, required), `maxWidth` (number, 300-800, default 550) |
| **Nota** | **Corrigido na auditoria** — adicionado entry no registry para que apareça no picker de blocos |

#### 8.3 TextBlock [LEGADO — renderização apenas]

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente Legado |
| **Status** | 🔴 Legado (mantido para compatibilidade) |
| **Localização** | `src/components/builder/blocks/content/TextBlock.tsx` |
| **Contexto** | Bloco de texto simples com sanitização — **substituído por RichText** |
| **Descrição** | Renderiza HTML sanitizado com alinhamento, fonte e cor. Sem edição inline. Mapeado como `Text: TextBlock` em `BlockRenderer.tsx`. Templates antigos com `type: 'Text'` renderizam via este componente. O compilador `text.ts` também é mantido. **NÃO está no registry** — não aparece no picker |

#### 8.4 ColumnBlock [COMPONENTE AUXILIAR]

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente Auxiliar |
| **Status** | 🟢 Ativo (auxiliar) |
| **Localização** | `src/components/builder/blocks/layout/ColumnBlock.tsx` |
| **Contexto** | Componente filho do bloco Colunas — representa uma coluna individual |
| **Descrição** | Wrapper com `gridColumn: span N` para posicionar conteúdo dentro do grid de colunas |

---

### ✅ Problemas da Auditoria — Resolvidos

| # | Problema | Resolução |
|---|----------|-----------|
| 1 | `VideoCarousel` duplicado no registry | ✅ Removida a segunda definição (linha ~2678). Mantida apenas a primeira (com `videosJson`) |
| 2 | `HeroBannerBlock.tsx` arquivo legado | ✅ Mantido para compatibilidade — templates antigos com `type: 'HeroBanner'` ainda renderizam. Documentado como legado |
| 3 | `EmbedSocialPostBlock` sem entry no registry | ✅ Adicionado ao registry como `type: 'EmbedSocialPost'` em `category: 'utilities'` |
| 4 | `TextBlock.tsx` sem entry no registry | ✅ Mantido para compatibilidade — templates antigos com `type: 'Text'` ainda renderizam. Documentado como legado |

---

## 🖼️ Category Banner — Auto-Seleção e Draft Theme (v8.4.2)

### Regra: Auto-seleção de Categoria no Builder

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Lógica |
| **Localização** | `src/components/builder/VisualBuilder.tsx` |
| **Descrição** | Quando o Builder abre a página "Categoria", auto-seleciona a primeira categoria ativa do tenant para que o `CategoryBannerBlock` tenha dados reais (banner_desktop_url, banner_mobile_url) |
| **Comportamento** | 1. Query busca primeira categoria ativa (`useQuery`). 2. `useEffect` seta `exampleCategoryId` automaticamente. 3. Query `builder-category-full` busca dados completos (incluindo banners). 4. `context.category` é populado → banner renderiza no canvas |
| **Condições** | Só executa quando `pageType === 'category'` E `exampleCategoryId` está vazio |
| **Afeta** | `CategoryBannerBlock`, `CategoryPageLayout` |

### Regra: Draft Theme → Botão Salvar

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Lógica |
| **Localização** | `ColorsSettings.tsx`, `TypographySettings.tsx`, `useBuilderDraftTheme.tsx` |
| **Descrição** | Alterações em cores/tipografia atualizam o draft state via `setDraftColors`/`setDraftTypography`, o que ativa `hasDraftChanges=true` no contexto, habilitando o botão Salvar |
| **Comportamento** | 1. Usuário altera cor/fonte. 2. `handleColorChange` chama `setDraftColors(updated)` FORA do state updater (anti-pattern fix). 3. Provider re-renderiza com `hasDraftChanges=true`. 4. `BuilderToolbarWithDraftCheck` detecta via `useBuilderDraftTheme()` → `isDirty=true` → botão Salvar habilitado |
| **Regra Crítica** | Chamadas a `setDraftColors`/`setDraftTypography` NUNCA devem ser feitas dentro de funções `setState(prev => {...})` — isso causa problemas de batching no React 18 |
| **Afeta** | `BuilderToolbar` (botão Salvar), preview em tempo real |

---

## 🎨 Preview Theme Settings — Leitura de draft_content (v2.0)

### Regra: Preview lê themeSettings de draft_content

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Lógica / Bug Fix |
| **Localização** | `src/components/storefront/StorefrontThemeInjector.tsx`, `src/hooks/usePreviewThemeSettings.ts` |
| **Contexto** | Preview da loja (`?preview=1`) não refletia cores salvas no Builder |
| **Descrição** | Quando o Preview é aberto (`?preview=1`), o `StorefrontThemeInjector` agora lê `themeSettings` de `draft_content` (via `usePreviewThemeSettings`) em vez de `published_content`. Isso garante que cores/tipografia salvas mas ainda não publicadas sejam refletidas imediatamente no preview |
| **Comportamento** | 1. `StorefrontThemeInjector` detecta `?preview=1` via URL. 2. Chama `usePreviewThemeSettings` (query com `staleTime: 0` → sempre busca dados frescos). 3. Hook lê `storefront_template_sets.draft_content.themeSettings`. 4. Draft tem prioridade sobre published no preview. 5. Na loja pública (sem `?preview=1`), continua lendo de `published_content` normalmente |
| **Condições** | `?preview=1` na URL E usuário autenticado |
| **Afeta** | `StorefrontThemeInjector`, todas as páginas de preview |
| **Erros/Edge cases** | Se `draft_content` não tiver `themeSettings`, faz fallback para `published_content` |

### Componente: usePreviewThemeSettings

| Campo | Valor |
|-------|-------|
| **Tipo** | Hook |
| **Localização** | `src/hooks/usePreviewThemeSettings.ts` |
| **Descrição** | Hook que busca `themeSettings` de `draft_content` para preview |
| **Comportamento** | Query habilitada somente quando `isPreview=true` e `user` autenticado. `staleTime: 0` garante dados sempre frescos |
| **Afeta** | `StorefrontThemeInjector` |

### Explicação: Cache na loja pública

| Camada | Tempo | Descrição |
|--------|-------|-----------|
| react-query `staleTime` | 2 min | Dados em memória considerados "frescos" |
| Cloudflare CDN | 2-15 min | Cache no edge global |
| Prerender pipeline | Variável | HTML pré-renderizado atualizado via job assíncrono |

A loja pública pode levar alguns minutos para refletir mudanças após publicação. O Preview (`?preview=1`) NÃO tem cache (`staleTime: 0`).

### Resiliência de Publicação: Prerender com Retry (v2026-03-13)

| Campo | Valor |
|-------|-------|
| **Tipo** | Função Utilitária |
| **Localização** | `src/lib/prerenderRetry.ts` |
| **Contexto** | Chamada após publicação no Builder (`useTemplateSetSave.ts`) |
| **Descrição** | Dispara a pré-renderização do storefront com retry automático e feedback visual |
| **Comportamento** | 1. Chama `storefront-prerender` via Edge Function. 2. Se falhar, aguarda 5s e tenta novamente (máximo 3 tentativas). 3. Sucesso → toast verde com nº de páginas. 4. Sucesso parcial (algumas páginas falharam) → toast amarelo. 5. Falha total → toast vermelho orientando o lojista a tentar novamente. |
| **Condições** | Executa em background após o save — não bloqueia a UI |
| **Afeta** | `useTemplateSetSave.ts` (invoca a função), loja pública (resultado da pré-renderização) |
| **Erros/Edge cases** | Se todas as 3 tentativas falharem, a publicação já foi salva no banco mas a loja pública pode exibir conteúdo antigo até o próximo publish ou limpeza manual de cache |

---

## 💬 Support Widget Settings (Atendimento) — Draft Workflow (v1.0)

### Hook: useThemeSupportWidget

| Campo | Valor |
|-------|-------|
| **Tipo** | Hook |
| **Localização** | `src/hooks/useThemeSettings.ts` |
| **Descrição** | Gerencia rascunho local das configurações do widget de suporte (chat/WhatsApp). Segue o padrão de draft obrigatório do Builder. |
| **Comportamento** | 1. Mantém `draftUpdates` em estado local. 2. `updateSupportWidget()` merge parcial no draft. 3. Chama `notifyHeaderFooterDraftChange()` para ativar `isDirty` na toolbar. 4. Draft é incorporado no `handleSave` do `VisualBuilder.tsx`. 5. `clearDraft` limpa estado ao descartar. |
| **Afeta** | `VisualBuilder.tsx` (save/dirty/clear), `SupportSettings.tsx` (UI) |

### Componente: SupportSettings

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente |
| **Localização** | `src/components/builder/theme-settings/SupportSettings.tsx` |
| **Descrição** | Painel de configuração do widget de atendimento no Builder |
| **Comportamento** | Toggle ativar/desativar, seletor de modo (Chat/WhatsApp/Ambos), número WhatsApp, mensagem padrão, cor do botão, posição (esquerda/direita). Todas as alterações são draft-only até salvar. |
| **Condições** | Visível no menu lateral do Builder sob "Atendimento" |

### Ref Global: globalSupportWidgetDraftRef

| Campo | Valor |
|-------|-------|
| **Tipo** | Config |
| **Localização** | `src/hooks/useThemeSettings.ts` |
| **Descrição** | Ref global que permite ao `VisualBuilder` acessar o draft do support widget para merge no save e detecção de `isDirty` |
| **Afeta** | `VisualBuilder.tsx` → `isDirty`, `handleSave`, `clearDraft` |

---

## 🤖 Preenchimento por IA — Metadata nos Blocos (Fase 2.1)

> **Status:** IMPLEMENTADO ✅ — Fase 2.1 concluída. Apenas metadata/tipagem. Sem runtime, sem edge function, sem hook, sem botão no editor.

### Regra Arquitetural

```
┌─────────────────────────────────────────────────────────────────────────┐
│              FONTE DE VERDADE = REGISTRY NATIVO                         │
├─────────────────────────────────────────────────────────────────────────┤
│  • Metadata de IA (aiFillable) fica no schema de props de cada bloco   │
│  • NÃO existe schema paralelo separado para IA                         │
│  • registry.ts continua sendo a única fonte de verdade                  │
│  • Se a prop não tem aiFillable → IA nunca toca nela                   │
│  • Alteração puramente aditiva, sem impacto em runtime                  │
│  • Reversível: remover o campo não quebra nada                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Contrato Técnico: AIFillableConfig

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `hint` | `string` | ✅ | Instrução/dica para a IA sobre como gerar o conteúdo do campo |
| `format` | `'text' \| 'html' \| 'cta' \| 'label' \| 'feedback'` | ❌ | Formato esperado do conteúdo gerado |
| `minItems` | `number` | ❌ | Para props do tipo array: quantidade mínima de itens a gerar |
| `maxItems` | `number` | ❌ | Para props do tipo array: quantidade máxima de itens a gerar |
| `itemSchema` | `Record<string, { hint: string; enabled: boolean }>` | ❌ | Para arrays: define quais sub-campos de cada item a IA deve preencher |
| `overwritePolicy` | `'fill-empty' \| 'confirm-before-overwrite'` | ❌ | Regra futura de merge (não implementada em runtime ainda) |

#### Tipagem (src/lib/builder/types.ts)

```typescript
export interface AIFillableConfig {
  hint: string;
  format?: 'text' | 'html' | 'cta' | 'label' | 'feedback';
  minItems?: number;
  maxItems?: number;
  itemSchema?: Record<string, {
    hint: string;
    enabled: boolean;
  }>;
  overwritePolicy?: 'fill-empty' | 'confirm-before-overwrite';
}
```

O campo `aiFillable?: AIFillableConfig` foi adicionado ao tipo `BlockPropsSchema[key]` como campo opcional.

### Blocos Elegíveis (21 blocos)

| Bloco | Props com aiFillable | Arquivo |
|-------|---------------------|---------|
| Banner | title, subtitle, buttonText | registry.ts |
| BannerCarousel | (items: title, subtitle, buttonText) | registry.ts |
| BannerWithCards | title, subtitle, buttonText, (cards: title, description) | registry.ts |
| FAQ | title, subtitle, (items: question, answer) | registry.ts |
| Testimonials | title, subtitle, (items: name, role, content, rating) | registry.ts |
| Features | title, subtitle, (items: title, description) | registry.ts |
| Newsletter | title, subtitle, buttonText, placeholder | registry.ts |
| RichText | content (HTML) | registry.ts |
| Button | text | registry.ts |
| TextBlock | title, subtitle, body | registry.ts |
| PricingTable | title, subtitle, (items: name, price, description, features, buttonText) | registry.ts |
| StatsCounter | title, (items: value, label, suffix) | registry.ts |
| Timeline | title, subtitle, (items: title, description, date) | registry.ts |
| Accordion | title, (items: title, content) | registry.ts |
| Tabs | (items: label, content) | registry.ts |
| CTA | title, subtitle, buttonText | registry.ts |
| LogoCloud | title | registry.ts |
| ComparisonTable | title, subtitle | registry.ts |
| ContactInfo | title, subtitle | registry.ts |
| Breadcrumb | — (metadata apenas, sem props textuais preenchíveis) | registry.ts |
| AnnouncementBar | text, linkText | registry.ts |

### Props Proibidas para IA

Mesmo em blocos elegíveis, estas categorias de props **NUNCA** recebem `aiFillable`:

| Categoria | Exemplos | Motivo |
|-----------|----------|--------|
| URLs reais | `buttonLink`, `linkUrl`, `url` | Dados funcionais, não conteúdo |
| Imagens | `backgroundImage`, `imageUrl`, `logo` | Mídia real do tenant |
| Estilos/Layout | `backgroundColor`, `textColor`, `layout`, `columns` | Configuração visual |
| IDs e dados de sistema | `productId`, `categoryId` | Dados técnicos |
| Dados reais de negócio | `discountCode`, `phone`, `email`, `address` | Dados sensíveis/reais |
| Controles booleanos | `showButton`, `fullWidth`, `autoPlay` | Configuração funcional |

### Blocos Excluídos (não recebem aiFillable)

Blocos de sistema, e-commerce funcional e mídia pura não são elegíveis:

- **Infraestrutura:** Header, Footer, Page, Section
- **E-commerce funcional:** ProductGrid, ProductDetails, Cart, Checkout, ThankYou, CategoryBanner, CategoryPageLayout, CompreJuntoSlot, CrossSellSlot, UpsellSlot
- **Conta/Pedidos:** AccountHub, OrdersList, OrderDetail
- **Sistema:** TrackingLookup, BlogListing, Spacer, Divider, CustomCode, GoogleMaps
- **Mídia pura:** ImageBlock, VideoBlock, ImageGallery

### Escopo da Fase 2.1

| Item | Status |
|------|--------|
| Interface `AIFillableConfig` em types.ts | ✅ Implementado |
| Campo `aiFillable?` em `BlockPropsSchema` | ✅ Implementado |
| Metadata nos 21 blocos elegíveis | ✅ Implementado |
| Edge function `ai-block-fill` | ✅ Implementado (Fase 2.2) |
| Hook `useAIBlockFill` | ❌ Não implementado (Fase 2.3) |
| Botão "Preencher com IA" no PropsEditor | ❌ Não implementado (Fase 2.3) |
| Preenchimento em lote | ❌ Não implementado (futuro) |
| Lógica de merge no frontend | ❌ Não implementado (Fase 2.3) |

### Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/builder/types.ts` | Adicionada interface `AIFillableConfig` + campo `aiFillable?` em `BlockPropsSchema` |
| `src/lib/builder/registry.ts` | Adicionado `aiFillable` nas props elegíveis dos 21 blocos |
| `supabase/functions/ai-block-fill/index.ts` | Edge function de geração estruturada (Fase 2.2) |
| `supabase/config.toml` | Entrada `[functions.ai-block-fill]` com `verify_jwt = false` |

### Critérios de Segurança

| Critério | Status |
|----------|--------|
| Compatibilidade preservada com blocos existentes | ✅ |
| Sem impacto em runtime (campo opcional não lido) | ✅ |
| Reversível (remover campo não quebra nada) | ✅ |
| Build limpo sem erros | ✅ |
| Nenhum bloco excluído recebeu metadata | ✅ |
| Nenhuma prop proibida recebeu metadata | ✅ |

---

## 🤖 Preenchimento por IA — Edge Function Backend (Fase 2.2)

> **Status:** IMPLEMENTADO ✅ — Fase 2.2 concluída. Edge function `ai-block-fill` criada. Sem UI, sem hook, sem botão no editor.

### Edge Function: `ai-block-fill`

| Campo | Valor |
|-------|-------|
| **Tipo** | Edge Function |
| **Localização** | `supabase/functions/ai-block-fill/index.ts` |
| **Contexto** | Chamada pelo frontend (Fase 2.3) para preencher props textuais de blocos do builder via IA |
| **Versão** | v1.0.0 |
| **Modelo** | `google/gemini-3-flash-preview` (via `aiChatCompletionJSON` do `ai-router.ts`) |
| **Config** | `verify_jwt = false` (padrão do projeto — auth manual via `getClaims()`) |

### Contrato de Entrada (POST body)

```typescript
{
  tenantId: string;          // obrigatório — ID do tenant
  blockType: string;         // obrigatório — tipo do bloco (ex: "Banner", "FAQ")
  currentProps: Record<string, unknown>;  // obrigatório — props atuais do bloco
  fillableSchema: Record<string, {       // obrigatório — metadata aiFillable filtrada
    hint: string;
    format?: 'text' | 'html' | 'cta' | 'label' | 'feedback';
    minItems?: number;
    maxItems?: number;
    itemSchema?: Record<string, { hint: string; enabled: boolean }>;
  }>;
  pageContext?: {            // opcional
    pageName?: string;
    pageType?: string;
    pageDescription?: string;
  };
}
```

### Contrato de Saída

```typescript
// 200 OK
{ success: true, filledProps: Record<string, unknown> }

// 400/401/403/429/402/500
{ success: false, error: string }
```

### Fluxo de Processamento

1. Valida Bearer token via `getClaims()`
2. Valida payload (campos obrigatórios)
3. Verifica acesso ao tenant via `user_has_tenant_access` RPC
4. Filtra `fillableSchema`: aceita apenas keys que existam em `currentProps`
5. Busca contexto da loja em `store_settings` (nome, descrição, SEO)
6. Constrói tool schema dinâmico a partir do `fillableSchema` validado
7. Chama `aiChatCompletionJSON` com tool calling (forçando `fill_block_content`)
8. Extrai resultado do tool call
9. Valida e sanitiza output (HTML, arrays, tipos)
10. Retorna `filledProps`

### Validação de Segurança (fillableSchema)

| Proteção | Implementação |
|----------|---------------|
| Keys inválidas | Apenas keys presentes em `currentProps` são aceitas |
| Output type | Apenas strings e arrays de strings/objetos retornados |
| HTML sanitization | Tags permitidas: `p`, `strong`, `em`, `ul`, `ol`, `li`, `h2`, `h3`, `br`, `span` |
| Atributos HTML | Removidos: `style`, `class`, `on*` (event handlers) |
| Array bounds | Truncado em `maxItems`; `itemSchema` filtra apenas campos `enabled: true` |
| Texto plano | Tags HTML removidas de campos sem `format: 'html'` |

### Tratamento de Erros

| Erro | Status | Mensagem |
|------|--------|----------|
| Sem Bearer token | 401 | "Não autorizado" |
| Token inválido | 401 | "Token inválido" |
| Campos obrigatórios faltando | 400 | Mensagem descritiva |
| fillableSchema vazio após validação | 400 | "Nenhum campo válido" |
| Sem acesso ao tenant | 403 | "Acesso negado ao tenant" |
| Rate limit (429) | 429 | "Limite de requisições atingido" |
| Créditos insuficientes (402) | 402 | "Créditos de IA insuficientes" |
| IA não retornou tool call | 500 | "A IA não retornou conteúdo estruturado" |
| Parse error do tool call | 500 | "Falha ao processar resposta da IA" |

### Escopo da Fase 2.2

| Item | Status |
|------|--------|
| Edge function `ai-block-fill` | ✅ |
| Entrada em `config.toml` | ✅ |
| Auth manual via `getClaims()` | ✅ |
| Validação de `fillableSchema` contra `currentProps` | ✅ |
| Sanitização de HTML no output | ✅ |
| Contexto da loja via `store_settings` | ✅ |
| Tool calling com schema dinâmico | ✅ |
| Hook `useAIBlockFill` | ✅ (Fase 2.3) |
| Botão no PropsEditor | ✅ (Fase 2.3) |
| Preenchimento em lote | ❌ (futuro) |

### Fase 2.3 — Hook + UI no PropsEditor

#### Arquivos criados/alterados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useAIBlockFill.ts` | **Criado** — hook que extrai fillableSchema, chama edge function, aplica merge fill-empty |
| `src/components/builder/PropsEditor.tsx` | **Alterado** — novas props `tenantId`, `pageName`; botão "✨ IA" no header |
| `src/components/builder/VisualBuilder.tsx` | **Alterado** — repassa `tenantId` e `pageTitle` (como `pageName`) ao PropsEditor |

#### Hook `useAIBlockFill`

| Campo | Valor |
|-------|-------|
| **Tipo** | Hook |
| **Localização** | `src/hooks/useAIBlockFill.ts` |
| **Contexto** | Usado pelo PropsEditor para gerar conteúdo IA por bloco |
| **Descrição** | Extrai campos `aiFillable` do propsSchema, chama `ai-block-fill`, aplica merge fill-empty |
| **Parâmetros** | `tenantId`, `blockType`, `currentProps`, `propsSchema`, `pageContext` |
| **Retorno** | `{ fill, isLoading, hasFillableProps }` |
| **Merge** | Preenche apenas campos vazios/default. Campos editados pelo usuário são preservados |
| **Undo/Redo** | Funciona automaticamente — `fill()` retorna props merged, PropsEditor chama `onChange()` que entra no histórico |
| **Erros** | Exibidos via `showErrorToast` (error-toast.ts) |
| **Sucesso** | Toast "Conteúdo gerado com IA ✨" via sonner |

#### Botão "✨ IA" no PropsEditor

| Campo | Valor |
|-------|-------|
| **Tipo** | Botão |
| **Localização** | Header do PropsEditor, ao lado do nome do bloco |
| **Condições de exibição** | `hasFillableProps === true` E `tenantId` definido. Não aparece em system blocks |
| **Comportamento** | Clique → `fill()` → merge fill-empty → `onChange(merged)` → histórico do builder |
| **Loading** | Botão mostra spinner + "Gerando..." + disabled |
| **Clique duplo** | Bloqueado por `isLoading` |
| **Visual** | `variant="outline"`, `size="sm"`, ícone Sparkles |

#### Regras de merge fill-empty

- Campo vazio (`''`, `null`, `undefined`) → preenchido pela IA
- Campo com valor `defaultValue` do schema → preenchido pela IA
- Array vazio (`[]`) → preenchido pela IA
- Campo já editado pelo usuário → **preservado**
- Props não textuais (imagem, cor, etc.) → **nunca tocadas** (não estão no fillableSchema)

#### Escopo da Fase 2.3

| Item | Status |
|------|--------|
| Hook `useAIBlockFill` | ✅ |
| Botão no PropsEditor | ✅ |
| Merge fill-empty | ✅ |
| Undo/redo | ✅ (via fluxo existente) |
| Toast sucesso/erro | ✅ |
| Preenchimento em lote | ❌ (futuro) |
| Modo "substituir tudo" | ❌ (futuro) |
| Diálogo de confirmação | ❌ (futuro) |

---

## Fase 3: Wizard de Preenchimento por IA Guiado por Bloco

### Princípio Central

**IA não decide estrutura, dependências nem vínculos de dados.**
**IA só gera conteúdo dentro de um escopo previamente definido pelo usuário e pelo bloco.**

### Classificação dos Blocos

#### Grupo A — Text-Only (fluxo direto, sem wizard)
Blocos que só precisam de preenchimento textual. O `useAIBlockFill` existente funciona.
Total: ~20 blocos (FAQ, RichText, Testimonials, Reviews, FeatureList, etc.)

#### Grupo B — Wizard Necessário (dependências + geração visual)
Blocos que exigem decisões do usuário antes da geração:

| Bloco | Dependências do Usuário | IA Gera | IA Nunca Toca |
|---|---|---|---|
| **Banner (single)** | Modo, Escopo, Associação | imageDesktop, imageMobile, title, subtitle, buttonText (filtrado por scope) | mode, linkUrl, buttonUrl, cores, height, alignment |
| **Banner (carousel)** | Modo, Escopo, Qtd slides + associação por slide | slides[] (imagens + texto por slide, filtrado por scope) | mode, autoplaySeconds, showArrows, showDots, cores |
| **BannerProducts** | source + productIds/categoryId (já no bloco) | imageDesktop, imageMobile, title, description | source, productIds, categoryId, limit, ctaUrl |
| **TextBanners** | Briefing obrigatório (tema) | imageDesktop1/2, imageMobile1/2 | title, text, ctaText (já são Grupo A), layout, ctaUrl, cores |
| **ImageCarousel** | Qtd de imagens + briefing | images[] | autoplay, showArrows, showDots, aspectRatio, slidesPerView |
| **ImageGallery** | Qtd de imagens + briefing | images[] | columns, gap, enableLightbox, aspectRatio, borderRadius |

### Arquitetura

#### Componentes

| Tipo | Componente | Localização | Descrição |
|------|-----------|-------------|-----------|
| Componente | AIFillWizardDialog | `src/components/builder/ai-wizard/AIFillWizardDialog.tsx` | Modal genérico de steps do wizard |
| Componente | WizardStepRenderer | `src/components/builder/ai-wizard/WizardStepRenderer.tsx` | Renderiza o componente correto para cada tipo de step |
| Componente | BannerModeStep | `src/components/builder/ai-wizard/steps/BannerModeStep.tsx` | Step de escolha de modo: único ou carrossel + quantidade de slides |
| Componente | ScopeSelectStep | `src/components/builder/ai-wizard/steps/ScopeSelectStep.tsx` | Step de escolha de escopo: só imagens, só textos, ou ambos |
| Componente | BannerAssociationStep | `src/components/builder/ai-wizard/steps/BannerAssociationStep.tsx` | Step de associação com 4 opções: produto/categoria/URL/nenhum |
| Componente | QuantitySelectStep | `src/components/builder/ai-wizard/steps/QuantitySelectStep.tsx` | Select numérico (slides, imagens) |
| Componente | BriefingStep | `src/components/builder/ai-wizard/steps/BriefingStep.tsx` | Textarea para briefing/tema |
| Componente | SourceSelectStep | `src/components/builder/ai-wizard/steps/SourceSelectStep.tsx` | Valida que BannerProducts tem fonte configurada |
| Componente | ConfirmStep | `src/components/builder/ai-wizard/steps/ConfirmStep.tsx` | Resumo das escolhas antes de gerar |

#### Funções e Hooks

| Tipo | Nome | Localização | Descrição |
|------|------|-------------|-----------|
| Hook | useAIBlockWizard | `src/hooks/useAIBlockWizard.ts` | Gerencia estado do wizard: step atual, navegação, dados coletados |
| Hook | useAIWizardGenerate | `src/hooks/useAIWizardGenerate.ts` | Chama edge function e aplica whitelist merge + scope filtering no frontend |
| Função | getWizardContract | `src/lib/builder/aiWizardRegistry.ts` | Retorna o contrato do bloco ou null (Grupo A) |

#### Registry de Contratos

| Tipo | Nome | Localização | Descrição |
|------|------|-------------|-----------|
| Registry | aiWizardRegistry | `src/lib/builder/aiWizardRegistry.ts` | Mapa declarativo blockType → WizardBlockContract com steps, aiGenerates, aiNeverTouches e hasTextGeneration |

### Padrão Global de 4 Camadas (Fase 3.3)

Todo bloco wizard segue obrigatoriamente 4 camadas:

```text
┌─────────────────────────────────────┐
│  Camada 1: ESTRUTURA DO BLOCO       │
│  modo, quantidade, layout           │
│  (só aparece se o bloco tem opções) │
├─────────────────────────────────────┤
│  Camada 2: ESCOPO DA GERAÇÃO        │
│  O que gerar? Imagens / Textos /    │
│  Imagens+Textos                     │
├─────────────────────────────────────┤
│  Camada 3: CONTEXTO / VÍNCULO       │
│  Produto / Categoria / URL / Tema   │
│  + briefing opcional                │
├─────────────────────────────────────┤
│  Camada 4: CONFIRMAÇÃO              │
│  Resumo de tudo + botão Gerar       │
└─────────────────────────────────────┘
```

Camadas sem opções para um bloco específico são puladas automaticamente.

### Classificação de Props (5 categorias)

| Categoria | Significado | Exemplos (Banner) |
|---|---|---|
| **Estrutural** | Define a forma do bloco. Wizard camada 1. | `mode`, `slides` (contagem) |
| **Gerável por IA** | A IA pode preencher se no escopo. Wizard camada 2. | `imageDesktop`, `imageMobile`, `title`, `subtitle`, `buttonText` |
| **Derivada pelo sistema** | Calculada automaticamente. Nunca IA. | `linkUrl`, `buttonUrl` (derivados do produto/categoria) |
| **Proibida para IA** | Config visual/técnica que IA nunca toca. | `backgroundColor`, `textColor`, `overlayOpacity`, `height` |
| **Manual apenas** | Só faz sentido no caminho manual. | `autoplaySeconds`, `showArrows`, `showDots` |

### Step Types

| Step Type | Descrição | Payload de Saída |
|---|---|---|
| `banner-mode-select` | Escolha de modo (único/carrossel) + quantidade de slides | `BannerModeData` (bannerMode, slideCount) |
| `scope-select` | Escolha de escopo (imagens/textos/ambos) | `GenerationScope` ('images' \| 'texts' \| 'all') |
| `banner-association` | Seletor com 4 modos: produto, categoria, URL, nenhum | `BannerAssociationPayload` |
| `quantity-select` | Select numérico (min/max) | `number` |
| `source-select` | Valida fonte existente no bloco (BannerProducts) | Lê de currentProps |
| `briefing` | Textarea com placeholder contextual | `string` |
| `confirm` | Resumo + botão gerar | — |

### Source of Truth para Vínculos Reais

Quando o usuário escolhe um produto no wizard, o backend busca e usa como contexto:

| Dado | Campo | Uso |
|---|---|---|
| Nome real | `products.name` | Prompt de imagem e texto |
| Descrição real | `products.description` | Contexto para copy (até 300 chars) |
| Slug real | `products.slug` | Derivar `linkUrl = /produto/{slug}` |
| Imagem principal | `products.images[0]` | Referência visual (futuro) |
| Nome categoria | `categories.name` | Prompt contexto |
| Slug categoria | `categories.slug` | Derivar `linkUrl = /categoria/{slug}` |

### Fluxo do Banner (Fase 3.3)

```text
Step 1: ESTRUTURA (banner-mode-select)
  "Que tipo de banner quer criar?"
  ○ Banner Único
  ○ Carrossel → "Quantos slides?" [2-3]

Step 2: ESCOPO (scope-select)
  "O que deseja gerar?"
  ☑ Imagens
  ☑ Textos

Step 3: VÍNCULO (banner-association) [repetido por slide se carrossel]
  "Para onde o banner direciona?"
  ○ Produto → seletor
  ○ Categoria → seletor
  ○ URL manual → input
  ○ Nenhum (institucional)

Step 4: BRIEFING (briefing)
  "Descreva o objetivo" (opcional)

Step 5: CONFIRMAÇÃO (confirm)
  Resumo: tipo, escopo, vínculo, briefing
  [Gerar com IA]
```

### Escopo da Fase 3.3 (Banner)

| Item | Status |
|------|--------|
| Contrato unificado do Banner (sem split single/carousel) | ✅ |
| Step BannerModeStep (único/carrossel + slides) | ✅ |
| Step ScopeSelectStep (imagens/textos/ambos) | ✅ |
| Modo escolhido DENTRO do wizard (não depende de config externa) | ✅ |
| Escopo escolhido pelo usuário (IA não presume) | ✅ |
| Backend aceita `scope` e filtra geração | ✅ |
| Backend busca dados reais expandidos do produto (nome, descrição, slug) | ✅ |
| Frontend filtra merge por scope | ✅ |
| Wizard expande associação por slide dinamicamente | ✅ |
| Blocos textuais inalterados | ✅ |
| Outros blocos wizard (expansão) | ❌ (próxima fase) |

### Integração no PropsEditor

O botão "✨ IA" no cabeçalho do PropsEditor verifica:
1. Se o bloco tem `WizardBlockContract` (via `getWizardContract`) → abre `AIFillWizardDialog`
2. Se não tem contrato mas tem `aiFillable` no schema → executa fill direto (Grupo A, comportamento existente)
3. Se não tem nenhum → botão não aparece

---

## Fase 3.2: Geração Visual do Wizard (Banner) [REFATORADO → 3.3]

### Princípio de Segurança (Trust Boundary)

**O backend NÃO confia no contrato vindo do frontend.**
O frontend envia apenas `blockType`, `mode`, `scope` e `collectedData`.
O backend resolve internamente o contrato permitido a partir do `SERVER_CONTRACTS` (registry server-side).

### Arquitetura

```text
Frontend (Wizard confirm step)
  │
  └─ supabase.functions.invoke('ai-block-fill-visual', {
       blockType, mode, scope, collectedData, tenantId
     })
       │
       ├─ 1. Backend resolve contrato via SERVER_CONTRACTS[blockType:mode]
       │     Rejeita blockType/mode desconhecido com 400
       │
        ├─ 2. Busca dados REAIS do produto (nome, descrição, slug, preço, compare_at_price)
        │     Source of truth — IA não inventa produto genérico
        │     Imagem principal via tabela `product_images` (ORDER BY is_primary DESC, sort_order ASC LIMIT 1)
        │     Fallback: se produto sem imagem, geração continua apenas com contexto textual
        │
        ├─ 2b. Busca contexto expandido do tenant
        │      `store_name` + `store_description` de `store_settings`
        │      Usado no prompt para ancorar identidade da marca
        │
        ├─ 3. Filtra por scope (images/texts/all)
        │     Só gera o que o usuário escolheu
        │
        ├─ 4. Gera imagens se scope inclui (Gemini Image Pro → fallback Flash)
        │     Desktop (1920×700) + Mobile (750×420) por slide
        │     Upload para store-assets/{tenantId}/block-creatives/
        │     **MULTIMODAL (v2.1.0):** Envia imagem real do produto como referência visual ao modelo
        │     quando disponível — o modelo recebe [texto + imagem] para gerar banner aderente
        │
        ├─ 5. Gera textos se scope inclui (aiChatCompletionJSON via ai-router)
        │     Tool calling para título/subtítulo/CTA com contexto real do produto
        │     Inclui store_description no contexto para aderência à marca
        │
        └─ 6. Retorna { success, generatedProps }
               generatedProps só contém keys da whitelist server-side filtradas por scope
```

### Componentes

| Tipo | Nome | Localização | Descrição |
|------|------|-------------|-----------|
| Edge Function | ai-block-fill-visual v2.1.0 | `supabase/functions/ai-block-fill-visual/index.ts` | Gera imagens e textos com scope filtering, dados reais expandidos, contexto de marca e referência multimodal |
| Hook | useAIWizardGenerate | `src/hooks/useAIWizardGenerate.ts` | Chama edge function e aplica whitelist merge + scope filtering |

### Grounding do Banner (v2.1.0)

> Correção implementada para eliminar banners genéricos quando um produto é selecionado.

#### Source of truth do produto
- Nome, descrição, slug, preço e preço comparativo são buscados da tabela `products`
- Imagem principal é buscada da tabela `product_images` (não da tabela `products`)
- Prioridade: `is_primary DESC, sort_order ASC, LIMIT 1`
- Fallback: se o produto não tem imagem cadastrada, a geração continua sem referência visual

#### Contexto do tenant
- `store_name` e `store_description` são buscados de `store_settings`
- Ambos entram no prompt visual e textual para ancorar na identidade real da loja

#### Geração multimodal
- Quando a imagem principal do produto está disponível, ela é enviada como referência visual ao modelo
- O payload enviado ao modelo é multimodal: `[{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url } }]`
- O prompt instrui explicitamente o modelo a representar o produto mostrado na imagem de referência
- Sem imagem disponível, a geração usa apenas prompt textual (comportamento anterior)

#### Prompt enriquecido
- Inclui nome real, descrição, preço/oferta e contexto da loja
- Instrução explícita: "represente visualmente ESTE produto real"
- Objetivo: eliminar banners genéricos de e-commerce

### Regras de Merge

1. Backend gera `generatedProps` filtrado pela whitelist server-side E pelo scope
2. Frontend aplica segundo filtro via `contract.aiGenerates` + scope (defesa em profundidade)
3. `linkUrl` de cada slide é derivado da associação (sistema), NUNCA da IA
4. Para carousel, backend limita `slideCount` ao `maxSlides` do contrato (3)
5. Modo do bloco é atualizado pelo merge quando wizard altera de single para carousel

### Limites

| Aspecto | Valor |
|---------|-------|
| Max slides no carousel | 3 |
| Max imagens por execução | 6 (3 × desktop+mobile) |
| Timeout budget | 130s |
| Retry por imagem | 1 (pro → flash fallback) |
| Partial success | Não — falha total se qualquer imagem falhar |
| Briefing max chars | 500 |
