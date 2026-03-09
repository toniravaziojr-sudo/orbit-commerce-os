# Plano: Aderência Total da Loja à Renderização Edge

---

## 🐛 BUG ENCONTRADO: Botão "Adicionar ao Carrinho" não funciona

### Diagnóstico
Os botões de "Adicionar ao carrinho" nos cards de produto (FeaturedProducts, CategoryPageLayout) estão **dentro de tags `<a>`** que envolvem o card inteiro. Quando o usuário clica no botão, o clique propaga para a tag `<a>` e **navega para a página do produto** antes que o JS de hidratação processe a ação.

### Causa Raiz
Falta `onclick="event.stopPropagation()"` nos botões para impedir que o clique suba para o link pai.

### Arquivos Afetados
- `supabase/functions/_shared/block-compiler/blocks/featured-products.ts` (linhas 83-91)
- `supabase/functions/_shared/block-compiler/blocks/category-page-layout.ts` (linhas 122-125)
- `supabase/functions/_shared/block-compiler/blocks/product-details.ts` (seção Buy Together, linhas 291)

### Correção Necessária
```html
<!-- ANTES (quebrado) -->
<button data-sf-action="add-to-cart" ...>Adicionar</button>

<!-- DEPOIS (correto) -->
<button onclick="event.stopPropagation()" data-sf-action="add-to-cart" ...>Adicionar</button>
```

---

## 📊 RESUMO: Sistema de Cores da Loja

### Arquitetura Geral
```
┌───────────────────────────────────────────────────────────────────┐
│              FONTE DE VERDADE: storefront_template_sets           │
│                                                                    │
│  draft_content.themeSettings.colors    → Builder (preview)        │
│  published_content.themeSettings.colors → Loja pública            │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│              INJEÇÃO DE CSS (2 caminhos paralelos)                │
├───────────────────────────────────────────────────────────────────┤
│  BUILDER:        useBuilderThemeInjector.ts                       │
│  LOJA PÚBLICA:   StorefrontThemeInjector.tsx                      │
│  EDGE HTML:      CSS inline no <head> via storefront-html         │
└───────────────────────────────────────────────────────────────────┘
```

### Grupos de Cores Disponíveis (ColorSettings.tsx)

| Grupo | Variáveis CSS | Uso |
|-------|--------------|-----|
| **Botão Primário** | `--theme-button-primary-bg`, `--theme-button-primary-text`, `--theme-button-primary-hover` | CTAs principais: "Comprar", "Adicionar" |
| **Botão Secundário** | `--theme-button-secondary-bg`, `--theme-button-secondary-text`, `--theme-button-secondary-hover` | Botões secundários |
| **WhatsApp** | `--theme-whatsapp-color`, `--theme-whatsapp-hover` | Botão "Comprar pelo WhatsApp" |
| **Texto** | `--theme-text-primary`, `--theme-text-secondary` | Títulos, parágrafos |
| **Destaque** | `--theme-accent-color` | Preços PIX, selos especiais |
| **Preço** | `--theme-price-color` | **Valor principal** (preço com desconto) — separado do texto! |
| **Promo/Tags** | `--theme-promo-bg`, `--theme-promo-text` | Tags promocionais |

### Classes CSS Semânticas (sf-btn-*)

| Classe | Estilo | Hover |
|--------|--------|-------|
| `.sf-btn-primary` | Sólido (bg primária) | Escurece + translateY(-1px) |
| `.sf-btn-outline-primary` | Borda primária, fundo transparente | Preenche com cor primária |
| `.sf-btn-secondary` | Sólido (bg secundária) | Escurece |
| `.sf-btn-outline-secondary` | Borda secundária | Preenche |

### Override do Tailwind
O sistema **sobrescreve** `--primary` e `--primary-foreground` do Tailwind dentro de `.storefront-container` para que classes como `bg-primary`, `text-primary` usem as cores do tema.

### Cores por Página (Overrides Locais)

| Página | Configuração | Variáveis Adicionais |
|--------|-------------|---------------------|
| **Carrinho** | `themeSettings.pageSettings.cart` | `buttonPrimaryBg`, `buttonPrimaryText`, `buttonPrimaryHover`, `buttonSecondaryBg`, etc. |
| **Checkout** | `themeSettings.pageSettings.checkout` + `checkout_header_config` + `checkout_footer_config` | Mesmas + `--theme-flags-color` (badges "Grátis") |
| **Obrigado** | `themeSettings.pageSettings.thankYou` | Cores herdadas |

### Regra de Herança
1. **Cor vazia** (`''`) → Usa cor global do tema
2. **Cor preenchida** → Sobrescreve o tema apenas naquela página

### Pontos de Inconsistência/Melhoria Identificados
1. **Duplicação**: Cores são injetadas por 3 sistemas diferentes (Builder hook, React injector, Edge HTML inline)
2. **Edge HTML hardcodes**: O `storefront-html` duplica a lógica de CSS do React
3. **Falta centralização**: Não existe um único arquivo de "design tokens" compartilhado

---

## 📦 RESUMO: Sistema de Frete Grátis

### Hierarquia de Precedência (3 fontes)

