# Módulo: Produtos (Admin)

> **Status:** ✅ Ativo  
> **Camada:** Layer 3 — Especificações / E-commerce  
> **Última atualização:** 2026-04-03  
> **Migrado de:** `docs/regras/produtos.md`

---

## 1. Visão Geral

O módulo de Produtos é o núcleo do catálogo do e-commerce. Permite gerenciar produtos simples, com variantes (cores, tamanhos) e kits/composições. Toda operação de escrita passa pela Edge Function `core-products`.

---

## 2. Arquitetura de Componentes

### 2.1 Páginas

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/pages/Products.tsx` | Página principal com alternância entre lista, criação e edição |

### 2.2 Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `ProductList.tsx` | Tabela com busca, filtros, badges, duplicação |
| `ProductForm.tsx` | Formulário completo com abas |
| `ProductImageManager.tsx` | Gerenciador de imagens (upload + URLs externas) |
| `ProductImageUploader.tsx` | Upload para storage |
| `ProductVariantPicker.tsx` | Seletor de variantes (opções 1-3) |
| `ProductStructureEditor.tsx` | Editor para kits/composições |
| `ProductPriceSection.tsx` | Preços com promoção temporizada |
| `ProductInventorySection.tsx` | Controle de estoque e backorder |
| `ProductSeoSection.tsx` | Campos SEO (title, description) |
| `AIDescriptionButton.tsx` | Geração de descrições via IA |
| `AIImageGeneratorDialog.tsx` | Geração de imagens secundárias via IA (assíncrono com polling) |

### 2.3 Hooks

| Arquivo | Responsabilidade |
|---------|------------------|
| `useProducts.ts` | CRUD via `coreProductsApi`, React Query, cache invalidation |
| `useProductImages.ts` | Gerenciamento de imagens |
| `useProductVariants.ts` | CRUD de variantes |
| `useProductComponents.ts` | Gerenciamento de kits |

### 2.4 Edge Functions

| Função | Responsabilidade |
|--------|------------------|
| `core-products` | API canônica: create, update, delete, addImage, updateComponents, updateRelated |
| `import-products` | Importação em lote (motor canônico) |
| `ai-product-description` | Geração de descrições com IA |

---

## 3. Modelo de Dados

### 3.1 Tabela `products`

```typescript
interface Product {
  id: string;                    // UUID PK
  tenant_id: string;             // FK → tenants
  sku: string;                   // Único por tenant
  name: string;
  slug: string;                  // Único por tenant
  description: string | null;
  short_description: string | null;
  cost_price: number | null;     // Custo (não exibido)
  price: number;                 // Preço de venda
  compare_at_price: number | null; // Preço "de" (riscado)
  promotion_start_date: string | null;
  promotion_end_date: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  manage_stock: boolean;
  allow_backorder: boolean;
  weight: number | null;         // Gramas
  width: number | null;          // cm
  height: number | null;
  depth: number | null;
  barcode: string | null;
  gtin: string;                 // ⚠️ OBRIGATÓRIO — Código de barras EAN (8, 12, 13 ou 14 dígitos). Alimenta o campo GTIN da NF-e.
  ncm: string | null;            // Código fiscal
  regulatory_info: {
    anvisa?: string;
    afe?: string;
    conama?: string;
  } | null;
  warranty_type: string | null;   // 'vendor' | 'factory' | 'none'
  warranty_duration: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  is_featured: boolean;
  has_variants: boolean;
  product_format: 'simple' | 'with_variants' | 'with_composition';
  stock_type: 'physical' | 'virtual';
  brand: string | null;
  vendor: string | null;
  product_type: string | null;
  tags: string[] | null;
  requires_shipping: boolean | null;
  free_shipping: boolean;
  free_shipping_method: string | null;  // NULL = usa padrão da logística
  tax_code: string | null;
  cest: string | null;
  origin_code: string | null;
  uom: string | null;            // Unidade de medida
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### 3.2 Tabela `product_variants`

```typescript
interface ProductVariant {
  id: string;
  product_id: string;            // FK → products
  sku: string;
  name: string;
  option1_name: string | null;   // Ex: "Cor"
  option1_value: string | null;  // Ex: "Azul"
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
  cost_price: number | null;
  price: number | null;          // Sobrescreve produto pai
  compare_at_price: number | null;
  stock_quantity: number;
  weight: number | null;
  barcode: string | null;
  gtin: string | null;
  is_active: boolean;
  position: number | null;
  image_url: string | null;
}
```

### 3.3 Tabela `product_images`

```typescript
interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
  file_id: string | null;        // Ref ao Drive (se upload local)
}
```

#### Regras de Imagem Principal

- `is_primary = true` → imagem principal deve ter **fundo branco** (RGB 255,255,255)
- Compatibilidade: loja virtual, Google Shopping, Meta Commerce, marketplaces
- **Fundo transparente** adequado apenas para imagens secundárias, criativos de IA, banners
- Sistemas de IA removem fundo automaticamente quando necessário (sem upload duplo)

### 3.4 Tabela `product_components` (Kits)

```typescript
interface ProductComponent {
  id: string;
  parent_product_id: string;     // Produto kit
  component_product_id: string;  // Produto componente
  quantity: number;
  cost_price: number | null;
  sale_price: number | null;
}
```

### 3.5 Tabela `product_categories`

```typescript
interface ProductCategory {
  id: string;
  product_id: string;
  category_id: string;
  position: number;              // Ordem na categoria
}
```

---

## 4. Formatos de Produto

### 4.1 Simples (`simple`)
- Produto único sem variações
- SKU único, preço único, estoque único

### 4.2 Com Variantes (`with_variants`)
- Até 3 dimensões de opção (ex: Cor, Tamanho, Material)
- Cada combinação gera variante com SKU próprio
- Preço e estoque por variante

### 4.3 Kit/Composição (`with_composition`)
- Composto de outros produtos
- Estoque calculado baseado nos componentes
- Preço pode ser fixo ou soma dos componentes

---

## 5. Fluxos de Negócio

### 5.1 Criação de Produto

```mermaid
graph TD
    A[Admin clica "Novo Produto"] --> B[Abre ProductForm]
    B --> C[Preenche dados básicos]
    C --> D{Tipo de produto?}
    D -->|Simples| E[Salva via coreProductsApi.create]
    D -->|Com Variantes| F[Define opções 1-3]
    F --> G[Gera variantes automaticamente]
    G --> E
    D -->|Kit| H[Adiciona componentes]
    H --> E
    E --> I[Invalida cache React Query]
    I --> J[Retorna à lista]
```

### 5.2 Gestão de Estoque

- **Estoque gerenciado**: `manage_stock = true` → quantidade decrementada em vendas
- **Backorder**: `allow_backorder = true` → venda sem estoque
- **Alerta**: `stock_quantity < low_stock_threshold`
- **Variantes**: cada variante tem seu próprio `stock_quantity`

### 5.3 Promoção Temporizada

- `compare_at_price`: preço original (riscado)
- `promotion_start_date` / `promotion_end_date`: período
- Storefront exibe preço promocional apenas no período ativo

### 5.4 Slugs

> 📖 **Documentação completa:** [`docs/especificacoes/sistema/slugs.md`](../sistema/slugs.md)

- Gerados automaticamente do nome via hook `useAutoSlug` (responsabilidade única)
- Validados via `src/lib/slugPolicy.ts`
- Únicos por `(tenant_id, slug)` — não globalmente
- Slugs reservados proibidos (veja [lista completa](../sistema/slugs.md#4-slugs-reservados))
- **Auto-geração contínua**: enquanto o usuário não editar manualmente o campo slug, ele é regenerado a cada keystroke no campo nome
- **Detecção de edição manual**: se o usuário digitar diretamente no campo slug, a auto-geração para automaticamente
- Em modo edição, a auto-geração é desabilitada por padrão (slug existente é preservado)
- Rota pública: `/product/:slug`

---

## 6. UI/UX

### 6.1 Lista de Produtos

| Elemento | Comportamento |
|----------|---------------|
| Busca | Nome, SKU, código de barras |
| Filtros | Status, categoria, destaque |
| Badges | Status, "Destaque", "Variantes", "Kit" |
| Ações | Editar, Duplicar, Excluir |
| Preview | Link para storefront (se slug válido) |

### 6.2 Formulário de Produto

| Aba | Campos |
|-----|--------|
| **Básico** | Nome, slug, descrição curta, descrição longa |
| **Mídia** | Imagens (drag-drop, reordenar, definir principal) |
| **Preço** | Custo, preço, compare_at, promoção temporizada |
| **Estoque** | Quantidade, limiar, gerenciar, backorder |
| **Variantes** | Opções 1-3, geração automática |
| **Componentes** | Lista de produtos do kit |
| **Fiscal** | NCM, CEST, código de origem |
| **Regulatório** | Anvisa (nº notificação), AFE (nº autorização), CONAMA |
| **Garantia** | Tipo (fabricante/vendedor/sem), Duração |
| **Dimensões** | Peso, largura, altura, profundidade |
| **SEO** | Título, descrição, contador de caracteres |
| **Categorias** | Vincular a múltiplas categorias |

### 6.3 Botões de Ação

Fixos na parte inferior (`fixed bottom-0`):
- Fundo `bg-background` + `border-t`
- Largura `calc(100% - sidebar)`
- `z-10`, `pb-20` no container principal
- Mensagem de erros de validação ao lado dos botões

### 6.4 Produtos Relacionados

| Elemento | Comportamento |
|----------|---------------|
| Toggle automático | "Escolher automaticamente com IA" via `store_settings.auto_related_products` |
| Seleção manual | Busca e seleciona quando toggle desativado |
| Persistência | Via Edge Function `core-products` action `updateRelated` |

---

## 7. Geração de Descrições com IA

### 7.1 Modelo

- **Modelo**: `google/gemini-2.5-pro` via Lovable AI Gateway
- **Autenticação**: `LOVABLE_API_KEY` (secret do sistema)
- **JWT**: `verify_jwt = true` — requer usuário autenticado

### 7.2 Modos

#### Descrição Curta (`short_description`)

1. Requisito: descrição completa preenchida
2. IA resume em 2-3 frases (até 300 caracteres)
3. Formato: texto simples (sem HTML)

#### Descrição Completa — via Link (simples/variantes)

1. Dialog com campo de URL
2. Scrape via Firecrawl (`FIRECRAWL_API_KEY`)
3. IA **copia fielmente** o conteúdo, converte para HTML semântico
4. NÃO reescreve, NÃO resume, NÃO inventa
5. Edge Function: `ai-product-description` com `mode: 'from_link'`

#### Descrição Completa — Kit/Composição

1. Valida que TODOS os componentes têm descrição completa
2. Se faltam: toast de erro listando produtos sem descrição
3. IA gera descrição unificada mantendo todas as informações
4. Edge Function: `ai-product-description` com `mode: 'from_kit'`

#### Descrição Completa — Melhorar existente

1. Botão "Melhorar com IA" (quando há conteúdo)
2. IA reorganiza e melhora o conteúdo existente

### 7.3 Props do `AIDescriptionButton`

```typescript
interface AIDescriptionButtonProps {
  type: 'short_description' | 'full_description';
  productName: string;
  fullDescription?: string;
  onGenerated: (text: string) => void;
  productFormat?: 'simple' | 'with_variants' | 'with_composition';
  productId?: string;
}
```

### 7.4 Regras

| Regra | Detalhe |
|-------|---------|
| Descrição curta sem HTML | Texto limpo, sem tags |
| Descrição completa com HTML | Semântico, nunca markdown |
| Botão dinâmico | "Gerar com IA" (vazio) / "Melhorar com IA" (com conteúdo) |
| Modos da Edge Function | `from_link`, `from_kit`, `default` |

### 7.5 Formatação HTML Padrão

#### Tags permitidas

| Tag | Uso |
|-----|-----|
| `<h2>` | Títulos de seção (em MAIÚSCULAS) |
| `<p>` | Cada parágrafo individual |
| `<ul>` / `<ol>` + `<li>` | Listas |
| `<strong>` | Labels, destaques |
| `<em>` | Taglines, ênfase sutil |
| `<br>` | Espaçamento entre seções |

#### Regras de formatação

1. Títulos: `<h2>` em MAIÚSCULAS
2. Parágrafos: um `<p>` por parágrafo
3. Listas: `<ul><li>` ou `<ol><li>` — nunca itens em `<p>` separados
4. Espaçamento: `<br>` entre seções
5. Proibido: Markdown, CSS inline, `<style>`, `<script>`, `<div>`, `<span>`
6. HTML começa direto na primeira tag, sem texto introdutório

#### Exemplo

```html
<h2>NOME DO PRODUTO</h2>
<p><em>Tagline do produto.</em></p>
<br>
<h2>CARACTERÍSTICAS</h2>
<ul>
  <li><strong>Material:</strong> Descrição</li>
  <li><strong>Dimensões:</strong> 10x20x30cm</li>
</ul>
```

---

## 8. Validações

| Campo | Regra |
|-------|-------|
| `name` | Obrigatório, min 2 caracteres |
| `sku` | Obrigatório, único por tenant |
| `slug` | Obrigatório, único por tenant, formato válido |
| `price` | Obrigatório, ≥ 0.01 |
| `stock_quantity` | ≥ 0 |
| `weight` | Obrigatório para frete, > 0 |
| `width` | Obrigatório para frete, > 0 |
| `height` | Obrigatório para frete, > 0 |
| `depth` | Obrigatório para frete, > 0 |
| `ncm` | Obrigatório para NF-e, 8 dígitos |
| Kit | Obrigatório pelo menos 1 componente |

---

## 9. Exclusão e Duplicação

### 9.1 Modelo de Exclusão: Soft Delete Universal

**Regra absoluta:** Nenhum produto é fisicamente removido do banco de dados. Toda exclusão é um soft delete.

#### Comportamento ao excluir

1. O campo `deleted_at` é preenchido com `NOW()`
2. O campo `status` é alterado para `archived`
3. Dados relacionados (imagens, variantes, componentes, categorias) **permanecem intactos** — não são removidos
4. Itens de pedido (`order_items`) mantêm a referência ao `product_id` original sem alteração — o histórico permanece íntegro
5. Itens de carrinho (`cart_items`) referenciando o produto são removidos (não faz sentido manter produto excluído no carrinho)

#### Visibilidade após exclusão

| Contexto | Comportamento |
|----------|---------------|
| Admin (listagem de produtos) | Filtra `deleted_at IS NULL` — produtos excluídos **não aparecem** |
| Storefront (vitrine pública) | Filtra `deleted_at IS NULL` — produtos excluídos **não aparecem** |
| Pedidos existentes | Mantêm referência original — histórico preservado |
| Relatórios | Podem incluir produtos excluídos quando relevante |

#### Recadastro com mesmo SKU/Slug

Graças a **índices parciais** (`WHERE deleted_at IS NULL`), é possível cadastrar um novo produto com o mesmo SKU ou slug de um produto previamente excluído. Apenas um registro ativo (sem `deleted_at`) pode existir por SKU/slug por tenant.

#### Índices parciais (banco de dados)

| Índice | Definição |
|--------|-----------|
| `products_tenant_id_sku_key` | `UNIQUE (tenant_id, sku) WHERE deleted_at IS NULL` |
| `products_tenant_id_slug_key` | `UNIQUE (tenant_id, slug) WHERE deleted_at IS NULL` |
| `idx_products_slug_lower` | `UNIQUE (tenant_id, lower(slug)) WHERE deleted_at IS NULL` |

#### Auditoria

- A ação de exclusão registra `soft_delete` no log de auditoria (não `hard_delete`)
- O evento `product.deleted` é emitido normalmente

#### Verificação de dependências

- `coreProductsApi.checkDependencies` verifica vínculos antes da exclusão
- O diálogo de confirmação informa ao usuário quais dados estão vinculados
- A exclusão é informada como "arquivamento" — o produto é desativado, não destruído

### 9.2 Duplicação

- Copia todos os dados exceto: id, sku (gera novo), slug (gera novo)
- Copia imagens, variantes, categorias
- Produtos com `deleted_at` preenchido não podem ser duplicados

### 9.3 Invalidação de Cache da Vitrine

Toda operação de escrita do `core-products` (`create`, `update`, `delete`, `add_image`, `update_components`, `update_related`) dispara automaticamente a revalidação **server-side** do cache da loja pública via `_shared/storefront-revalidation.ts`.

O pipeline é fire-and-forget (não bloqueia a resposta da API):
1. Marca páginas pré-renderizadas como `stale`
2. Purga cache CDN (Cloudflare)
3. Dispara re-prerender do HTML público

> **Nota:** Operações de categorias (CRUD e vínculos com produtos) são revalidadas **client-side** via `storefrontAutoUpdate()` nos hooks `useProducts.ts` e `useCategoryProducts.ts`. O frontend NÃO duplica revalidação para operações que já passam pelo `core-products`.

> **Regra completa:** Ver `docs/especificacoes/storefront/builder.md` → Seção "Invalidação Automática de Cache — Regra Universal"

---

## 10. Integração com Outros Módulos

| Módulo | Integração |
|--------|------------|
| Categorias | Vinculados via `product_categories` |
| Pedidos | Referenciados em `order_items` |
| Descontos | Regras aplicáveis a produtos |
| Ofertas | Order bump, upsell, cross-sell, buy-together |
| Avaliações | Reviews vinculadas ao produto |
| Storefront | Exibição pública via blocos do builder |
| Importação | Migração de outras plataformas |
| Cache/Prerender | Revalidação automática via `storefront-revalidation.ts` |

---

## 11. Permissões (RBAC)

| Rota | Módulo | Submódulo |
|------|--------|-----------|
| `/products` | `ecommerce` | `products` |

---

## 12. Regras Visuais — Responsividade Mobile

| Elemento | Comportamento Mobile | Arquivo |
|----------|---------------------|---------|
| Tabela de produtos | `overflow-x-auto` com `min-w-[700px]` | `ProductList.tsx` |

---

## 13. Componentes de Data Padronizados

| Campo | Componente | Descrição |
|-------|------------|-----------|
| `promotion_start_date` | `DateTimePickerField` | Início da promoção |
| `promotion_end_date` | `DateTimePickerField` | Fim da promoção |

---

## 14. Arquivos Relacionados

- `src/pages/Products.tsx`
- `src/components/products/*`
- `src/components/products/AIDescriptionButton.tsx`
- `src/hooks/useProducts.ts`, `useProductImages.ts`, `useProductVariants.ts`
- `src/lib/coreApi.ts` (coreProductsApi)
- `src/lib/slugPolicy.ts`
- `supabase/functions/core-products/`
- `supabase/functions/import-products/`
- `supabase/functions/ai-product-description/`

---

## 15. Pendências

- [ ] Exportação em massa (CSV/Excel)
- [ ] Histórico de alterações
- [ ] Bulk edit (edição em lote)
- [ ] Produtos digitais (download)

---

*Fim do documento.*
