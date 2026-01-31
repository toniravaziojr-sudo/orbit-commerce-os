# Módulo: Categorias (Admin)

> **Status**: ✅ Funcional e Protegido  
> **Última atualização**: 2025-01-25

---

## 1. Visão Geral

O módulo de Categorias organiza o catálogo de produtos em grupos hierárquicos. Diferente de outros e-commerces, a hierarquia de **navegação** (menus) é separada da hierarquia de **organização** (categorias), permitindo maior flexibilidade.

> **Importante**: A estrutura de navegação do storefront (header, footer) é configurada no módulo de **Menus**, não aqui.

---

## 2. Arquitetura de Componentes

### 2.1 Páginas

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/pages/Categories.tsx` | Lista de categorias, formulário e gerenciador de produtos |

### 2.2 Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/components/categories/CategoryTree.tsx` | Árvore hierárquica com drag-and-drop |
| `src/components/categories/CategoryForm.tsx` | Formulário de criação/edição (aceita `hideActions` para ocultar botões internos) |
| `src/components/categories/CategoryProductsManager.tsx` | Vincular/desvincular produtos |
| `src/components/categories/CategoryTreeItem.tsx` | Item individual da árvore |

### 2.3 Props do CategoryForm

| Prop | Tipo | Descrição |
|------|------|-----------|
| `formData` | object | Dados do formulário |
| `onChange` | function | Callback de alteração |
| `onSubmit` | function | Callback de submit |
| `onClose` | function | Callback de cancelamento |
| `isEditing` | boolean | Se está editando (vs criando) |
| `editingCategoryId` | string? | ID da categoria em edição |
| `isLoading` | boolean? | Estado de loading |
| `hideActions` | boolean? | **Oculta botões Salvar/Cancelar internos** (usado quando a página pai gerencia os botões globalmente) |

### 2.3 Hooks

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/hooks/useProducts.ts` (`useCategories`) | CRUD de categorias |
| `src/hooks/useCategoryProducts.ts` | Gerenciamento de produtos vinculados |

### 2.4 Edge Functions

| Função | Responsabilidade |
|--------|------------------|
| `import-store-categories` | Importação de categorias de outras plataformas |

---

## 3. Modelo de Dados

### 3.1 Tabela `categories`

```typescript
interface Category {
  id: string;                    // UUID PK
  tenant_id: string;             // FK → tenants
  name: string;
  slug: string;                  // Único por tenant
  description: string | null;
  parent_id: string | null;      // FK → categories (auto-referência)
  image_url: string | null;      // Imagem da categoria
  sort_order: number;            // Ordem entre irmãos
  is_active: boolean;
  
  // === SEO ===
  seo_title: string | null;
  seo_description: string | null;
  
  // === Banners ===
  banner_desktop_url: string | null;
  banner_mobile_url: string | null;
  
  created_at: string;
  updated_at: string;
}
```

### 3.2 Tabela `product_categories`

```typescript
interface ProductCategory {
  id: string;
  product_id: string;            // FK → products
  category_id: string;           // FK → categories
  position: number;              // Ordem do produto na categoria
  created_at: string;
}
```

---

## 4. Hierarquia

### 4.1 Estrutura

- Categorias podem ter **subcategorias** (via `parent_id`)
- Profundidade ilimitada (recomendado max 3 níveis)
- Ordem definida por `sort_order` entre irmãos

### 4.2 Exemplo

```
├── Roupas (sort_order: 0)
│   ├── Camisetas (sort_order: 0)
│   ├── Calças (sort_order: 1)
│   └── Vestidos (sort_order: 2)
├── Acessórios (sort_order: 1)
│   ├── Bolsas (sort_order: 0)
│   └── Bijuterias (sort_order: 1)
└── Promoções (sort_order: 2)
```

### 4.3 Drag-and-Drop

O componente `CategoryTree` permite:

1. **Reordenar** categorias (arrastar para cima/baixo)
2. **Mover para subcategoria** (arrastar sobre outra + Shift)
3. **Mover para raiz** (arrastar para fora da hierarquia)

---

## 5. Fluxos de Negócio

### 5.1 Criação de Categoria

```mermaid
graph TD
    A[Admin clica "Nova Categoria"] --> B[Abre formulário]
    B --> C[Preenche nome, slug, descrição]
    C --> D[Define parent_id se subcategoria]
    D --> E[Calcula sort_order como MAX+1 dos irmãos]
    E --> F[Salva no banco]
    F --> G[Invalida cache]
