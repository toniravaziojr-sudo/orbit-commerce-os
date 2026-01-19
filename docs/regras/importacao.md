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

### Regra Fundamental

> **A nossa estrutura NUNCA é alterada.**
> Os dados extraídos devem se adaptar para preencher nossa estrutura.
> Se um campo da plataforma origem não existe no nosso sistema, ele é ignorado.
> Se um campo obrigatório nosso não existe na origem, usa-se valor padrão.

### Arquivos Relacionados

- `src/lib/import/platforms/index.ts` - Central de adaptadores
- `src/lib/import/utils.ts` - Parse CSV, consolidação Shopify
- `src/lib/import/types.ts` - Tipos normalizados
- `src/components/import/ImportStep.tsx` - Step de upload
- `supabase/functions/import-batch/index.ts` - Processamento em lote

---

## Etapa 3: Estrutura da Loja (Scraping)

### Comportamento

1. Sistema usa a URL da Etapa 1 para fazer scraping
2. Navega pelos links do **header** e **footer** da loja alvo
3. Identifica e extrai:
   - **Categorias** - links de coleções/categorias
   - **Páginas Institucionais** - políticas, sobre, termos, etc.
   - **Menus** - estrutura de navegação exata

### Sub-etapas (ordem obrigatória)

| Ordem | Item | Fonte | Destino |
|-------|------|-------|---------|
| 1 | Categorias | Links `/collections/`, `/categoria/`, `/c/` | `categories` |
| 2 | Páginas | Links `/pages/`, `/politica/`, `/sobre/` | `store_pages` (rascunho vazio) |
| 3 | Menus | Estrutura header/footer | `menus`, `menu_items` |

> **Menus por último** pois dependem de categorias e páginas já existirem para vincular `ref_id`.

### Detecção de Categorias

Padrões de URL que indicam categoria:
```
/collections/{slug}     (Shopify)
/categoria/{slug}       (Genérico BR)
/category/{slug}        (Inglês)
/c/{slug}               (Abreviado)
/departamento/{slug}    (Tray, VTEX)
/shop/{slug}            (WooCommerce)
```

### Detecção de Páginas Institucionais

Padrões de URL incluídos:
```
/pages/{slug}           (Shopify)
/pagina/{slug}          (Genérico BR)
/politica-*             (Políticas)
/termos-*               (Termos)
/sobre, /about          (Institucional)
/troca*, /devolucao*    (Trocas)
/faq, /perguntas        (FAQ)
```

Padrões excluídos (não são institucionais):
```
/cart, /checkout        (Fluxo de compra)
/login, /cadastro       (Auth)
/produto, /product      (PDP)
/blog, /artigo          (Blog)
/contato                (Formulário)
/rastreio               (Temos nativo)
```

### Detecção de Menus

1. Scrape do HTML completo
2. Extração de links do `<header>` → Menu Header
3. Extração de links do `<footer>` → Menu Footer
4. Pareamento com categorias/páginas já importadas
5. Criação de `menu_items` com `ref_id` quando possível

### Arquivos Relacionados

- `supabase/functions/import-store-categories/index.ts` - Edge Function categorias
- `supabase/functions/import-institutional-pages/index.ts` - Edge Function páginas
- `src/components/import/StructureImportStep.tsx` - UI da Etapa 3
- `supabase/functions/_shared/platform-adapters/` - Adaptadores de extração

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

### Backend (Edge Functions)

```
supabase/functions/
├── firecrawl-scrape/                 # Scraping via Firecrawl
├── import-batch/                     # Import em lote (produtos, clientes, pedidos)
├── import-customers/                 # Import específico de clientes
├── import-store-categories/          # Import de categorias via scraping
├── import-institutional-pages/       # Import de páginas via scraping
└── _shared/
    └── platform-adapters/            # Adaptadores de extração
        ├── types.ts
        ├── index.ts
        ├── shopify-adapter.ts
        ├── nuvemshop-adapter.ts
        ├── tray-adapter.ts
        ├── bagy-adapter.ts
        ├── yampi-adapter.ts
        ├── loja-integrada-adapter.ts
        └── generic-adapter.ts
```

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
  external_id, internal_id, status, data
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
                          ┌──────────────────┐
                          │  Edge Function   │
                          │  import-batch    │
                          └──────────────────┘
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

### RN-IMP-005: Páginas como Rascunho
Páginas institucionais importadas ficam com `status: 'draft'` e conteúdo vazio.
Cliente preenche depois.

### RN-IMP-006: Consolidação Shopify
CSVs Shopify têm múltiplas linhas por produto (variantes).
Consolidar em produto único antes de normalizar.

### RN-IMP-007: Multi-tenant
Todas operações validam `tenant_id` via job (nunca confiar no frontend).

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
  status TEXT,           -- 'success', 'failed', 'skipped'
  data JSONB             -- Dados adicionais para auditoria
)
```

### Edge Functions de Importação com Rastreamento

| Edge Function | Módulo Rastreado |
|---------------|------------------|
| `import-batch` | `products`, `customers`, `orders` |
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
| `/import` | `owner`, `admin` |

---

## Pendências

- [ ] Importação visual (blocos da home page)
- [ ] Importação de cupons
- [ ] Importação de avaliações/reviews
- [ ] Rollback de importação
- [ ] Preview antes de confirmar import
- [ ] Mapeamento manual de campos

---

## Changelog

| Data | Alteração |
|------|-----------|
| 2025-01-19 | Documento criado com especificação completa do fluxo de 3 etapas |
| 2025-01-19 | Adicionada seção "Limpador de Dados Importados" com documentação completa |
