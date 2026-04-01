# Importação de Dados

## Objetivo

Permitir que lojistas migrem de outras plataformas de e-commerce para o nosso sistema, importando seus dados de forma estruturada e adaptada à nossa arquitetura.

---

## Fluxo de 3 Etapas

```
┌─────────────────────────────────────────────────────────────────┐
│                        ETAPA 1: URL DA LOJA                     │
│  Cliente informa URL → Sistema detecta plataforma automaticamente│
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                   ETAPA 2: IMPORTAR ARQUIVOS                    │
│  Cliente fornece arquivos CSV/JSON exportados da plataforma     │
│  → Produtos, Clientes e Pedidos (com adaptadores por plataforma)│
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                ETAPA 3: ESTRUTURA DA LOJA (SCRAPING)            │
│  Via URL: Categorias, Páginas Institucionais e Menus            │
│  (extraídos navegando pelos links do header/footer)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Etapa 1: Detecção de Plataforma

### Comportamento

1. Cliente informa a URL da loja atual (ex: `https://minhaloja.com.br`)
2. Sistema faz scraping via Firecrawl para obter HTML
3. Detector analisa HTML + URL para identificar plataforma
4. Exibe resultado: "Plataforma: Shopify (confiança: alta)"

### Plataformas Suportadas

| Plataforma | ID | Detecção |
|------------|-------|----------|
| Shopify | `shopify` | cdn.shopify.com, myshopify.com, Shopify.theme |
| Nuvemshop | `nuvemshop` | nuvemshop, tiendanube, lojavirtualnuvem |
| Tray | `tray` | tray.com.br, smb.tray.min.js, Pixel-Tray |
| WooCommerce | `woocommerce` | woocommerce, wp-content, wc-block |
| Bagy | `bagy` | bagy.com.br, bfrota.com.br |
| Yampi | `yampi` | yampi.com.br, data-yampi |
| Loja Integrada | `loja_integrada` | lojaintegrada.com.br |
| Wix | `wix` | wixsite.com, wixstatic.com |
| VTEX | `vtex` | vtexcommercestable, vteximg |
| Magento | `magento` | Mage., mage-init |
| OpenCart | `opencart` | opencart, catalog/view |
| PrestaShop | `prestashop` | PrestaShop |

### Arquivos Relacionados

- `src/lib/import/detector.ts` - Detector centralizado de plataformas
- `src/components/import/StoreUrlInput.tsx` - Input de URL
- `supabase/functions/firecrawl-scrape/index.ts` - Scraping

---

## Etapa 2: Importação via Arquivos

### Comportamento

1. Sistema já sabe a plataforma (da Etapa 1)
2. Cliente faz upload de arquivos CSV/JSON exportados da plataforma original
3. Sistema usa **adaptador específico da plataforma** para normalizar dados
4. Dados são adaptados para **nossa estrutura** (nunca o contrário)

### Módulos de Importação

| Módulo | Arquivo Esperado | Destino |
|--------|------------------|---------|
| Produtos | products.csv / products.json | `products`, `product_variants`, `product_images` |
| Clientes | customers.csv / customers.json | `customers`, `customer_addresses` |
| Pedidos | orders.csv / orders.json | `orders`, `order_items` |

### Adaptadores por Plataforma

Cada plataforma tem um adaptador que:
1. **Mapeia campos** - ex: Shopify `Handle` → nosso `slug`
2. **Normaliza valores** - ex: preço "R$ 99,90" → 9990 (centavos)
3. **Consolida registros** - ex: variantes Shopify em múltiplas linhas → produto único

| Plataforma | Adaptador |
|------------|-----------|
| Shopify | `src/lib/import/platforms/shopify.ts` |
| Nuvemshop | `src/lib/import/platforms/nuvemshop.ts` |
| Tray | `src/lib/import/platforms/tray.ts` |
| WooCommerce | `src/lib/import/platforms/woocommerce.ts` |
| Bagy | `src/lib/import/platforms/bagy.ts` |
| Yampi | `src/lib/import/platforms/yampi.ts` |
| Loja Integrada | `src/lib/import/platforms/loja-integrada.ts` |
| Wix | `src/lib/import/platforms/wix.ts` |

### Mapeamento de Colunas Nuvemshop (Tiendanube)

O CSV exportado pela Nuvemshop usa nomes de colunas em português. O adaptador mapeia automaticamente:

| Coluna CSV (PT-BR) | Campo Interno | Observações |
|-------------------|---------------|-------------|
| `Nome do produto` | `name` | |
| `Identificador URL` ou `URL` | `slug` | Ambos aceitos |
| `Preço` | `price_cents` | Formato BR: "99,90" → 9990 |
| `Preço promocional` | `compare_at_price_cents` | |
| `Custo` | `cost_cents` | |
| `SKU` | `sku` | |
| `Código de barras` | `barcode` | |
| `Estoque` | `stock` | |
| `Peso (kg)` | `weight_kg` | Converte para gramas |
| `Altura (cm)` | `height_cm` | |
| `Largura (cm)` | `width_cm` | |
| `Comprimento (cm)` | `depth_cm` | |
| `Categorias` ou `Categoria` | `categories` | Separa por vírgula e hierarquia ("Cat > Sub") |
| `Descrição` | `description` | HTML suportado |
| `Exibir na loja` | `status` | "Sim" = active, "Não" = draft |
| `URL da imagem X` | `images` | Até 10 imagens (URL da imagem 1-10) |
| `Título para SEO` ou `Título SEO` | `seo_title` | |
| `Descrição para SEO` ou `Descrição SEO` | `seo_description` | |
| `Produto Físico` | `is_physical` | "Sim" = true |
| `Tags` | `tags` | Separadas por vírgula |
| `Marca` | `brand` | |
| `Variação X` | `variants` | Até 3 variações (cor, tamanho, etc.) |

