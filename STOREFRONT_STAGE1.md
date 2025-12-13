# STOREFRONT_STAGE1.md - Documentação da Etapa 1

## Visão Geral

Esta é a fundação do sistema de e-commerce com storefront público e painel administrativo. A Etapa 1 estabelece a estrutura de dados, rotas e funcionalidades mínimas para validar o fluxo completo.

## Rotas Implementadas

### Rotas Públicas (Storefront)

| Rota | Descrição |
|------|-----------|
| `/store/:tenantSlug` | Página inicial da loja |
| `/store/:tenantSlug/c/:categorySlug` | Página de categoria com produtos |
| `/store/:tenantSlug/p/:productSlug` | Página de detalhes do produto |
| `/store/:tenantSlug/cart` | Carrinho de compras |
| `/store/:tenantSlug/checkout` | Checkout (mock) |

### Rotas Administrativas

| Rota | Descrição |
|------|-----------|
| `/` | Dashboard |
| `/products` | Gestão de produtos (já existia) |
| `/categories` | Gestão de categorias (CRUD) |
| `/customers` | Gestão de clientes (já existia) |
| `/orders` | Gestão de pedidos (já existia) |
| `/menus` | Gestão de menus (Header/Footer) |
| `/pages` | Páginas institucionais |
| `/storefront` | Configurações da loja |

## Schema do Banco de Dados (Novas Tabelas)

### `menus`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk → tenants)
- `name` (text)
- `location` (text: 'header' | 'footer')
- `created_at`, `updated_at`

### `menu_items`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk → tenants)
- `menu_id` (uuid, fk → menus)
- `label` (text)
- `item_type` (text: 'category' | 'page' | 'external')
- `ref_id` (uuid, nullable) - referência para categoria ou página
- `url` (text, nullable) - para links externos
- `sort_order` (int)
- `parent_id` (uuid, nullable) - para submenus futuros
- `created_at`, `updated_at`

### `storefront_templates`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk → tenants)
- `page_type` (text: 'home' | 'category' | 'product' | 'cart' | 'checkout')
- `template_json` (jsonb)
- `updated_at`

### Alterações em Tabelas Existentes

#### `categories`
- Adicionado: `seo_title` (text)
- Adicionado: `seo_description` (text)

#### `store_pages`
- Adicionado: `type` (text, default 'institutional')
- Adicionado: `status` (text, default 'draft')

## Como Testar

### 1. Acessar o Admin
1. Fazer login em `/auth`
2. Navegar pelo sidebar para acessar as novas páginas

### 2. Configurar a Loja
1. Ir em **Configurações da Loja** (`/storefront`)
2. Preencher nome, cores, logo
3. Clicar em "Publicar Loja"

### 3. Criar Categorias
1. Ir em **Categorias** (`/categories`)
2. Criar categoria "Destaques"
3. Opcionalmente criar subcategorias

### 4. Vincular Produtos a Categorias
1. Editar um produto existente
2. Associar a uma categoria

### 5. Criar Menus
1. Ir em **Menus** (`/menus`)
2. Criar Menu Header e Menu Footer
3. Adicionar itens (categorias, páginas, links externos)

### 6. Criar Páginas Institucionais
1. Ir em **Páginas Institucionais** (`/pages`)
2. Criar página "Sobre Nós"
3. Publicar a página

### 7. Testar o Storefront
1. Acessar `/store/{slug-do-tenant}`
2. Navegar pelas categorias e produtos
3. Adicionar produtos ao carrinho
4. Ir até o checkout

## O que está "Mock" (não funcional)

### Checkout
- **Pagamento**: Não há integração com gateway. O pedido é apenas simulado.
- **Frete**: Não há cálculo real de frete. Exibe "Calculado no checkout".
- **Pedido**: O checkout finaliza sem criar um pedido real no banco.

### Funcionalidades Futuras (não implementadas)
- Builder drag-and-drop para edição visual
- Integração com gateways de pagamento (Mercado Pago, PagarMe)
- Integração com transportadoras (Correios, Loggi)
- Cupons de desconto
- Avaliações de produtos
- Busca com filtros avançados

## Estrutura de Arquivos Criados

```
src/
├── components/
│   └── storefront/
│       ├── StorefrontHeader.tsx
│       ├── StorefrontFooter.tsx
│       └── StorefrontLayout.tsx
├── hooks/
│   ├── useStorefront.ts
│   ├── useMenus.ts
│   ├── useStorePages.ts
│   ├── useStoreSettings.ts
│   └── useCart.ts
├── pages/
│   ├── Categories.tsx
│   ├── Menus.tsx
│   ├── Pages.tsx
│   ├── StorefrontSettings.tsx
│   └── storefront/
│       ├── StorefrontHome.tsx
│       ├── StorefrontCategory.tsx
│       ├── StorefrontProduct.tsx
│       ├── StorefrontCart.tsx
│       └── StorefrontCheckout.tsx
```

## Políticas de Acesso (RLS)

### Público (storefront)
- Pode ler `menus`, `menu_items`, `storefront_templates` apenas de lojas publicadas
- Pode ler `categories` ativas e `products` ativos de lojas publicadas
- Pode ler `store_pages` publicadas

### Admin (tenant)
- CRUD completo em todas as tabelas do seu tenant

### Preview
- Adicionar `?preview=1` na URL para visualizar loja não publicada (requer autenticação)

## Próximos Passos (Etapa 2)

1. Implementar builder drag-and-drop
2. Edição visual de seções (banners, vitrines, textos)
3. Integração com checkout real
4. Sistema de cupons
