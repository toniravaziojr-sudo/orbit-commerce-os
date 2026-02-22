# Módulo: Produtos (Admin)

> **Status**: ✅ Funcional e Protegido  
> **Última atualização**: 2025-01-19

---

## 1. Visão Geral

O módulo de Produtos é o núcleo do catálogo do e-commerce. Permite gerenciar produtos simples, com variantes (cores, tamanhos) e kits/composições. Toda operação de escrita passa pela Edge Function `core-products` para garantir validação, auditoria e consistência.

---

## 2. Arquitetura de Componentes

### 2.1 Páginas

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/pages/Products.tsx` | Página principal com alternância entre lista, criação e edição |

### 2.2 Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/components/products/ProductList.tsx` | Tabela de produtos com busca, filtros, badges de status, duplicação |
| `src/components/products/ProductForm.tsx` | Formulário completo com abas (descrição, preço, estoque, variantes, SEO) |
| `src/components/products/ProductImageManager.tsx` | Gerenciador de imagens com suporte a upload e URLs externas |
| `src/components/products/ProductImageUploader.tsx` | Upload de imagens para storage |
| `src/components/products/ProductVariantPicker.tsx` | Seletor de variantes (opções 1-3) |
| `src/components/products/ProductStructureEditor.tsx` | Editor para kits/composições |
| `src/components/products/ProductPriceSection.tsx` | Seção de preços com promoção temporizada |
| `src/components/products/ProductInventorySection.tsx` | Controle de estoque e backorder |
| `src/components/products/ProductSeoSection.tsx` | Campos SEO (title, description) |

