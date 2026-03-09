# Plano: Aderência Total da Loja à Renderização Edge

---

## 🐛 BUGS CRÍTICOS IDENTIFICADOS

### BUG 1: Botão "Adicionar ao Carrinho" não funciona (CORRIGIDO ✅)
**Diagnóstico**: Botões dentro de `<a>` propagam clique e navegam ao invés de executar ação.  
**Correção**: Adicionado `onclick="event.stopPropagation()"` em featured-products.ts e category-page-layout.ts.

### BUG 2: Banner de categoria não renderiza
**Diagnóstico**: Se o tenant publicou template customizado de categoria SEM incluir o bloco `CategoryBanner`, o banner não aparece. O fallback default inclui, mas o customizado não.  
**Localização**: Builder não insere `CategoryBanner` automaticamente no template `published_content.category`.  
**Correção Necessária**:
- Opção A: Injetar `CategoryBanner` automaticamente ANTES do conteúdo customizado (se `currentCategory` tiver banner)
- Opção B: Documentar que lojista precisa incluir bloco CategoryBanner manualmente
- **RECOMENDADO**: Opção A - injetar no storefront-html quando `category.banner_desktop_url` existir

### BUG 3: Galeria de imagens do produto estática (sem slider/navegação)
**Diagnóstico**: O HTML da galeria está correto com dots e slides, mas o JS de hidratação para mobile swipe/dots **não está funcionando corretamente no domínio público**.  
**Verificação Necessária**:
1. Verificar se o script `sf-gallery-track` com scroll-snap está sendo injetado
2. Verificar se os event listeners para dots e swipe estão funcionando
3. Verificar se há conflito de CSS/JS entre builder e edge

### BUG 4: Produtos relacionados não herdam categorySettings
**Diagnóstico**: Em `product-details.ts`, linhas 378-416, os cards de produtos relacionados são renderizados com estilos hardcoded, NÃO respeitando:
- `showRatings` do categorySettings
- `showBadges` do categorySettings  
- `showAddToCartButton` do categorySettings
- `quickBuyEnabled` do categorySettings
**Correção**: Refatorar seção de produtos relacionados para usar mesma lógica de cards do `category-page-layout.ts`

### BUG 5: Botões de CTA na página de produto podem não funcionar
**Diagnóstico**: Botões `data-sf-action="add-to-cart"` e `data-sf-action="buy-now"` dependem do script de hidratação.  
**Verificação**: Confirmar que o JS está sendo executado e processando esses data attributes.

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
Carrinho (+ CrossSell), Checkout (+ Order Bump), Obrigado (+ Upsell), Minha Conta → interatividade complexa

---

## 🚀 PLANO DE EXECUÇÃO

### Fase 0: Bugs Críticos (URGENTE) ⚡
1. ✅ **Corrigir botões add-to-cart** — stopPropagation (FEITO)
2. 🔴 **Corrigir banner de categoria** — injetar automaticamente se existir banner_desktop_url
3. 🔴 **Corrigir galeria de imagens** — verificar/consertar JS de hidratação (swipe, dots)
4. 🔴 **Produtos relacionados herdar categorySettings** — refatorar cards para usar mesma lógica

### Fase 1: Blocos de Layout
5. Container
6. Columns + Column
7. Grid

### Fase 2: Blocos Interativos de Alta Conversão
8. Newsletter
9. FAQ
10. Testimonials
11. Accordion

### Fase 3: Blocos de Mídia
12. YouTubeVideo
13. VideoCarousel
14. HTMLSection
15. ImageGallery

### Fase 4: Blocos de Marketing
16. CountdownTimer, LogosCarousel, StatsNumbers
17. ContentColumns, FeatureList, StepsTimeline, TextBanners

### Fase 5: Blocos E-commerce Avançados
18. ProductGrid, ProductCarousel, CategoryList, CollectionSection, BannerProducts

### Fase 6: Verificações Globais
19. Pixels de marketing no `<head>`
20. Newsletter Popup injection
21. Consent Banner injection

### Fase 7: Auditoria Visual + Centralização
22. Comparar loja respeiteohomem builder vs público
23. Corrigir divergências visuais
24. **Centralizar sistema de cores** (design tokens únicos)
25. **Centralizar lógica de frete grátis** (único ponto de verdade)

---

## Dead Code para Remover
- `_shared/block-compiler/blocks/product-page.ts` (confirmado morto)