```

### 5.2 Vinculação de Produtos

```mermaid
graph TD
    A[Seleciona categoria] --> B[Abre aba "Produtos"]
    B --> C[Lista produtos disponíveis]
    C --> D[Seleciona produtos]
    D --> E[Clica "Adicionar"]
    E --> F[Insere em product_categories com position sequencial]
    F --> G[Lista produtos vinculados com nova ordem]
```

### 5.3 Reordenação de Produtos na Categoria

- Produtos podem ser reordenados via drag-and-drop
- Campo `position` em `product_categories` define a ordem
- Ordem afeta exibição na página de categoria do storefront

---

## 6. UI/UX

### 6.1 Layout da Página

```
┌─────────────────────────────────────────────────────────────┐
│ Categorias                                    [+ Nova Categoria] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────────┐  ┌─────────────────────────────────┐ │
│ │ Lista de Categorias │  │ ┌─────────────────────────────┐ │ │
│ │                     │  │ │ 📁 Nome Categoria  [Cancelar] [Salvar] │ │
│ │ ├── Roupas          │  │ └─────────────────────────────┘ │ │
│ │ │   ├── Camisetas   │  │                                  │ │
│ │ │   └── Calças      │  │ [Detalhes] [Produtos]            │ │
│ │ ├── Acessórios      │  │                                  │ │
│ │ └── Promoções       │  │ Nome: [__________]               │ │
│ │                     │  │ Slug: [__________]               │ │
│ │                     │  │ Descrição: [___________]         │ │
│ │                     │  │ Banner Desktop: [Upload]         │ │
│ │                     │  │ Banner Mobile: [Upload]          │ │
│ │                     │  │ Ativo: [Toggle]                  │ │
│ │                     │  │ SEO Title: [__________]          │ │
│ │                     │  │ SEO Desc: [___________]          │ │
│ └─────────────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

> **IMPORTANTE**: Os botões **Salvar** e **Cancelar** ficam em uma barra global sticky no topo do formulário, visíveis em **qualquer aba** (Detalhes ou Produtos). Isso permite que o usuário salve a categoria sem precisar voltar para a aba "Detalhes".

### 6.2 Árvore de Categorias

| Elemento | Comportamento |
|----------|---------------|
| Seta | Expande/colapsa subcategorias |
| Nome | Clique para editar |
| Badge | Quantidade de produtos |
| Drag handle | Arraste para reordenar |
| Ações | Editar, Ver no site, Excluir |

### 6.3 Aba de Produtos (CategoryProductsManager)

Layout de duas colunas (`xl:grid-cols-2`) que empilham em telas menores.

#### Coluna Esquerda: Produtos Vinculados

| Elemento | Comportamento |
|----------|---------------|
| Drag handle (⠿) | Arraste para reordenar |
| Checkbox | Seleciona para ação em lote |
| Imagem | Miniatura 40x40px do produto |
| Nome | Texto truncado com tooltip no hover |
| SKU + Preço | Linha secundária condensada |
| Badge status | Compacto (h-6) - "Ativo" ou "Inativo" |
| Botão remover | Sempre visível em mobile, hover em desktop |

#### Coluna Direita: Adicionar Produtos

| Elemento | Comportamento |
|----------|---------------|
| Busca | Filtra produtos disponíveis |
| Checkbox | Seleciona para adicionar em lote |
| Badge "Vinculado" | Indica produtos já na categoria (desabilitado) |
| Paginação | "Pág. X/Y • N produtos" com navegação |

#### Ações em Lote

| Ação | Descrição |
|------|-----------|
| Todos | Seleciona todos os produtos filtrados |
| Limpar | Remove seleção |
| Remover | Remove produtos selecionados da categoria |
| Adicionar | Vincula produtos selecionados à categoria |

> **UI/UX**: Botões de ação em lote usam `h-7` para compacidade e `flex-wrap` para responsividade.

---

## 7. Slugs

### 7.1 Política de Slugs

- Gerados automaticamente a partir do nome
- Formato: lowercase, sem acentos, hífens entre palavras
- Validados via `src/lib/slugPolicy.ts`
- Únicos por tenant (não globalmente)

### 7.2 Slugs Reservados

```typescript
const RESERVED_SLUGS = [
  'admin', 'api', 'auth', 'cart', 'checkout',
  'store', 'login', 'logout', 'register', 'signup',
  'settings', 'profile', 'dashboard', 'null', 'undefined',
  'new', 'edit', 'delete', 'create', 'minhas-compras', 'my-orders'
];
```