### 2.3 Hooks

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/hooks/useProducts.ts` | CRUD via `coreProductsApi`, React Query, cache invalidation |
| `src/hooks/useProductImages.ts` | Gerenciamento de imagens do produto |
| `src/hooks/useProductVariants.ts` | CRUD de variantes |
| `src/hooks/useProductComponents.ts` | Gerenciamento de componentes (kits) |

### 2.4 Edge Functions

| Função | Responsabilidade |
|--------|------------------|
| `core-products` | API canônica: create, update, delete, addImage, updateComponents, updateRelated |
| `import-batch` | Importação em lote de produtos |

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
  weight: number | null;         // Em gramas
  width: number | null;          // Em cm
  height: number | null;
  depth: number | null;
  barcode: string | null;
  gtin: string | null;
  ncm: string | null;            // Código fiscal
  seo_title: string | null;
  seo_description: string | null;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  is_featured: boolean;          // Destaque
  has_variants: boolean;
  product_format: 'simple' | 'with_variants' | 'with_composition';
  stock_type: 'physical' | 'virtual';
  brand: string | null;
  vendor: string | null;
  product_type: string | null;
  tags: string[] | null;
  requires_shipping: boolean | null;
  taxable: boolean | null;
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

## 4. Fluxos de Negócio

### 4.1 Criação de Produto

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

### 4.2 Gestão de Estoque

- **Estoque gerenciado**: `manage_stock = true` → quantidade é decrementada em vendas
- **Backorder**: `allow_backorder = true` → permite vender mesmo sem estoque
- **Alerta de baixo estoque**: `stock_quantity < low_stock_threshold`
- **Variantes**: cada variante tem seu próprio `stock_quantity`

### 4.3 Promoção Temporizada

- `compare_at_price`: preço original (exibido riscado)
- `promotion_start_date` / `promotion_end_date`: período da promoção
- Storefront exibe preço promocional apenas no período ativo

### 4.4 Slugs

- Gerados automaticamente a partir do nome
- Validados via `src/lib/slugPolicy.ts`
- Únicos por tenant (não globalmente)
- Não podem usar slugs reservados (cart, checkout, admin, etc.)

---

## 5. Integração com Outros Módulos

| Módulo | Integração |
|--------|------------|
| **Categorias** | Produtos vinculados via `product_categories` |
| **Pedidos** | Produtos referenciados em `order_items` |
| **Descontos** | Regras podem aplicar a produtos específicos |
| **Ofertas** | Order bump, upsell, cross-sell, buy-together |
| **Avaliações** | Reviews vinculadas ao produto |
| **Storefront** | Exibição pública via blocos do builder |
| **Importação** | Migração de outras plataformas |

---

## 6. Formatos de Produto

### 6.1 Simples (`simple`)
- Produto único sem variações
- SKU único, preço único, estoque único

### 6.2 Com Variantes (`with_variants`)
- Até 3 dimensões de opção (ex: Cor, Tamanho, Material)
- Cada combinação gera uma variante com SKU próprio
- Preço e estoque por variante

### 6.3 Kit/Composição (`with_composition`)
- Produto composto de outros produtos
- Estoque calculado baseado nos componentes
- Preço pode ser fixo ou soma dos componentes

---

## 7. UI/UX

### 7.1 Lista de Produtos

| Elemento | Comportamento |
|----------|---------------|
| Busca | Por nome, SKU, código de barras |
| Filtros | Status, categoria, destaque |
| Badges | Status, "Destaque", "Variantes", "Kit" |
| Ações | Editar, Duplicar, Excluir |
| Preview | Link para storefront (se slug válido) |

### 7.2 Formulário de Produto

| Aba | Campos |
|-----|--------|
| **Básico** | Nome, slug, descrição curta, descrição longa |
| **Mídia** | Imagens (drag-drop, reordenar, definir principal) |
| **Preço** | Custo, preço, compare_at, promoção temporizada |
| **Estoque** | Quantidade, limiar, gerenciar, backorder |
| **Variantes** | Opções 1-3, geração automática |
| **Componentes** | Lista de produtos do kit |
| **Fiscal** | NCM, CEST, código de origem |
| **Dimensões** | Peso, largura, altura, profundidade |
| **SEO** | Título, descrição, contador de caracteres |
| **Categorias** | Vincular a múltiplas categorias |

#### 7.2.1 Layout dos Botões de Ação

Os botões "Cancelar" e "Criar Produto" / "Salvar Alterações" ficam **fixos na parte inferior** da tela (`fixed bottom-0`) com:
- Fundo `bg-background` e `border-t` para separação visual
- Largura calculada (`calc(100% - sidebar)`) para não sobrepor sidebar
- `z-10` para ficar acima do conteúdo ao rolar
- `pb-20` no container principal para garantir que todo conteúdo seja acessível
- Mensagem de erros de validação exibida ao lado dos botões

### 7.3 Produtos Relacionados

| Elemento | Comportamento |
|----------|---------------|
| **Toggle automático** | "Escolher automaticamente com IA" — ativa/desativa via `store_settings.auto_related_products` |
| **Seleção manual** | Busca e seleciona produtos manualmente quando o toggle está desativado |
| **Persistência** | Salvo via Edge Function `core-products` action `updateRelated` |

> **Nota**: O botão "Gerar com IA" foi substituído pelo toggle automático. A IA seleciona produtos por compatibilidade e histórico de vendas.

---

## 8. Regras de Negócio

### 8.1 Validações

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
| `ncm` | Obrigatório para NF-e, exatamente 8 dígitos |
| **Estrutura (kits)** | Obrigatório pelo menos 1 componente quando `product_format === 'with_composition'` |

### 8.2 Exclusão

- Produtos com pedidos não podem ser excluídos (soft delete via `status = 'archived'`)
- `coreProductsApi.checkDependencies` verifica vínculos antes de excluir

### 8.3 Duplicação

- Copia todos os dados exceto: id, sku (gera novo), slug (gera novo)
- Copia imagens, variantes, categorias

---

## 9. Permissões (RBAC)

| Rota | Módulo | Submódulo |
|------|--------|-----------|
| `/products` | `ecommerce` | `products` |

---

## 10. Geração de Descrições com IA

### 10.1 Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/components/products/AIDescriptionButton.tsx` | Botão reutilizável para gerar descrições via IA |
| `supabase/functions/ai-product-description/index.ts` | Edge Function que chama o modelo de IA |

### 10.2 Modelo de IA

- **Modelo**: `google/gemini-2.5-pro` via Lovable AI Gateway
- **Autenticação**: `LOVABLE_API_KEY` (secret do sistema)
- **JWT**: `verify_jwt = true` — requer usuário autenticado

### 10.3 Fluxos

#### Descrição Curta (`short_description`)

1. **Requisito**: Descrição completa preenchida
2. **Ação**: Botão "Gerar com IA" ao lado do campo
3. **Processo**: IA resume a descrição completa em 2-3 frases (até 300 caracteres)
4. **Formato**: Texto simples (sem HTML)

#### Descrição Completa (`full_description`) — Com conteúdo existente

1. **Ação**: Botão "Melhorar com IA"
2. **Processo**: IA reorganiza e melhora o conteúdo existente
3. **Formato**: HTML semântico estruturado (h2, h3, ul, ol, hr, strong, em)

#### Descrição Completa (`full_description`) — Produto Simples/Variantes (via Link)

1. **Ação**: Botão "Gerar com IA" → Abre dialog com campo de URL
2. **Input**: Usuário fornece a URL da página do produto em outra loja/site
3. **Processo**:
   - Sistema faz scrape da página via Firecrawl (`FIRECRAWL_API_KEY`)
   - Extrai conteúdo em markdown
   - IA **copia fielmente** o conteúdo da página original, apenas convertendo para HTML semântico
   - NÃO reescreve, NÃO resume, NÃO inventa — preserva o texto original
