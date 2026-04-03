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
| `ProductImageManager.tsx` | Gerenciador de imagens |
| `ProductVariantPicker.tsx` | Seletor de variantes (opções 1-3) |
| `ProductStructureEditor.tsx` | Editor para kits/composições |
| `ProductPriceSection.tsx` | Preços com promoção temporizada |
| `ProductInventorySection.tsx` | Controle de estoque |
| `ProductSeoSection.tsx` | Campos SEO |
| `AIDescriptionButton.tsx` | Geração de descrições via IA |

### 2.3 Hooks

| Arquivo | Responsabilidade |
|---------|------------------|
| `useProducts.ts` | CRUD via `coreProductsApi`, React Query |
| `useProductImages.ts` | Gerenciamento de imagens |
| `useProductVariants.ts` | CRUD de variantes |
| `useProductComponents.ts` | Gerenciamento de kits |

### 2.4 Edge Functions

| Função | Responsabilidade |
|--------|------------------|
| `core-products` | API canônica: create, update, delete, addImage, updateComponents, updateRelated |
| `import-products` | Importação em lote |
| `ai-product-description` | Geração de descrições com IA |

---

## 3. Modelo de Dados

### 3.1 Tabela `products`

```typescript
interface Product {
  id: string;
  tenant_id: string;
  sku: string;                   // Único por tenant
  name: string;
  slug: string;                  // Único por tenant
  description: string | null;
  short_description: string | null;
  cost_price: number | null;
  price: number;
  compare_at_price: number | null;
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
  gtin: string | null;
  ncm: string | null;
  regulatory_info: { anvisa?: string; afe?: string; conama?: string } | null;
  warranty_type: string | null;
  warranty_duration: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  is_featured: boolean;
  has_variants: boolean;
  product_format: 'simple' | 'with_variants' | 'with_composition';
  stock_type: 'physical' | 'virtual';
  brand: string | null;
  tags: string[] | null;
  free_shipping: boolean;
  free_shipping_method: string | null;
}
```

### 3.2 Tabela `product_variants`

```typescript
interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  option1_name: string | null;   // Ex: "Cor"
  option1_value: string | null;  // Ex: "Azul"
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
  price: number | null;          // Sobrescreve produto pai
  stock_quantity: number;
  is_active: boolean;
  image_url: string | null;
}
```

### 3.3 Tabela `product_images`

- `is_primary = true` → imagem principal (deve ter **fundo branco**)
- Fundo transparente adequado apenas para imagens secundárias e criativos

### 3.4 Tabela `product_components` (Kits)

Kit composto de outros produtos com quantidade e preços por componente.

---

## 4. Formatos de Produto

| Formato | Descrição |
|---------|-----------|
| **Simples** | SKU único, preço único, estoque único |
| **Com Variantes** | Até 3 dimensões, cada combinação gera variante com SKU próprio |
| **Kit/Composição** | Composto de outros produtos, estoque calculado |

---

## 5. Fluxos de Negócio

### 5.1 Gestão de Estoque

- `manage_stock = true` → quantidade decrementada em vendas
- `allow_backorder = true` → venda sem estoque
- `stock_quantity < low_stock_threshold` → alerta

### 5.2 Promoção Temporizada

- `compare_at_price` exibido riscado
- `promotion_start_date` / `promotion_end_date` definem período

### 5.3 Slugs

- Gerados do nome, validados via `slugPolicy.ts`
- Únicos por tenant, sem slugs reservados

---

## 6. UI/UX

### 6.1 Lista

| Elemento | Comportamento |
|----------|---------------|
| Busca | Nome, SKU, código de barras |
| Filtros | Status, categoria, destaque |
| Badges | Status, "Destaque", "Variantes", "Kit" |
| Ações | Editar, Duplicar, Excluir |

### 6.2 Formulário

| Aba | Campos |
|-----|--------|
| Básico | Nome, slug, descrições |
| Mídia | Imagens (drag-drop, reordenar) |
| Preço | Custo, preço, promoção |
| Estoque | Quantidade, limiar, backorder |
| Variantes | Opções 1-3, geração automática |
| Componentes | Lista de kits |
| Fiscal | NCM, CEST |
| Regulatório | Anvisa, AFE, CONAMA |
| Garantia | Tipo, duração |
| Dimensões | Peso, largura, altura, profundidade |
| SEO | Título, descrição |
| Categorias | Vincular múltiplas |

### 6.3 Botões de Ação

Fixos na parte inferior (`fixed bottom-0`), `z-10`, com erros de validação ao lado.

### 6.4 Produtos Relacionados

- Toggle automático via IA (`store_settings.auto_related_products`)
- Seleção manual quando toggle desativado

---

## 7. Geração de Descrições com IA

### Modos

| Modo | Input | Processo |
|------|-------|----------|
| **short_description** | Descrição completa | IA resume em 2-3 frases |
| **full_description (link)** | URL de produto externo | Scrape via Firecrawl → cópia fiel |
| **full_description (kit)** | Componentes do kit | IA unifica descrições |
| **full_description (melhorar)** | Conteúdo existente | IA reorganiza e melhora |

### Formatação HTML

Tags permitidas: `<h2>` (MAIÚSCULAS), `<p>`, `<ul>/<ol>/<li>`, `<strong>`, `<em>`, `<br>`.  
Proibido: Markdown, CSS inline, `<div>`, `<span>`.

---

## 8. Validações

| Campo | Regra |
|-------|-------|
| `name` | Obrigatório, min 2 chars |
| `sku` | Obrigatório, único por tenant |
| `price` | ≥ 0.01 |
| `weight` | Obrigatório para frete |
| `ncm` | Obrigatório para NF-e, 8 dígitos |
| Kit | Mínimo 1 componente |

---

## 9. Exclusão e Duplicação

- **Exclusão:** Produtos com pedidos → soft delete (`archived`)
- **Duplicação:** Copia tudo exceto id, sku, slug (gera novos)

---

## 10. Permissões (RBAC)

| Rota | Módulo | Submódulo |
|------|--------|-----------|
| `/products` | `ecommerce` | `products` |

---

## 11. Pendências

- [ ] Exportação em massa (CSV/Excel)
- [ ] Histórico de alterações
- [ ] Bulk edit (edição em lote)
- [ ] Produtos digitais (download)

---

*Fim do documento.*