---

## 8. Banners

### 8.1 Campos

| Campo | Uso |
|-------|-----|
| `banner_desktop_url` | Banner exibido em telas > 768px |
| `banner_mobile_url` | Banner exibido em telas ≤ 768px |

### 8.2 Recomendações

- Desktop: 1920x400px ou 1200x300px
- Mobile: 800x400px ou 600x300px
- Formatos: JPG, PNG, WebP
- Tamanho máximo: 2MB

---

## 9. SEO

### 9.1 Campos SEO

| Campo | Uso | Limite |
|-------|-----|--------|
| `seo_title` | `<title>` da página | 60 caracteres |
| `seo_description` | `<meta description>` | 160 caracteres |

### 9.2 Fallbacks

- Se `seo_title` vazio → usa `name`
- Se `seo_description` vazio → usa `description` truncado

---

## 10. Integração com Outros Módulos

| Módulo | Integração |
|--------|------------|
| **Produtos** | Vinculação via `product_categories` |
| **Menus** | Categorias podem ser itens de menu |
| **Descontos** | Cupons aplicáveis a categorias específicas |
| **Storefront** | Página de categoria, filtros, blocos |
| **Builder** | Blocos `FeaturedCategoriesBlock`, `CategoryListBlock` |
| **Importação** | Migração de categorias de outras plataformas |

---

## 11. Storefront

### 11.1 Página de Categoria

- Rota: `/loja/:tenantSlug/categoria/:categorySlug`
- Exibe banner (se configurado)
- Lista produtos ordenados por `position`
- Filtros laterais (se configurados)

### 11.2 Blocos do Builder

| Bloco | Uso |
|-------|-----|
| `CategoryListBlock` | Lista todas as categorias |
| `FeaturedCategoriesBlock` | Categorias em destaque |
| `ProductGridBlock` | Produtos de uma categoria específica |

> **IMPORTANTE**: Os blocos `CategoryListBlock` e `FeaturedCategoriesBlock` **NÃO** permitem upload de miniaturas customizadas. As miniaturas exibidas são gerenciadas exclusivamente no cadastro da categoria (campo `image_url` / "Miniatura"). Isso evita conflitos de dados e garante consistência.

### 11.3 Configurações de Tema (Página de Categoria)

Acessível em **Configurações do Tema > Páginas > Categoria**:

| Configuração | Descrição | Padrão |
|--------------|-----------|--------|
| `bannerOverlayOpacity` | Escurecimento do banner (0-100%) | 0 |

---

## 12. Regras de Negócio

### 12.1 Validações

| Campo | Regra |
|-------|-------|
| `name` | Obrigatório, min 2 caracteres |
| `slug` | Obrigatório, único por tenant, formato válido |

### 12.2 Exclusão

- Categorias com produtos vinculados: desvincula primeiro
- Categorias com subcategorias: move subcategorias para raiz
- Não há soft delete (exclusão física)

### 12.3 Produtos em Múltiplas Categorias

- Um produto pode pertencer a várias categorias
- Cada vínculo tem seu próprio `position`
- Útil para "Promoções", "Novidades", etc.

---

## 13. Permissões (RBAC)

| Rota | Módulo | Submódulo |
|------|--------|-----------|
| `/categories` | `ecommerce` | `categories` |

---

## 14. Arquivos Relacionados

- `src/pages/Categories.tsx`
- `src/components/categories/*`
- `src/hooks/useProducts.ts` (useCategories)
- `src/hooks/useCategoryProducts.ts`
- `src/lib/slugPolicy.ts`
- `supabase/functions/import-store-categories/`

---

## 15. Diferença: Categorias vs Menus

| Aspecto | Categorias | Menus |
|---------|------------|-------|
| **Propósito** | Organização do catálogo | Navegação do site |
| **Hierarquia** | Definida por `parent_id` | Definida por menu items |
| **Produtos** | Vinculados diretamente | Não vinculados |
| **Flexibilidade** | Estrutura fixa | Pode incluir páginas, links externos |
| **Uso** | Filtros, página de categoria | Header, footer |

---

## 16. Pendências

- [ ] Exportação de categorias (CSV)
- [ ] Imagem de capa além do banner
- [ ] Atributos personalizados por categoria (para filtros)
- [ ] SEO automático com keywords da categoria
- [ ] Contador de produtos em tempo real na árvore