**Observações importantes:**
- Preços em formato brasileiro (vírgula decimal, ponto milhar) são convertidos automaticamente
- Hierarquia de categorias com ">" (ex: "Roupas > Vestidos") cria subcategorias
- Colunas de imagem numeradas de 1 a 10 são consolidadas em array
- Variantes em múltiplas linhas são consolidadas no mesmo produto pelo `Identificador URL`

### Tratamento de Encoding e Mojibake

O sistema corrige automaticamente problemas de encoding comuns em CSVs exportados (especialmente Nuvemshop):

#### Problema: Mojibake (Caracteres Corrompidos)

CSVs salvos com encoding Latin-1 (ISO-8859-1) mas lidos como UTF-8 causam mojibake:
- `ç` → `Ã§`
- `ã` → `Ã£`
- `é` → `Ã©`
- `ô` → `Ã´`

#### Correção em 2 Níveis

**Nível 1: Leitura do arquivo** - `readFileWithEncoding()` em `src/lib/import/utils.ts`:
- Lê o arquivo como UTF-8 primeiro
- Detecta padrões mojibake (≥3 ocorrências)
- Se detectado, relê o arquivo como `iso-8859-1` (Latin-1) via `TextDecoder`
- Fallback: aplica `fixMojibakeText()` se releitura falhar

**Nível 2: Headers** - `normalizeHeader()` em `src/lib/import/utils.ts`:

```typescript
// Mapa de correção mojibake → caractere correto
const mojibakeMap: Record<string, string> = {
  'Ã§': 'c', 'Ã£': 'a', 'Ãµ': 'o', 'Ã¡': 'a',
  'Ã©': 'e', 'Ãª': 'e', 'Ã­': 'i', 'Ã³': 'o',
  'Ã´': 'o', 'Ãº': 'u', 'Ã': 'A', 'Ã‰': 'E',
  'Ã"': 'O', 'Ãœ': 'U'
};
```

#### Matching de 4 Camadas

O `getColumnValue()` usa estratégia de 4 passes para encontrar colunas:

1. **Match Exato** - Nome exato da coluna
2. **Match Normalizado** - Sem acentos e lowercase
3. **Match Fuzzy** - Primeiros 4 caracteres
4. **Match Substring** - Contém termo chave

Isso garante que colunas como `"Preço"` sejam encontradas mesmo se aparecem como `"Preo"` ou `"preco"` após corrupção de encoding.

#### Preços: Formato Brasileiro vs. Nuvemshop

O `parseBrazilianPrice()` detecta automaticamente:
- **Nuvemshop export**: `49.90` (ponto decimal, estilo US)
- **Display BR**: `49,90` ou `1.499,90` (vírgula decimal, ponto milhar)

```typescript
// Heurística: Se tem vírgula seguida de 2 dígitos no final, é formato BR
if (/,\d{2}$/.test(normalized)) {
  // Formato brasileiro: remove pontos, troca vírgula por ponto
}
```


### Regra Fundamental

> **A nossa estrutura NUNCA é alterada.**
> Os dados extraídos devem se adaptar para preencher nossa estrutura.
> Se um campo da plataforma origem não existe no nosso sistema, ele é ignorado.
> Se um campo obrigatório nosso não existe na origem, usa-se valor padrão.

### Arquivos Relacionados

- `src/lib/import/platforms/index.ts` - Central de adaptadores
- `src/lib/import/utils.ts` - Parse CSV, consolidação Shopify/Nuvemshop, encoding
- `src/lib/import/types.ts` - Tipos normalizados
- `src/components/import/ImportStep.tsx` - Step de upload
- `supabase/functions/import-products/index.ts` - Motor canônico de produtos
- `supabase/functions/import-orders/index.ts` - Motor canônico de pedidos
- `supabase/functions/import-customers/index.ts` - Motor canônico de clientes (Smart Merge)

---

## Etapa 3: Estrutura da Loja (Scraping com IA)

### Arquitetura

A Etapa 3 utiliza uma arquitetura baseada em **IA + Firecrawl** para extração inteligente:

```
┌──────────────┐    ┌───────────────┐    ┌─────────────────┐    ┌──────────────┐
│   URL Loja   │ →  │  Firecrawl    │ →  │  Lovable AI     │ →  │  Blocos do   │
│              │    │  (Scraping)   │    │  (Gemini 2.5)   │    │  Builder     │
└──────────────┘    └───────────────┘    └─────────────────┘    └──────────────┘
```

### Comportamento

1. Sistema usa a URL da Etapa 1 para fazer scraping via Firecrawl
2. Navega pelos links do **header** e **footer** da loja alvo
3. **IA classifica** URLs e extrai conteúdo de forma inteligente
4. Identifica e extrai:
   - **Categorias** - via detecção de grid de produtos
   - **Páginas Institucionais** - com conversão para blocos nativos do Builder
   - **Menus** - estrutura hierárquica de navegação

### Sub-etapas (ordem obrigatória)