4. **Formato**: HTML semântico bem formatado (h2, h3, p, ul, ol, li, strong, em, hr) com cada parágrafo em sua própria tag `<p>`
5. **Edge Function**: `ai-product-description` com `mode: 'from_link'`

#### Descrição Completa (`full_description`) — Kit/Composição (via Componentes)

1. **Ação**: Botão "Gerar com IA" no kit
2. **Validação**: Verifica se TODOS os produtos componentes possuem descrição completa
3. **Se algum componente sem descrição**: Exibe toast de erro listando os produtos que precisam ter descrição criada primeiro
4. **Se todos têm descrição**:
   - Coleta `{name, description}` de cada componente
   - IA gera descrição unificada do kit
   - Mantém TODAS as informações importantes de cada componente
   - Destaca o diferencial/vantagem de comprar o kit completo
   - Não repete informações redundantes
5. **Formato**: HTML semântico com estrutura obrigatória
6. **Edge Function**: `ai-product-description` com `mode: 'from_kit'`

### 10.4 Props do `AIDescriptionButton`

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

### 10.5 Regras

| Regra | Detalhe |
|-------|---------|
| Requisito descrição curta | Só gera se `fullDescription` estiver preenchida |
| Descrição curta sem HTML | Texto limpo, sem tags |
| Descrição completa com HTML | Usa HTML semântico, **nunca** markdown |
| Produto simples: campo URL | Dialog pede link obrigatório para scrape via Firecrawl |
| Kit: validação componentes | Todos os componentes devem ter descrição antes de gerar |
| Kit: toast de erro | Lista nomes dos produtos sem descrição completa |
| Botão dinâmico | "Gerar com IA" (vazio) / "Melhorar com IA" (com conteúdo) |
| Modos da Edge Function | `from_link` (simples), `from_kit` (kit), `default` (fallback) |

### 10.6 Formatação HTML Padrão (v2.5.0)

Todas as descrições completas geradas por IA seguem esta estrutura obrigatória:

#### Tags permitidas

| Tag | Uso |
|-----|-----|
| `<h2>` | Títulos de seção (em MAIÚSCULAS) |
| `<p>` | Cada parágrafo individual (um `<p>` por parágrafo) |
| `<ul>` / `<ol>` + `<li>` | Listas (todos os itens de lista usam `<li>` dentro de `<ul>` ou `<ol>`) |
| `<strong>` | Labels, destaques, nomes de propriedades |
| `<em>` | Taglines, ênfase sutil |
| `<br>` | Espaçamento visual entre seções |

#### Regras de formatação

1. **Títulos**: Sempre `<h2>` em MAIÚSCULAS (ex: `<h2>CARACTERÍSTICAS</h2>`)
2. **Parágrafos**: Cada parágrafo em sua própria tag `<p>` — nunca múltiplos parágrafos em um só `<p>`
3. **Listas**: Sempre usar `<ul><li>` ou `<ol><li>` — nunca colocar itens de lista em tags `<p>` separadas
4. **Espaçamento**: Usar `<br>` entre seções para separação visual
5. **Proibido**: Markdown (`**`, `##`, `-`), CSS inline, `<style>`, `<script>`, `<div>`, `<span>`
6. **Início**: O HTML deve começar diretamente na primeira tag, sem texto introdutório da IA

#### Exemplo de estrutura

```html
<h2>NOME DO PRODUTO</h2>
<p><em>Tagline do produto aqui.</em></p>

<br>

<h2>CARACTERÍSTICAS</h2>
<ul>
  <li><strong>Material:</strong> Descrição do material</li>
  <li><strong>Dimensões:</strong> 10x20x30cm</li>
</ul>

<br>

<h2>BENEFÍCIOS</h2>
<p>Parágrafo descrevendo os benefícios.</p>
<p>Outro parágrafo com mais detalhes.</p>
```

---

## 11. Arquivos Relacionados

- `src/pages/Products.tsx`
- `src/components/products/*`
- `src/components/products/AIDescriptionButton.tsx`
- `src/hooks/useProducts.ts`
- `src/hooks/useProductImages.ts`
- `src/hooks/useProductVariants.ts`
- `src/lib/coreApi.ts` (coreProductsApi)
- `supabase/functions/core-products/`
- `supabase/functions/ai-product-description/`
- `src/lib/slugPolicy.ts`

---

## 12. Pendências

- [ ] Exportação em massa (CSV/Excel)
- [ ] Histórico de alterações do produto
- [ ] Bulk edit (edição em lote)
- [ ] Produtos digitais (download)