| Prioridade | Fonte | Tabela/Coluna | Descrição |
|------------|-------|--------------|-----------|
| **1 (Máxima)** | Produto | `products.free_shipping` (boolean) | Frete grátis individual do produto |
| **2** | Cupom | `discounts.type = 'free_shipping'` | Cupom de frete grátis aplicado |
| **3** | Regras de Logística | `free_shipping_rules` | Regras condicionais (região, valor mínimo, categoria) |

> Se **qualquer uma** das 3 fontes for verdadeira, o frete é grátis.

### Frete Grátis por Método Específico

| Configuração | Onde | Descrição |
|--------------|------|-----------|
| **Global (padrão)** | `store_settings.default_free_shipping_method` | Ex: "PAC" — todos os produtos com frete grátis usam PAC grátis |
| **Por produto (override)** | `products.free_shipping_method` | Sobrescreve o global para um produto específico |

**Hierarquia de resolução:**
`products.free_shipping_method` → `store_settings.default_free_shipping_method` → **Todos os métodos** (se ambos NULL)

### Comportamento na UI

| Local | Comportamento |
|-------|--------------|
| **Calculadora de frete** | Método gratuito pré-selecionado, badge verde "FRETE GRÁTIS", preço original riscado |
| **Checkout** | Método gratuito selecionado por padrão, outros métodos aparecem como upgrades pagos |
| **Carrinho (Barra de Conversão)** | Se `applyToExternalRules=true`, reconhece frete grátis de TODAS as 3 fontes |

### Barra de Conversão (Benefit Progress Bar)

| Campo | Tabela | Descrição |
|-------|--------|-----------|
| `enabled` | `store_settings.benefit_config` | Ativa/desativa a barra |
| `mode` | — | `'free_shipping'` ou `'gift'` |
| `thresholdValue` | — | Valor mínimo para atingir o benefício |
| `applyToExternalRules` | — | Se `true`, considera frete grátis de produto/cupom além do valor mínimo |

### Edge Function: `shipping-quote`

1. Recebe CEP + itens do carrinho
2. Consulta providers ativos em paralelo (Correios, Frenet, Loggi)
3. Identifica se algum item tem `free_shipping` e qual método
4. Zera o `price` apenas do método correspondente, mantém `original_price`
5. Marca com `is_free: true`
6. Retorna lista unificada com deduplicação

### Pontos de Inconsistência/Melhoria Identificados
1. **Lógica duplicada**: Cálculo de frete grátis em React (hooks) E na Edge Function
2. **Barra de conversão**: Lógica de "atingiu benefício" pode conflitar com frete grátis de produto
3. **UI não consistente**: Badge "Frete Grátis" tem estilos diferentes em cada contexto

---

## 📋 INVENTÁRIO COMPLETO DE BLOCOS

### ✅ 100% Pronto no Edge (19 compiladores + 3 standalone)
- **Layout**: Page, Section
- **Conteúdo**: Text, RichText, Image, Button, Spacer, Divider
- **E-commerce**: HeroBanner, Banner, ImageCarousel, InfoHighlights, FeaturedCategories, FeaturedProducts, CategoryBanner, CategoryPageLayout
- **Produto**: ProductDetails (Reviews, Compre Junto, Relacionados, Variantes, Galeria+Lightbox)
- **Estrutural**: Header, Footer
- **Standalone**: Blog, Institucional

### 🔴 FALTA Compilador (23 blocos)
**Layout (4)**: Container, Columns, Column, Grid

**Interativo (5)**: Newsletter, NewsletterForm, FAQ, Testimonials, NewsletterPopup

**E-commerce (9)**: ProductGrid, ProductCarousel, CategoryList, CollectionSection, BannerProducts, TextBanners, YouTubeVideo, VideoUpload, VideoCarousel

**Marketing (5)**: CountdownTimer, LogosCarousel, StatsNumbers, Accordion, HTMLSection, ContentColumns, FeatureList, StepsTimeline, ImageGallery

### ✅ SPA-only (não precisa edge)
Carrinho, Checkout, Obrigado, Minha Conta → interatividade complexa

---

## 🚀 PLANO DE EXECUÇÃO

### Fase 0: Bug Crítico (URGENTE)
1. **Corrigir botões add-to-cart** — adicionar `onclick="event.stopPropagation()"`

### Fase 1: Blocos de Layout
2. Container
3. Columns + Column
4. Grid

### Fase 2: Blocos Interativos de Alta Conversão
5. Newsletter
6. FAQ
7. Testimonials
8. Accordion

### Fase 3: Blocos de Mídia
9. YouTubeVideo
10. VideoCarousel
11. HTMLSection
12. ImageGallery

### Fase 4: Blocos de Marketing
13. CountdownTimer, LogosCarousel, StatsNumbers
14. ContentColumns, FeatureList, StepsTimeline, TextBanners

### Fase 5: Blocos E-commerce Avançados
15. ProductGrid, ProductCarousel, CategoryList, CollectionSection, BannerProducts

### Fase 6: Verificações Globais
16. Pixels de marketing no `<head>`
17. Newsletter Popup injection
18. Consent Banner injection

### Fase 7: Auditoria Visual + Centralização
19. Comparar loja respeiteohomem builder vs público
20. Corrigir divergências visuais
21. **Centralizar sistema de cores** (design tokens únicos)
22. **Centralizar lógica de frete grátis** (único ponto de verdade)

---

## Dead Code para Remover
- `_shared/block-compiler/blocks/product-page.ts` (confirmado morto)