| Ordem | Item | Fonte | Destino |
|-------|------|-------|---------|
| 1 | Categorias | Links `/collections/`, `/categoria/`, `/c/` | `categories` |
| 2 | Páginas | Links `/pages/`, `/politica/`, `/sobre/` | `store_pages` (com blocos editáveis) |
| 3 | Menus | Estrutura header/footer | `menus`, `menu_items` |

> **Menus por último** pois dependem de categorias e páginas já existirem para vincular `ref_id`.

---

## Categorias: Detecção e Extração

### Detecção de Página de Categoria

O sistema NÃO confia apenas em padrões de URL. Ele verifica se a página contém um **grid de produtos**:

```typescript
// Critérios para confirmar categoria
- Mínimo 2 cards de produto (.product-card, .product-item)
- Preços no formato R$ (indicam produtos à venda)
- Botões de compra/adicionar ao carrinho
```

Padrões de URL que indicam categoria (candidatos):
```
/collections/{slug}     (Shopify)
/categoria/{slug}       (Genérico BR, Nuvemshop)
/categorias/{slug}      (Nuvemshop)
/category/{slug}        (Inglês)
/c/{slug}               (Abreviado, Nuvemshop)
/departamento/{slug}    (Tray, VTEX, Nuvemshop)
/departamentos/{slug}   (Nuvemshop)
/shop/{slug}            (WooCommerce)
```

### Detecção de Grid de Produtos por Plataforma

**Shopify:**
```
.product-grid, .collection-grid, .product-list
```

**Nuvemshop/Tiendanube (SPA):**
```typescript
// Classes com prefixo js- (renderizadas via JavaScript)
- div.js-product-table, div.product-table, div.js-product-grid
- div.js-item-product, div.item-product, div.product-item
- article.js-item-product, article.item-product, article.product-item
- [data-product-id="..."], [data-item-id="..."]
- a[href*="/produtos/"], a[href*="/product/"]
```

> **IMPORTANTE**: Nuvemshop usa SPA pesado em JavaScript. O scraper aguarda 5000ms para renderização completa.

### Extração de Banners

O sistema extrai banners **desktop** e **mobile**:

**Banner Desktop:**
- Classes: `category-banner`, `collection-banner`, `hero`
- Nuvemshop: `js-category-banner`, `banner-category`
- Elemento `<picture>` com `media="(min-width...)"`
- Primeiro `<img>` grande dentro do `<main>`

**Banner Mobile:**
- Elemento `<source>` com `media="(max-width...)"`
- Atributos: `data-mobile-src`, `data-src-mobile`, `data-srcset-mobile`
- Srcset com tamanhos pequenos: `320w`, `375w`, `480w`
- Classes: `mobile`, `show-mobile`, `visible-xs`, `d-none` (desktop hidden)
- Fallback: menor tamanho do srcset quando disponível

### Campos Extraídos

| Campo | Origem | Destino |
|-------|--------|---------|
| Nome | H1 da página ou slug formatado | `categories.name` |
| Slug | URL path | `categories.slug` |
| Descrição | `.category-description` | `categories.description` |
| Banner Desktop | Imagens hero/banner | `categories.banner_desktop_url` |
| Banner Mobile | Imagens mobile-specific | `categories.banner_mobile_url` |
| Thumbnail | Banner ou imagem da categoria | `categories.image_url` |

---

## Páginas Institucionais: Extração com IA

### Arquitetura de Extração

As páginas institucionais são extraídas usando **Lovable AI (Gemini 2.5 Flash)**:

```
HTML Bruto → Limpeza → IA Analisa → JSON Estruturado → Blocos do Builder
```

### Tipos de Conteúdo Detectados

A IA classifica e extrai automaticamente:

| Tipo | Detecção | Bloco do Builder |
|------|----------|------------------|
| FAQ/Acordeões | Perguntas/respostas, toggle content | `FAQBlock` |
| Parágrafos | Texto corrido | `RichText` |
| Headings | H1-H6 | `RichText` (com tag apropriada) |
| Imagens | URLs de imagens relevantes | `ImageBlock` |
| Vídeos YouTube | Embeds de YouTube | `YouTubeVideo` |
| Listas | UL/OL | `RichText` (com `<ul>`/`<ol>`) |

### Prompt da IA

A IA recebe instruções específicas para:
1. Identificar o título REAL da página (ignorando navegação)
2. Classificar como FAQ vs página genérica
3. Extrair FAQs mantendo estrutura de categorias
4. Extrair conteúdo na ordem correta de aparição
5. Ignorar headers, footers, navegação, produtos

### Estrutura de Blocos Gerada

**IMPORTANTE:** Os blocos são adicionados **diretamente na Section**, sem Container intermediário:

```json
{
  "id": "root",
  "type": "Page",
  "children": [
    { "type": "Header" },
    {
      "type": "Section",
      "props": { "paddingY": 48, "paddingX": 16, "maxWidth": "md" },
      "children": [
        { "type": "RichText", "props": { "content": "<h1>Título</h1>" } },
        { "type": "RichText", "props": { "content": "<p>Parágrafo...</p>" } },
        { "type": "FAQBlock", "props": { "items": [...] } },
        { "type": "ImageBlock", "props": { "imageDesktop": "..." } }
      ]
    },
    { "type": "Footer" }
  ]
}
```

Isso garante que cada bloco apareça individualmente no sidebar do Builder e seja 100% editável.

### Padrões de URL

**Incluídos:**
```
/pages/{slug}           (Shopify)
/pagina/{slug}          (Genérico BR)
/politica-*             (Políticas)
/termos-*               (Termos)
/sobre, /about          (Institucional)
/troca*, /devolucao*    (Trocas)
/faq, /perguntas        (FAQ)
```

**Excluídos (não são institucionais):**
```
/cart, /checkout        (Fluxo de compra)
/login, /cadastro       (Auth)
/produto, /product      (PDP)
/blog, /artigo          (Blog)
/contato                (Formulário)
/rastreio               (Temos nativo)
```

---

## Menus: Extração Hierárquica

### Detecção de Estrutura

O sistema detecta menus com múltiplos níveis usando adaptadores específicos por plataforma:

**Shopify Mega-menus:**
```typescript
// Classes detectadas para submenus
- .header__menu-item com .mega-menu
- .nav-item com .has-dropdown
- .menu-item com .has-submenu
- Qualquer link com dropdown/submenu aninhado
```

**Nuvemshop/Tiendanube (SPA):**
```typescript
// Classes específicas Nuvemshop (prefixo js-)
- nav.js-nav, nav.js-navigation, .nav-primary, .main-nav
- ul.js-nav-list, ul.nav-list, ul.nav-desktop, ul.main-menu
- div.js-mobile-nav, div.mobile-nav, div.nav-drawer
- div.js-mega-menu, div.mega-menu, div.dropdown-menu

// Footer
- div.footer-column, div.footer-col, div.js-footer-column
- section.footer-links, section.footer-nav
- ul.footer-list, ul.footer-menu, ul.footer-links
```

> **IMPORTANTE**: Nuvemshop usa SPA pesado em JavaScript. O scraper aguarda 5000ms para renderização.

### Estrutura Extraída

```
Menu Header
├── Início
├── Produtos → (dropdown)
│   ├── Categoria 1
│   ├── Categoria 2
│   └── Categoria 3
├── Sobre
└── Contato

Menu Footer
├── Institucional
│   ├── Quem Somos
│   └── Política de Privacidade
├── Atendimento
│   ├── Fale Conosco
│   └── FAQ
└── Social
```

### Vinculação com Entidades

Após importação, menus são vinculados via `ref_id`:

| Tipo | Vínculo |
|------|---------|
| Categoria | `menu_items.ref_id` → `categories.id` |
| Página | `menu_items.ref_id` → `store_pages.id` |
| URL Externa | `menu_items.url` (sem ref_id) |

---

## Arquitetura de Componentes

### Frontend

```
src/
├── pages/
│   └── Import.tsx                    # Página principal
├── components/import/
│   ├── GuidedImportWizard.tsx        # Wizard principal (3 etapas)
│   ├── StoreUrlInput.tsx             # Etapa 1 - URL
│   ├── ImportStep.tsx                # Etapa 2 - Upload arquivos
│   ├── StructureImportStep.tsx       # Etapa 3 - Categorias/Páginas/Menus
│   ├── PlatformSelector.tsx          # Seletor visual de plataformas
│   ├── ModuleSelector.tsx            # Seletor de módulos
│   ├── ImportProgress.tsx            # Progresso geral
│   └── ImportReportDialog.tsx        # Relatório final
├── hooks/
│   ├── useImportJobs.ts              # CRUD de jobs
│   ├── useImportService.ts           # Batched imports
│   └── useBlockImport.ts             # Import visual (futuro)
└── lib/import/
    ├── detector.ts                   # Detecção de plataforma
    ├── types.ts                      # Tipos normalizados
    ├── utils.ts                      # Utilitários (CSV parse, etc)
    └── platforms/
        ├── index.ts                  # Central de adaptadores
        ├── shopify.ts
        ├── nuvemshop.ts
        ├── tray.ts
        ├── woocommerce.ts
        ├── bagy.ts
        ├── yampi.ts
        ├── loja-integrada.ts
        └── wix.ts
```

### Backend (Edge Functions — Motores Canônicos)

```
supabase/functions/
├── firecrawl-scrape/                 # Scraping via Firecrawl
├── import-products/                  # Motor canônico de produtos (upsert por slug, imagens, variantes)
├── import-orders/                    # Motor canônico de pedidos (numeração sequencial, dedup por source_order_number)
├── import-customers/                 # Motor canônico de clientes (Smart Merge: preenche null sem sobrescrever)
├── import-store-categories/          # Import de categorias via scraping
├── import-institutional-pages/       # Import de páginas via IA + Firecrawl
├── import-menus/                     # Import de menus hierárquicos (replace total)
├── _shared/
│   ├── import-helpers.ts             # Tracking, slugify, parsing — código comum a todos os motores
│   └── platform-adapters/            # Adaptadores de extração
│       ├── types.ts
│       ├── index.ts
│       ├── shopify-adapter.ts
│       ├── nuvemshop-adapter.ts
│       ├── tray-adapter.ts
│       ├── bagy-adapter.ts
│       ├── yampi-adapter.ts
│       ├── loja-integrada-adapter.ts
│       └── generic-adapter.ts
```

> **ELIMINADOS:** `import-batch/` (substituído por import-products + import-orders) e `bulk-customer-update/` (substituído pelo Smart Merge em import-customers).

### Banco de Dados

```sql
-- Tracking de jobs de importação
import_jobs (
  id, tenant_id, platform, status, modules,
  progress, stats, errors, warnings,
  source_url, started_at, completed_at
)

-- Items importados (para rollback/auditoria)
import_items (
  id, tenant_id, job_id, module,
  external_id, internal_id,
  status,   -- success | error (técnico)
  result,   -- created | updated | unchanged | skipped | legacy (negócio, NOT NULL, sem default)
  data
)
```

---

## Fluxo de Normalização

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Arquivo CSV/JSON │  →   │  Adaptador da    │  →   │  Dados           │
│  (formato origem) │      │  Plataforma      │      │  Normalizados    │
└──────────────────┘      └──────────────────┘      └──────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │ Validação contra │
                          │ nossa estrutura  │
                          └──────────────────┘
                                   │
                                   ▼
                          ┌──────────────────────────────────────┐
                          │  Motor Canônico (Edge Function)      │
                          │  import-products / import-orders /   │
                          │  import-customers                    │
                          └──────────────────────────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  Banco de Dados  │
                          │  (nosso schema)  │
                          └──────────────────┘
```

---

## Regras de Negócio

### RN-IMP-001: Plataforma é Detectada Primeiro
A Etapa 2 e 3 só podem prosseguir após detecção bem-sucedida na Etapa 1.

### RN-IMP-002: Dados se Adaptam à Nossa Estrutura
Nunca alterar nosso schema para acomodar dados externos. Sempre normalizar para nosso formato.

### RN-IMP-003: Campos Obrigatórios
Se campo obrigatório nosso não existe na origem:
- `name`: usar handle/slug formatado
- `slug`: gerar a partir do nome
- `price`: usar 0
- `email`: pular registro (clientes)

### RN-IMP-004: Menus Dependem de Categorias/Páginas
Importar menus apenas após categorias e páginas, para poder vincular `ref_id`.

### RN-IMP-005: Páginas com Blocos Editáveis
Páginas institucionais são importadas com **blocos nativos do Builder** (RichText, FAQBlock, ImageBlock, YouTubeVideo), diretamente na Section, 100% editáveis pelo cliente.

### RN-IMP-006: Consolidação Shopify e Nuvemshop
CSVs Shopify e Nuvemshop têm múltiplas linhas por produto (variantes).
Consolidar em produto único antes de normalizar.
- **Shopify**: Agrupa por `Handle` via `consolidateShopifyProducts()`
- **Nuvemshop**: Agrupa por `Identificador URL` via `consolidateNuvemshopProducts()`

### RN-IMP-007: Multi-tenant
Todas operações validam `tenant_id` via job (nunca confiar no frontend).

### RN-IMP-008: Categorias por Grid de Produtos
Uma URL só é considerada categoria se contiver um **grid de produtos visível** (mínimo 2 product cards com preços).

### RN-IMP-009: Banners Desktop + Mobile
Importação de categorias extrai **ambos** banners quando disponíveis, com fallback de mobile para versões pequenas do srcset.

### RN-IMP-010: FAQs para FAQ Block
Acordeões e FAQs são convertidos para bloco `FAQ` nativo (tipo `FAQ` no BlockRenderer), mantendo estrutura de pergunta/resposta editável.

### RN-IMP-011: Agrupamento de Parágrafos
A IA agrupa parágrafos consecutivos de uma mesma seção em UM ÚNICO bloco RichText, evitando fragmentação excessiva. Máximo 5-8 blocos de conteúdo por página (exceto FAQs).

### RN-IMP-012: Extração de Botões/CTAs
Botões importantes (Comprar, Consultar, Saiba Mais) são extraídos como blocos `Button` com:
- `text`: Texto do botão
- `url`: Link de destino
- `variant`: primary, secondary ou outline

### RN-IMP-013: Filtro de Conteúdo Irrelevante
A IA ignora automaticamente:
- Tabelas de parcelas (1x, 2x, 3x...)
- Calculadoras de frete
- Widgets de chat
- Pop-ups e modais
- Menus de navegação

### RN-IMP-014: Tag e Lista "Cliente" Automática (REGRA FIXA)
Ao importar clientes:
1. Sistema cria/obtém tag `"Cliente"` (cor verde #10B981)
2. Sistema cria/obtém lista `"Clientes"` no email marketing (vinculada à tag)
3. **Todos os clientes importados recebem a tag "Cliente" automaticamente**
4. A lista "Clientes" mostra automaticamente todos com a tag

Isso garante que clientes importados apareçam na lista de email marketing.

### RN-IMP-015: Numeração de Pedidos Após Importação (REGRA FIXA)
- Se importar N pedidos, `next_order_number` é atualizado para `MAX(order_number) + 1`
- O próximo pedido feito na loja será N + 1
- **Não pode haver duplicação de números de pedido**
- Default para novos tenants: `next_order_number = 1` (não mais 1000)

### RN-IMP-016: Batch Sizes por Módulo (REGRA DE PERFORMANCE)
O sistema usa batch sizes otimizados por tipo de dado para equilibrar performance e estabilidade:

| Módulo | Batch Size | Motivo |
|--------|-----------|--------|
| Clientes | 200 | Upsert simples, sem sub-entidades complexas |
| Produtos | 50 | Imagens, variantes e categorias vinculadas |
| Categorias | 100 | Estrutura simples |
| Pedidos | 100 | Lookup de customer, mas batchável |

- **GuidedImportWizard** (`useImportData`): batch size fixo de 200
- **ImportWizard** (`useImportService`): batch size por módulo conforme tabela acima
- Updates de clientes existentes usam concorrência de 10 requests paralelos por chunk
- Inserts de novos clientes são feitos em batch único por lote

### RN-IMP-017: Motor Canônico Único por Módulo
Todos os fluxos de importação (botão individual do módulo, GuidedImportWizard, ImportWizard) chamam o **mesmo motor canônico** por módulo:

| Módulo | Motor Canônico | Merge |
|--------|---------------|-------|
| Produtos | `import-products` | Upsert por slug (sobrescreve) |
| Clientes | `import-customers` | Smart Merge (preenche null sem sobrescrever) |
| Pedidos | `import-orders` | Dedup por source_order_number (skip existentes) |
| Categorias | `import-store-categories` | Upsert por slug (sobrescreve) |
| Menus | `import-menus` | Replace total |

O wizard NÃO contém lógica de persistência — apenas orquestra contexto, sequência e chamada dos motores.

### RN-IMP-018: Menus — Comportamento de Replace
Menus usam **substituição completa** (replace), não merge. Ao importar:
- Todos os menus existentes do tenant são removidos
- Os novos menus são inseridos do zero
Comportamento idêntico no botão individual e no wizard.

### RN-IMP-019: Páginas — Exceção Arquitetural Documentada
O domínio "páginas" possui dois modos com naturezas distintas:
- **Single Page** (`ai-import-page`): IA recria uma URL específica com fidelidade visual. Usado no botão individual.
- **Batch Institutional** (`import-institutional-pages`): Scraping automático de N páginas institucionais. Usado no wizard Etapa 3.
Ambos seguem o contrato padrão de resposta e tracking.

### RN-IMP-020: Contrato de Entrada do import-customers
O motor `import-customers` suporta dois modos explícitos via campo `mode`:
- `mode: 'raw_file'` — Recebe `{ csvContent, tenantId }`. Faz parsing interno do CSV.
- `mode: 'normalized_batch'` — Recebe `{ items, tenantId, jobId }`. Dados já parseados/normalizados.
Não há formato implícito — o campo `mode` é obrigatório.

### RN-IMP-021: Tracking com Status Técnico + Resultado de Negócio
Cada `import_item` registra:
- `status`: `success` | `error` (resultado técnico da operação)
- `result`: `created` | `updated` | `unchanged` | `skipped` | `legacy` (resultado de negócio, **NOT NULL, sem default**)

Regras:
- **Registros novos**: devem preencher `result` explicitamente (`created`, `updated`, `unchanged` ou `skipped`). Se não preencherem, o INSERT falha — isso é intencional para detectar bugs.
- **Registros históricos**: marcados como `legacy` (anteriores à implementação do tracking de resultado). Não é possível inferir o valor real com segurança.
- O valor `legacy` NÃO deve ser usado por motores novos. É exclusivo para saneamento histórico.

Isso permite auditoria precisa separando falhas técnicas de decisões de negócio.

### RN-IMP-022: Lookup em Lotes para Grandes Volumes (import-customers)

O motor `import-customers` realiza a busca de clientes e endereços existentes em **lotes de 500 registros** para evitar dois limites do banco de dados:

1. **Limite do operador `.in()`**: Queries com milhares de valores no filtro podem exceder o tamanho máximo permitido pelo PostgreSQL.
2. **Limite de 1.000 linhas por resposta**: O banco retorna no máximo 1.000 registros por query. Sem batching, importações com mais de 1.000 clientes existentes falhavam silenciosamente — o sistema "não encontrava" clientes já cadastrados e tentava criá-los novamente, gerando erros de duplicação.

**Implementação:**
- Constante `LOOKUP_BATCH = 500` define o tamanho de cada lote.
- Emails são divididos em grupos de 500 e consultados sequencialmente.
- Os resultados são acumulados em um `Map` para lookup O(1) durante o processamento.
- O mesmo padrão é aplicado para busca de endereços existentes (`customer_addresses`).

**Impacto:** Importações de qualquer volume (testado com ~8.000 clientes) agora identificam corretamente todos os registros existentes, permitindo que o Smart Merge funcione sem criar duplicatas.

---

## Limpador de Dados Importados

### Objetivo

Permitir que o cliente remova dados que vieram da importação, sem afetar dados cadastrados manualmente.

### Comportamento

1. Cliente acessa botão "Limpar Dados" na página de Importação
2. Seleciona módulos a limpar (checkboxes)
3. Digita "CONFIRMAR" para habilitar ação
4. Sistema remove apenas dados rastreados na tabela `import_items`

### Módulos de Limpeza

| Módulo | ID | Descrição | Tabelas Afetadas |
|--------|-------|-----------|------------------|
| Produtos Importados | `products` | Apenas produtos que vieram da importação | `products`, `product_variants`, `product_images`, `product_categories`, `cart_items`, `buy_together_rules` |
| Categorias Importadas | `categories` | Apenas categorias que vieram da importação | `categories`, `product_categories` |
| Clientes Importados | `customers` | Apenas clientes que vieram da importação | `customers`, `customer_addresses`, `customer_notes`, `customer_tag_assignments`, `carts`, `checkouts`, etc. |
| Pedidos Importados | `orders` | Apenas pedidos que vieram da importação | `orders`, `order_items`, `order_history`, `payment_transactions`, `shipments`, etc. |
| Estrutura Importada | `structure` | Menus e páginas que vieram da importação | `menus`, `menu_items`, `store_pages` |
| TODAS Categorias | `all_categories` | ⚠️ Limpa TODAS categorias (manual + importado) | `categories`, `product_categories` |
| TODOS Menus | `all_menus` | ⚠️ Limpa TODOS menus (manual + importado) | `menus`, `menu_items` |

### Sistema de Rastreamento

Toda importação registra os itens na tabela `import_items`:

```sql
import_items (
  id UUID,
  tenant_id UUID,
  job_id UUID,           -- ID do job de importação (pode ser null para estrutura)
  module TEXT,           -- 'products', 'categories', 'customers', 'orders', 'menus', 'pages'
  external_id TEXT,      -- ID/URL original da plataforma de origem
  internal_id UUID,      -- ID no nosso sistema (FK para a tabela do módulo)
  status TEXT,           -- 'success' | 'error' (técnico)
  result TEXT NOT NULL,  -- 'created' | 'updated' | 'unchanged' | 'skipped' | 'legacy' (negócio, sem default)
  data JSONB             -- Dados adicionais para auditoria
)
```

### Edge Functions de Importação com Rastreamento

| Edge Function | Módulo Rastreado |
|---------------|------------------|
| `import-products` | `products` |
| `import-customers` | `customers` |
| `import-orders` | `orders` |
| `import-store-categories` | `categories` |
| `import-institutional-pages` | `pages` |
| `import-menus` | `menus` |

### Ordem de Deleção (FK Constraints)

Para cada módulo, o limpador segue ordem específica para respeitar FK:

**Produtos:**
1. `product_categories` (FK product_id)
2. `product_images` (FK product_id)
3. `product_variants` (FK product_id)
4. `cart_items` (FK product_id)
5. `buy_together_rules` (FK trigger_product_id, suggested_product_id)
6. `products`
7. `import_items` (module = 'products')

**Categorias:**
1. `product_categories` (FK category_id)
2. `categories`
3. `import_items` (module = 'categories')

**Clientes:**
1. `orders.customer_id = NULL` (desvincula sem deletar)
2. `customer_addresses`, `customer_notes`, `carts`, `checkouts`, etc.
3. `customers`
4. `import_items` (module = 'customers')

**Pedidos:**
1. `order_items`, `order_history`, `payment_transactions`, etc.
2. `orders`
3. `import_items` (module = 'orders')

**Estrutura:**
1. `menu_items` (FK menu_id)
2. `menus`
3. `store_pages`
4. `import_items` (module IN ['menus', 'pages'])

### Arquivos Relacionados

- `src/components/import/ClearDataDialog.tsx` - Dialog de confirmação
- `supabase/functions/tenant-clear-data/index.ts` - Edge Function de limpeza
- `src/hooks/useImportJobs.ts` - Hook com mutation `clearTenantData`

### Regras de Negócio

#### RN-CLR-001: Rastreamento Obrigatório
Toda Edge Function de importação DEVE registrar itens em `import_items` para que o limpador funcione.

#### RN-CLR-002: Limpeza Seletiva
O módulo `structure` limpa menus + páginas juntos. Não há opção separada.

#### RN-CLR-003: Opções de Força
As opções `all_categories` e `all_menus` limpam TUDO, não só importados. Usar com cuidado.

#### RN-CLR-004: Pedidos Não Deletam Clientes
Limpar pedidos NÃO deleta clientes. São módulos independentes.

#### RN-CLR-005: Clientes Desvinculam Pedidos
Limpar clientes desvincula pedidos (customer_id = NULL) mas não deleta os pedidos.

---

## Rotas

| Rota | Descrição |
|------|-----------|
| `/import` | Página principal de importação |

---

## RBAC

| Rota | Permissões |
|------|------------|
| `/import` | `admin`, `owner` |

---

## Validações

### Import de Arquivos
- Arquivo deve ser CSV ou JSON válido
- Encoding UTF-8 ou Latin-1 (auto-detectado via `readFileWithEncoding()`)
- Tamanho máximo: 50MB
- Headers devem corresponder ao esperado (matching em 4 camadas)
- Headers devem corresponder ao esperado

### Import de Estrutura
- URL deve ser acessível publicamente
- Domínio deve responder em < 30s
- Mínimo 1 categoria, página ou menu para importar

---

## Importar com IA (Importação Autônoma de Páginas)

### Objetivo

Permitir que lojistas importem qualquer página web externa (de qualquer plataforma) e a convertam automaticamente em blocos nativos 100% editáveis no Builder, usando IA.

### Arquitetura

```
┌──────────────┐    ┌───────────────┐    ┌──────────────────┐    ┌──────────────┐
│   URL da     │ →  │  Firecrawl    │ →  │  Gemini 2.5 Pro  │ →  │  BlockNode   │
│   Página     │    │  (HTML+MD)    │    │  (Mapeamento)    │    │  (JSON)      │
└──────────────┘    └───────────────┘    └──────────────────┘    └──────────────┘
```

### Workflow

1. Usuário cola URL de qualquer página web
2. **Firecrawl** faz scrape (HTML + Markdown + Screenshot + Links)
3. **Gemini 2.5 Pro** recebe o HTML completo + markdown e mapeia para blocos nativos
4. Sistema valida e normaliza o JSON (garante Header/Footer, IDs únicos, estrutura válida)
5. Se `pageId` fornecido, salva direto no banco (`store_pages.content`)

### Blocos Mapeados pela IA

A IA mapeia visualmente cada seção para o bloco nativo mais adequado:

| Padrão Visual | Bloco Nativo |
|--------------|--------------|
| Banners hero/topo | `Banner` (single ou carousel) |
| Carrosséis de imagens | `ImageCarousel` |
| Galerias de imagens | `ImageGallery` |
| Vídeos YouTube | `YouTubeVideo` ou `VideoCarousel` |
| Texto formatado | `RichText` |
| FAQ/acordeões | `Accordion` |
| Lista de benefícios | `FeatureList` ou `InfoHighlights` |
| Depoimentos/reviews | `Reviews` |
| Estatísticas | `StatsNumbers` |
| Passos/timeline | `StepsTimeline` |
| Logos parceiros | `LogosCarousel` |
| Texto + imagem lado a lado | `ContentColumns` |
| Contador regressivo | `CountdownTimer` |
| Newsletter | `Newsletter` |
| HTML complexo (último recurso) | `HTMLSection` |

### Regras Críticas

#### RN-AIP-001: URLs de Imagem Exatas
A IA **NUNCA** inventa URLs de imagens. Usa exclusivamente as URLs encontradas no HTML original do scraping.

#### RN-AIP-002: Estrutura Page > Header > Conteúdo > Footer
O JSON sempre segue: `{ type: "Page", children: [Header, ...seções, Footer] }`.
Se a IA omitir Header/Footer, o sistema os adiciona automaticamente.

#### RN-AIP-003: IDs Únicos
Todos os blocos recebem IDs únicos (`{tipo}-{timestamp}-{random}`). O sistema garante via `ensureIds()`.

#### RN-AIP-004: Headers/Footers da Origem Ignorados
O conteúdo de headers/footers da página de origem NÃO é importado. O sistema usa seus próprios Header/Footer nativos.

#### RN-AIP-005: HTMLSection como Último Recurso
Seções complexas que não se encaixam em nenhum bloco nativo são convertidas em `HTMLSection` com HTML/CSS inline.

#### RN-AIP-006: Salvamento Híbrido (Criar ou Sobrescrever) com Dual Target

O campo `targetType` determina onde o conteúdo é persistido:

**`targetType = 'page'` (padrão) → Salva em `store_pages`:**
- **Com `pageId`**: faz UPDATE em `store_pages` setando `content` com o JSON, `template_id = NULL` e `individual_content = NULL`.
- **Sem `pageId`**: cria automaticamente uma nova entrada em `store_pages` com `type = 'institutional'`, `status = 'draft'`, título extraído do `metadata.title` da página original, e slug único gerado com sufixo timestamp. Após criação, redireciona ao builder (`/pages/{id}/builder`).

**`targetType = 'landing_page'` → Salva em `ai_landing_pages`:**
- **Com `pageId`**: faz UPDATE em `ai_landing_pages` setando `generated_html` com o HTML original (até 500k chars), `reference_url` e `status = 'draft'`.
- **Sem `pageId`**: cria automaticamente uma nova entrada em `ai_landing_pages` com `name`, `slug` único, `generated_html`, `reference_url`, `initial_prompt`, `current_version = 1` e `created_by` do usuário autenticado. Após criação, redireciona ao editor (`/landing-pages/{id}`).

### UI de Importação

O dialog `ImportPageWithAIDialog` é acessado via botão **"Importar com IA"** presente em:
- **Páginas da Loja** (`/pages`) — usa `targetType = 'page'` → salva em `store_pages`
- **Landing Pages IA** (`/landing-pages`) — usa `targetType = 'landing_page'` → salva em `ai_landing_pages`

#### Props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `open` | boolean | Controla visibilidade do dialog |
| `onOpenChange` | function | Callback ao abrir/fechar |
| `tenantId` | string | ID do tenant |
| `pageId` | string? | Se fornecido, sobrescreve a página. Se omitido, cria nova. |
| `targetType` | `'page'` \| `'landing_page'` | Define tabela destino. Default: `'page'` |
| `onSuccess` | function? | Callback com `ImportResult` (inclui `pageId` da página criada/atualizada) |

#### ImportResult

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `content` | BlockNode | Árvore de blocos gerada |
| `sectionsCount` | number | Quantidade de seções importadas |
| `sourceUrl` | string | URL original |
| `sourceTitle` | string | Título da página original |
| `pageId` | string? | ID da página criada ou atualizada |
| `targetType` | string | Tipo de destino usado (`'page'` ou `'landing_page'`) |

#### Estados de Progresso

| Status | Label | Progresso |
|--------|-------|-----------|
| `idle` | — | 0% |
| `scraping` | Acessando e extraindo conteúdo... | 25% |
| `analyzing` | IA analisando e convertendo... | 60% |
| `saving` | Salvando blocos na página... | 90% |
| `completed` | Importação concluída! | 100% |
| `error` | Ocorreu um erro | 0% |

### Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/ai-import-page/index.ts` | Edge Function v1.1.0 (Firecrawl + Gemini, dual target) |
| `src/components/import/ImportPageWithAIDialog.tsx` | Dialog de UI |

### Dependências

- **Firecrawl** — Connector deve estar habilitado (secret `FIRECRAWL_API_KEY`)
- **Lovable AI** — Usa `aiChatCompletionJSON` com modelo `google/gemini-2.5-pro`
- **Supabase** — Service role para salvar em `store_pages` e/ou `ai_landing_pages`

---

## Pendências (Futuro)

- [ ] Preview antes de aplicar (staging tables)
- [ ] Retry automático em falhas de rede
- [ ] Import de imagens para storage próprio (hospedar no bucket do tenant)
- [ ] Mapeamento de campos customizado
- [ ] Import de cupons/descontos
- [ ] Import de avaliações/reviews
- [ ] Importar com IA: suporte a múltiplas páginas em lote
- [ ] Importar com IA: preview visual antes de salvar
