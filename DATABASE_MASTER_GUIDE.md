# 🗄️ DATABASE MASTER GUIDE - Comando Central

> **Gabarito Mestre para Integração Externa via N8N**
> 
> Este documento é a **FONTE DE VERDADE ABSOLUTA** para injeção de dados externos no banco de dados Supabase da aplicação Comando Central. Qualquer agente de IA ou sistema de automação pode usar este guia para popular todas as tabelas sem causar quebras no Frontend ou erros de integridade.

---

## 📋 Índice Completo

1. [Arquitetura e Dependências](#1-arquitetura-e-dependências)
2. [Dicionário de Dados - TODAS as Tabelas](#2-dicionário-de-dados---todas-as-tabelas)
3. [Supabase Storage e Upload de Imagens](#3-supabase-storage-e-upload-de-imagens)
4. [Media Library - Biblioteca de Mídias](#4-media-library---biblioteca-de-mídias)
5. [Esquemas JSONB Detalhados](#5-esquemas-jsonb-detalhados)
6. [Sistema de Blocos do Builder](#6-sistema-de-blocos-do-builder)
7. [ENUMs e Tipos Customizados](#7-enums-e-tipos-customizados)
8. [Row Level Security (RLS)](#8-row-level-security-rls)
9. [Edge Functions - Backend](#9-edge-functions---backend)
10. [Lógica de Navegação e Slugs](#10-lógica-de-navegação-e-slugs)
11. [Frontend - Hooks e Componentes](#11-frontend---hooks-e-componentes)
12. [Guia de Injeção de Dados (Step-by-Step)](#12-guia-de-injeção-de-dados-step-by-step)
13. [Payloads de Exemplo](#13-payloads-de-exemplo)
14. [Troubleshooting e Notas Importantes](#14-troubleshooting-e-notas-importantes)

---

## 1. Arquitetura e Dependências

### 1.1 Diagrama de Dependências Hierárquicas Completo

```
tenants (RAIZ - obrigatório para TUDO)
│
├── user_roles (vínculo usuário ↔ tenant)
├── tenant_domains (domínios customizados)
├── tenant_invites (convites de equipe)
│
├── store_settings (1:1 com tenant - configurações visuais)
├── storefront_global_layout (1:1 - layout global da loja)
│
├── categories
│   └── parent_id (auto-referência para subcategorias)
│
├── products
│   ├── product_images
│   ├── product_variants
│   ├── product_categories (vínculo N:N)
│   ├── product_reviews
│   └── related_products (vínculo N:N)
│
├── menus
│   └── menu_items
│       └── parent_id (auto-referência para submenus)
│
├── store_pages (páginas institucionais)
├── storefront_page_templates (templates do builder)
│   └── store_page_versions (versões de conteúdo)
│
├── customers
│   ├── customer_addresses
│   ├── customer_notes
│   ├── customer_notifications
│   ├── customer_tags → customer_tag_assignments
│   └── orders
│       ├── order_items
│       ├── order_history
│       └── order_attribution
│
├── discounts
│   └── discount_redemptions
│
├── carts
│   └── cart_items
│       └── checkouts
│
├── channel_accounts (WhatsApp, Email, etc.)
│   └── conversations
│       ├── messages
│       │   └── message_attachments
│       ├── conversation_events
│       └── conversation_participants
│
├── email_provider_configs
├── mailboxes
│   ├── email_folders
│   └── email_messages
│       └── email_attachments
│
├── notification_rules
│   └── notifications
│       ├── notification_attempts
│       └── notification_logs
│
├── marketing_integrations
│   └── marketing_events_log
│
├── payment_providers
│   └── payment_transactions
│       └── payment_events
│
├── shipping_providers
│   └── shipments
│       └── shipment_events
│
├── ai_support_config
├── ai_channel_config
├── quick_replies
│
├── finance_entries
├── suppliers
├── purchases
│   └── purchase_items
│
├── import_jobs
│   └── import_items
│
├── events_inbox (motor de eventos)
│
└── media_library (biblioteca de mídias)
```

### 1.2 Regra de Ouro

> **NUNCA insira dados em tabelas filhas antes de criar o registro pai correspondente.**

### 1.3 Ordem de Inserção Completa

| Ordem | Tabela | Dependência Obrigatória |
|---|---|---|
| 1 | `tenants` | Nenhuma |
| 2 | `user_roles` | `tenant_id`, `user_id` (auth.users) |
| 3 | `store_settings` | `tenant_id` |
| 4 | `storefront_global_layout` | `tenant_id` |
| 5 | `categories` | `tenant_id` |
| 6 | `products` | `tenant_id` |
| 7 | `product_categories` | `product_id`, `category_id`, `tenant_id` |
| 8 | `product_images` | `product_id` |
| 9 | `product_variants` | `product_id` |
| 10 | `menus` | `tenant_id` |
| 11 | `menu_items` | `tenant_id`, `menu_id` |
| 12 | `storefront_page_templates` | `tenant_id` |
| 13 | `store_page_versions` | `tenant_id` |
| 14 | `store_pages` | `tenant_id` |
| 15 | `customers` | `tenant_id` |
| 16 | `customer_addresses` | `customer_id` |
| 17 | `orders` | `tenant_id` |
| 18 | `order_items` | `order_id` |
| 19 | `media_library` | `tenant_id` |

---

## 2. Dicionário de Dados - TODAS as Tabelas

### 2.1 `tenants` (Lojas/Inquilinos)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** - Identificador único do tenant |
| `name` | TEXT | ❌ | - | Nome da loja (ex: "Minha Loja") |
| `slug` | TEXT | ❌ | - | **UNIQUE** - Slug para URL (ex: "minha-loja") |
| `logo_url` | TEXT | ✅ | - | URL do logo principal |
| `settings` | JSONB | ✅ | `'{}'` | Configurações gerais (legado, usar `store_settings`) |
| `next_order_number` | INTEGER | ❌ | `1000` | Próximo número de pedido |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

**Constraints:**
- `slug` é **UNIQUE** - não podem existir dois tenants com o mesmo slug

---

### 2.2 `user_roles` (Papéis de Usuário por Tenant)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `user_id` | UUID | ❌ | - | **FK** → `auth.users.id` |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `role` | app_role | ❌ | `'operator'` | Papel do usuário |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

**ENUM app_role:**
- `owner` - Dono (acesso total)
- `admin` - Administrador
- `operator` - Operador
- `viewer` - Visualizador (somente leitura)

---

### 2.3 `tenant_domains` (Domínios Customizados)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `domain` | TEXT | ❌ | - | Domínio (ex: "minhaloja.com.br") |
| `status` | TEXT | ❌ | `'pending'` | Status de verificação |
| `ssl_status` | TEXT | ✅ | `'pending'` | Status do SSL |
| `ssl_active` | BOOLEAN | ✅ | `false` | SSL ativo? |
| `verification_token` | TEXT | ✅ | - | Token de verificação DNS |
| `verified_at` | TIMESTAMPTZ | ✅ | - | Data de verificação |
| `is_primary` | BOOLEAN | ✅ | `false` | Domínio primário? |

**Status possíveis:**
- `pending`, `verifying`, `verified`, `failed`

---

### 2.4 `store_settings` (Configurações da Loja)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` (UNIQUE) |
| `store_name` | TEXT | ✅ | - | Nome exibido da loja |
| `store_description` | TEXT | ✅ | - | Descrição/tagline |
| `logo_url` | TEXT | ✅ | - | URL do logo |
| `favicon_url` | TEXT | ✅ | - | URL do favicon |
| `primary_color` | TEXT | ✅ | `'#6366f1'` | Cor primária (hex) |
| `secondary_color` | TEXT | ✅ | `'#8b5cf6'` | Cor secundária (hex) |
| `accent_color` | TEXT | ✅ | `'#f59e0b'` | Cor de destaque (hex) |
| `header_style` | TEXT | ✅ | `'default'` | Estilo do cabeçalho |
| `footer_style` | TEXT | ✅ | `'default'` | Estilo do rodapé |
| `social_facebook` | TEXT | ✅ | - | URL do Facebook |
| `social_instagram` | TEXT | ✅ | - | URL do Instagram |
| `social_whatsapp` | TEXT | ✅ | - | Número do WhatsApp |
| `social_tiktok` | TEXT | ✅ | - | URL do TikTok |
| `social_youtube` | TEXT | ✅ | - | URL do YouTube |
| `social_custom` | JSONB | ✅ | `'[]'` | Redes sociais personalizadas |
| `seo_title` | TEXT | ✅ | - | Título SEO padrão |
| `seo_description` | TEXT | ✅ | - | Descrição SEO padrão |
| `seo_keywords` | TEXT[] | ✅ | - | Palavras-chave SEO |
| `google_analytics_id` | TEXT | ✅ | - | ID do Google Analytics |
| `facebook_pixel_id` | TEXT | ✅ | - | ID do Facebook Pixel |
| `custom_css` | TEXT | ✅ | - | CSS personalizado |
| `custom_scripts` | TEXT | ✅ | - | Scripts personalizados |
| `is_published` | BOOLEAN | ✅ | `false` | Loja publicada? |
| `business_legal_name` | TEXT | ✅ | - | Razão social |
| `business_cnpj` | TEXT | ✅ | - | CNPJ |
| `contact_phone` | TEXT | ✅ | - | Telefone de contato |
| `contact_email` | TEXT | ✅ | - | Email de contato |
| `contact_address` | TEXT | ✅ | - | Endereço comercial |
| `contact_support_hours` | TEXT | ✅ | - | Horário de atendimento |
| `shipping_config` | JSONB | ✅ | Ver schema | Configuração de frete |
| `benefit_config` | JSONB | ✅ | Ver schema | Barra de benefícios |
| `offers_config` | JSONB | ✅ | Ver schema | Ofertas (cross-sell, etc) |

---

### 2.5 `categories` (Categorias de Produtos)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `name` | TEXT | ❌ | - | Nome da categoria |
| `slug` | TEXT | ❌ | - | Slug para URL |
| `description` | TEXT | ✅ | - | Descrição |
| `image_url` | TEXT | ✅ | - | Imagem da categoria |
| `banner_desktop_url` | TEXT | ✅ | - | Banner desktop |
| `banner_mobile_url` | TEXT | ✅ | - | Banner mobile |
| `seo_title` | TEXT | ✅ | - | Título SEO |
| `seo_description` | TEXT | ✅ | - | Descrição SEO |
| `parent_id` | UUID | ✅ | - | **FK** → `categories.id` (subcategoria) |
| `sort_order` | INTEGER | ✅ | `0` | Ordem de exibição |
| `is_active` | BOOLEAN | ✅ | `true` | Categoria ativa? |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

**Constraints:**
- `(tenant_id, slug)` deve ser único por tenant

---

### 2.6 `products` (Produtos)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `sku` | TEXT | ❌ | - | SKU único do produto |
| `name` | TEXT | ❌ | - | Nome do produto |
| `slug` | TEXT | ❌ | - | Slug para URL |
| `description` | TEXT | ✅ | - | Descrição completa (HTML) |
| `short_description` | TEXT | ✅ | - | Descrição curta |
| `cost_price` | NUMERIC | ✅ | - | Preço de custo |
| `price` | NUMERIC | ❌ | - | Preço de venda |
| `compare_at_price` | NUMERIC | ✅ | - | Preço "de" (riscado) |
| `promotion_start_date` | TIMESTAMPTZ | ✅ | - | Início da promoção |
| `promotion_end_date` | TIMESTAMPTZ | ✅ | - | Fim da promoção |
| `stock_quantity` | INTEGER | ❌ | `0` | Quantidade em estoque |
| `low_stock_threshold` | INTEGER | ✅ | `5` | Alerta de estoque baixo |
| `manage_stock` | BOOLEAN | ✅ | `true` | Gerenciar estoque? |
| `allow_backorder` | BOOLEAN | ✅ | `false` | Permitir backorder? |
| `weight` | NUMERIC | ✅ | - | Peso (kg) |
| `width` | NUMERIC | ✅ | - | Largura (cm) |
| `height` | NUMERIC | ✅ | - | Altura (cm) |
| `depth` | NUMERIC | ✅ | - | Profundidade (cm) |
| `barcode` | TEXT | ✅ | - | Código de barras |
| `gtin` | TEXT | ✅ | - | GTIN/EAN |
| `ncm` | TEXT | ✅ | - | NCM fiscal |
| `seo_title` | TEXT | ✅ | - | Título SEO |
| `seo_description` | TEXT | ✅ | - | Descrição SEO |
| `status` | TEXT | ❌ | `'draft'` | **`draft`, `active`, `inactive`, `archived`** |
| `is_featured` | BOOLEAN | ✅ | `false` | Produto em destaque? |
| `has_variants` | BOOLEAN | ✅ | `false` | Possui variantes? |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

**⚠️ STATUS DE PRODUTOS (IMPORTANTE):**
- `draft` - Rascunho (não visível no storefront)
- `active` - Ativo (visível e disponível para compra)
- `inactive` - Inativo (temporariamente indisponível)
- `archived` - Arquivado (não visível, mantido para histórico)

**Constraints:**
- `(tenant_id, sku)` deve ser único
- `(tenant_id, slug)` deve ser único

---

### 2.7 `product_images` (Imagens de Produtos)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `product_id` | UUID | ❌ | - | **FK** → `products.id` |
| `variant_id` | UUID | ✅ | - | **FK** → `product_variants.id` |
| `url` | TEXT | ❌ | - | URL da imagem |
| `alt_text` | TEXT | ✅ | - | Texto alternativo |
| `sort_order` | INTEGER | ✅ | `0` | Ordem de exibição |
| `is_primary` | BOOLEAN | ✅ | `false` | Imagem principal? |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |

---

### 2.8 `product_variants` (Variantes de Produtos)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `product_id` | UUID | ❌ | - | **FK** → `products.id` |
| `sku` | TEXT | ❌ | - | SKU da variante |
| `name` | TEXT | ❌ | - | Nome da variante |
| `option1_name` | TEXT | ✅ | - | Nome opção 1 (ex: "Cor") |
| `option1_value` | TEXT | ✅ | - | Valor opção 1 (ex: "Azul") |
| `option2_name` | TEXT | ✅ | - | Nome opção 2 (ex: "Tamanho") |
| `option2_value` | TEXT | ✅ | - | Valor opção 2 (ex: "M") |
| `option3_name` | TEXT | ✅ | - | Nome opção 3 |
| `option3_value` | TEXT | ✅ | - | Valor opção 3 |
| `cost_price` | NUMERIC | ✅ | - | Preço de custo |
| `price` | NUMERIC | ✅ | - | Preço (se diferente do produto) |
| `compare_at_price` | NUMERIC | ✅ | - | Preço "de" |
| `stock_quantity` | INTEGER | ❌ | `0` | Estoque da variante |
| `weight` | NUMERIC | ✅ | - | Peso |
| `barcode` | TEXT | ✅ | - | Código de barras |
| `gtin` | TEXT | ✅ | - | GTIN |
| `is_active` | BOOLEAN | ✅ | `true` | Variante ativa? |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

---

### 2.9 `product_categories` (Vínculo Produto ↔ Categoria)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `product_id` | UUID | ❌ | - | **FK** → `products.id` |
| `category_id` | UUID | ❌ | - | **FK** → `categories.id` |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `position` | INTEGER | ✅ | `0` | Posição na categoria |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |

**Constraints:**
- `(product_id, category_id)` deve ser único

---

### 2.10 `product_reviews` (Avaliações de Produtos)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `product_id` | UUID | ❌ | - | **FK** → `products.id` |
| `customer_id` | UUID | ✅ | - | **FK** → `customers.id` |
| `order_id` | UUID | ✅ | - | **FK** → `orders.id` |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `rating` | INTEGER | ❌ | - | Nota (1-5) |
| `title` | TEXT | ✅ | - | Título da avaliação |
| `comment` | TEXT | ✅ | - | Comentário |
| `author_name` | TEXT | ✅ | - | Nome do autor |
| `is_verified_purchase` | BOOLEAN | ✅ | `false` | Compra verificada? |
| `is_approved` | BOOLEAN | ✅ | `false` | Aprovada para exibição? |
| `is_featured` | BOOLEAN | ✅ | `false` | Em destaque? |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |

---

### 2.11 `menus` (Menus de Navegação)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `name` | TEXT | ❌ | - | Nome do menu |
| `location` | TEXT | ❌ | `'header'` | `header`, `footer`, `mobile` |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

---

### 2.12 `menu_items` (Itens do Menu)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `menu_id` | UUID | ❌ | - | **FK** → `menus.id` |
| `label` | TEXT | ❌ | - | Texto exibido |
| `item_type` | TEXT | ❌ | `'category'` | Tipo do item (ver valores) |
| `ref_id` | UUID | ✅ | - | ID da entidade referenciada |
| `url` | TEXT | ✅ | - | URL externa (se type = 'external') |
| `sort_order` | INTEGER | ✅ | `0` | Ordem |
| `parent_id` | UUID | ✅ | - | **FK** → `menu_items.id` (submenu) |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

**Valores de `item_type`:**
| Valor | Descrição | ref_id | url |
|---|---|---|---|
| `home` | Link para home | NULL | NULL |
| `category` | Link para categoria | `categories.id` | NULL |
| `page` | Link para página institucional | `store_pages.id` | NULL |
| `product` | Link para produto | `products.id` | NULL |
| `external` | Link externo | NULL | URL completa |

---

### 2.13 `storefront_page_templates` (Templates de Páginas)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `page_type` | TEXT | ❌ | - | Tipo da página |
| `published_version` | INTEGER | ✅ | - | Versão publicada |
| `draft_version` | INTEGER | ✅ | - | Versão rascunho |
| `page_overrides` | JSONB | ✅ | `'{}'` | Configurações específicas |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

**Valores de `page_type`:**
- `home` - Página inicial
- `category` - Template de categoria
- `product` - Template de produto
- `cart` - Página do carrinho
- `checkout` - Página de checkout
- `thank_you` - Página de obrigado
- `account` - Página de conta
- `account_orders` - Lista de pedidos
- `account_order_detail` - Detalhe do pedido

---

### 2.14 `store_page_versions` (Versões de Páginas - Builder)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `entity_type` | TEXT | ❌ | - | `'page'` ou `'template'` |
| `page_id` | UUID | ✅ | - | **FK** → `store_pages.id` (se page) |
| `page_type` | TEXT | ✅ | - | Tipo da página (se template) |
| `version` | INTEGER | ❌ | `1` | Número da versão |
| `status` | TEXT | ❌ | `'draft'` | `draft`, `published`, `archived` |
| `content` | JSONB | ❌ | Ver schema | **Estrutura de blocos** |
| `created_by` | UUID | ✅ | - | Usuário que criou |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |

---

### 2.15 `store_pages` (Páginas Institucionais)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `title` | TEXT | ❌ | - | Título da página |
| `slug` | TEXT | ❌ | - | Slug para URL |
| `content` | JSONB | ✅ | `'[]'` | Conteúdo legado |
| `type` | TEXT | ✅ | `'institutional'` | Tipo da página |
| `status` | TEXT | ✅ | `'draft'` | Status |
| `is_homepage` | BOOLEAN | ✅ | `false` | É homepage? |
| `is_published` | BOOLEAN | ✅ | `false` | Publicada? |
| `published_version` | INTEGER | ✅ | - | Versão publicada |
| `draft_version` | INTEGER | ✅ | - | Versão rascunho |
| `builder_enabled` | BOOLEAN | ✅ | `true` | Usar builder? |
| `show_in_menu` | BOOLEAN | ✅ | `false` | Mostrar no menu? |
| `menu_label` | TEXT | ✅ | - | Texto no menu |
| `menu_order` | INTEGER | ✅ | `0` | Ordem no menu |
| `seo_title` | TEXT | ✅ | - | Título SEO |
| `seo_description` | TEXT | ✅ | - | Descrição SEO |
| `meta_title` | TEXT | ✅ | - | Meta title |
| `meta_description` | TEXT | ✅ | - | Meta description |
| `meta_image_url` | TEXT | ✅ | - | Imagem OG |
| `no_index` | BOOLEAN | ✅ | `false` | noindex? |
| `canonical_url` | TEXT | ✅ | - | URL canônica |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

---

### 2.16 `customers` (Clientes)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `email` | TEXT | ❌ | - | Email |
| `full_name` | TEXT | ❌ | - | Nome completo |
| `phone` | TEXT | ✅ | - | Telefone |
| `cpf` | TEXT | ✅ | - | CPF |
| `birth_date` | DATE | ✅ | - | Data de nascimento |
| `gender` | TEXT | ✅ | - | Gênero |
| `status` | TEXT | ❌ | `'active'` | Status |
| `auth_user_id` | UUID | ✅ | - | ID do auth.users |
| `email_verified` | BOOLEAN | ✅ | `false` | Email verificado? |
| `phone_verified` | BOOLEAN | ✅ | `false` | Telefone verificado? |
| `accepts_marketing` | BOOLEAN | ✅ | `true` | Aceita marketing? |
| `total_orders` | INTEGER | ✅ | `0` | Total de pedidos |
| `total_spent` | NUMERIC | ✅ | `0` | Total gasto |
| `average_ticket` | NUMERIC | ✅ | `0` | Ticket médio |
| `first_order_at` | TIMESTAMPTZ | ✅ | - | Primeiro pedido |
| `last_order_at` | TIMESTAMPTZ | ✅ | - | Último pedido |
| `loyalty_points` | INTEGER | ✅ | `0` | Pontos fidelidade |
| `loyalty_tier` | TEXT | ✅ | `'bronze'` | Nível fidelidade |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

---

### 2.17 `customer_addresses` (Endereços de Clientes)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `customer_id` | UUID | ❌ | - | **FK** → `customers.id` |
| `label` | TEXT | ❌ | `'Casa'` | Nome do endereço |
| `recipient_name` | TEXT | ❌ | - | Nome do destinatário |
| `street` | TEXT | ❌ | - | Rua |
| `number` | TEXT | ❌ | - | Número |
| `complement` | TEXT | ✅ | - | Complemento |
| `neighborhood` | TEXT | ❌ | - | Bairro |
| `city` | TEXT | ❌ | - | Cidade |
| `state` | TEXT | ❌ | - | Estado (UF) |
| `postal_code` | TEXT | ❌ | - | CEP |
| `country` | TEXT | ❌ | `'BR'` | País |
| `reference` | TEXT | ✅ | - | Ponto de referência |
| `is_default` | BOOLEAN | ✅ | `false` | Endereço padrão? |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

---

### 2.18 `orders` (Pedidos)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `customer_id` | UUID | ✅ | - | **FK** → `customers.id` |
| `order_number` | TEXT | ❌ | - | Número do pedido (ex: "#1001") |
| `status` | order_status | ❌ | `'pending'` | Status do pedido |
| `subtotal` | NUMERIC | ❌ | `0` | Subtotal |
| `discount_total` | NUMERIC | ❌ | `0` | Total de descontos |
| `shipping_total` | NUMERIC | ❌ | `0` | Total de frete |
| `tax_total` | NUMERIC | ❌ | `0` | Total de impostos |
| `total` | NUMERIC | ❌ | `0` | Total final |
| `payment_method` | payment_method | ✅ | - | Método de pagamento |
| `payment_status` | payment_status | ❌ | `'pending'` | Status pagamento |
| `payment_gateway` | TEXT | ✅ | - | Gateway usado |
| `payment_gateway_id` | TEXT | ✅ | - | ID no gateway |
| `paid_at` | TIMESTAMPTZ | ✅ | - | Data do pagamento |
| `shipping_status` | shipping_status | ❌ | `'pending'` | Status envio |
| `shipping_carrier` | TEXT | ✅ | - | Transportadora |
| `tracking_code` | TEXT | ✅ | - | Código de rastreio |
| `shipped_at` | TIMESTAMPTZ | ✅ | - | Data de envio |
| `delivered_at` | TIMESTAMPTZ | ✅ | - | Data de entrega |
| `customer_name` | TEXT | ❌ | - | Nome do cliente |
| `customer_email` | TEXT | ❌ | - | Email do cliente |
| `customer_phone` | TEXT | ✅ | - | Telefone |
| `customer_cpf` | TEXT | ✅ | - | CPF |
| `shipping_street` | TEXT | ✅ | - | Rua (entrega) |
| `shipping_number` | TEXT | ✅ | - | Número |
| `shipping_complement` | TEXT | ✅ | - | Complemento |
| `shipping_neighborhood` | TEXT | ✅ | - | Bairro |
| `shipping_city` | TEXT | ✅ | - | Cidade |
| `shipping_state` | TEXT | ✅ | - | Estado |
| `shipping_postal_code` | TEXT | ✅ | - | CEP |
| `shipping_country` | TEXT | ✅ | `'BR'` | País |
| `discount_code` | TEXT | ✅ | - | Código do cupom |
| `discount_name` | TEXT | ✅ | - | Nome do desconto |
| `discount_type` | TEXT | ✅ | - | Tipo de desconto |
| `free_shipping` | BOOLEAN | ❌ | `false` | Frete grátis? |
| `shipping_service_code` | TEXT | ✅ | - | Código serviço |
| `shipping_service_name` | TEXT | ✅ | - | Nome serviço |
| `shipping_estimated_days` | INTEGER | ✅ | - | Prazo estimado |
| `customer_notes` | TEXT | ✅ | - | Notas do cliente |
| `internal_notes` | TEXT | ✅ | - | Notas internas |
| `cancelled_at` | TIMESTAMPTZ | ✅ | - | Data cancelamento |
| `cancellation_reason` | TEXT | ✅ | - | Motivo cancelamento |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

---

### 2.19 `order_items` (Itens do Pedido)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `order_id` | UUID | ❌ | - | **FK** → `orders.id` |
| `product_id` | UUID | ✅ | - | **FK** → `products.id` |
| `variant_id` | UUID | ✅ | - | **FK** → `product_variants.id` |
| `sku` | TEXT | ❌ | - | SKU do produto |
| `product_name` | TEXT | ❌ | - | Nome do produto |
| `product_image_url` | TEXT | ✅ | - | URL da imagem |
| `variant_name` | TEXT | ✅ | - | Nome da variante |
| `quantity` | INTEGER | ❌ | `1` | Quantidade |
| `unit_price` | NUMERIC | ❌ | - | Preço unitário |
| `discount_amount` | NUMERIC | ❌ | `0` | Desconto aplicado |
| `total_price` | NUMERIC | ❌ | - | Preço total |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |

---

### 2.20 `discounts` (Cupons de Desconto)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `name` | TEXT | ❌ | - | Nome do desconto |
| `code` | TEXT | ✅ | - | Código do cupom |
| `description` | TEXT | ✅ | - | Descrição |
| `type` | TEXT | ❌ | - | `percentage`, `fixed`, `free_shipping` |
| `value` | NUMERIC | ❌ | `0` | Valor do desconto |
| `min_subtotal` | NUMERIC | ✅ | - | Valor mínimo do pedido |
| `starts_at` | TIMESTAMPTZ | ✅ | - | Início da validade |
| `ends_at` | TIMESTAMPTZ | ✅ | - | Fim da validade |
| `usage_limit_total` | INTEGER | ✅ | - | Limite total de usos |
| `usage_limit_per_customer` | INTEGER | ✅ | - | Limite por cliente |
| `auto_apply_first_purchase` | BOOLEAN | ❌ | `false` | Auto-aplicar primeira compra? |
| `is_active` | BOOLEAN | ❌ | `true` | Ativo? |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ❌ | `now()` | Data de atualização |

---

### 2.21 `media_library` (Biblioteca de Mídias)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `file_path` | TEXT | ❌ | - | Caminho no storage |
| `file_url` | TEXT | ❌ | - | URL pública |
| `file_name` | TEXT | ❌ | - | Nome do arquivo |
| `variant` | TEXT | ❌ | - | `desktop` ou `mobile` |
| `file_size` | INTEGER | ✅ | - | Tamanho em bytes |
| `mime_type` | TEXT | ✅ | - | Tipo MIME |
| `created_at` | TIMESTAMPTZ | ❌ | `now()` | Data de criação |
| `created_by` | UUID | ✅ | - | Usuário que criou |

**Variants:**
- `desktop` - Imagem otimizada para desktop
- `mobile` - Imagem otimizada para mobile

**Tipos MIME suportados:**
- Imagens: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`
- Vídeos: `video/mp4`, `video/webm`, `video/quicktime`

---

### 2.22 `conversations` (Conversas de Suporte)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `channel_type` | support_channel_type | ❌ | - | Canal de atendimento |
| `channel_account_id` | UUID | ✅ | - | **FK** → `channel_accounts.id` |
| `customer_id` | UUID | ✅ | - | **FK** → `customers.id` |
| `order_id` | UUID | ✅ | - | **FK** → `orders.id` |
| `status` | conversation_status | ✅ | `'new'` | Status da conversa |
| `priority` | INTEGER | ✅ | `0` | Prioridade (0-3) |
| `assigned_to` | UUID | ✅ | - | Atendente responsável |
| `customer_name` | TEXT | ✅ | - | Nome do cliente |
| `customer_email` | TEXT | ✅ | - | Email do cliente |
| `customer_phone` | TEXT | ✅ | - | Telefone do cliente |
| `subject` | TEXT | ✅ | - | Assunto |
| `summary` | TEXT | ✅ | - | Resumo da conversa |
| `tags` | TEXT[] | ✅ | `'{}'` | Tags |
| `message_count` | INTEGER | ✅ | `0` | Total de mensagens |
| `unread_count` | INTEGER | ✅ | `0` | Mensagens não lidas |
| `last_message_at` | TIMESTAMPTZ | ✅ | - | Última mensagem |
| `first_response_at` | TIMESTAMPTZ | ✅ | - | Primeira resposta |
| `resolved_at` | TIMESTAMPTZ | ✅ | - | Data de resolução |
| `csat_score` | INTEGER | ✅ | - | Nota CSAT (1-5) |
| `created_at` | TIMESTAMPTZ | ✅ | `now()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | ✅ | `now()` | Data de atualização |

---

### 2.23 `messages` (Mensagens de Suporte)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `conversation_id` | UUID | ❌ | - | **FK** → `conversations.id` |
| `direction` | message_direction | ❌ | - | `inbound` ou `outbound` |
| `sender_type` | message_sender_type | ❌ | - | Tipo do remetente |
| `sender_id` | UUID | ✅ | - | ID do remetente |
| `sender_name` | TEXT | ✅ | - | Nome do remetente |
| `content` | TEXT | ✅ | - | Conteúdo da mensagem |
| `content_type` | TEXT | ✅ | `'text'` | Tipo do conteúdo |
| `is_ai_generated` | BOOLEAN | ✅ | `false` | Gerada por IA? |
| `is_internal` | BOOLEAN | ✅ | `false` | Nota interna? |
| `delivery_status` | message_delivery_status | ✅ | - | Status de entrega |
| `external_message_id` | TEXT | ✅ | - | ID externo |
| `metadata` | JSONB | ✅ | `'{}'` | Metadados |
| `created_at` | TIMESTAMPTZ | ✅ | `now()` | Data de criação |

---

### 2.24 Outras Tabelas (Resumo)

| Tabela | Descrição |
|---|---|
| `channel_accounts` | Contas de canais (WhatsApp, Email) |
| `notification_rules` | Regras de notificação automática |
| `notifications` | Fila de notificações |
| `notification_attempts` | Tentativas de envio |
| `notification_logs` | Logs de notificações |
| `marketing_integrations` | Integrações com Google/Meta/TikTok |
| `marketing_events_log` | Eventos enviados para marketing |
| `payment_providers` | Provedores de pagamento |
| `payment_transactions` | Transações de pagamento |
| `shipping_providers` | Provedores de envio |
| `shipments` | Remessas |
| `shipment_events` | Eventos de rastreio |
| `ai_support_config` | Configuração da IA de suporte |
| `ai_channel_config` | Configuração da IA por canal |
| `quick_replies` | Respostas rápidas |
| `finance_entries` | Lançamentos financeiros |
| `suppliers` | Fornecedores |
| `purchases` | Compras de fornecedores |
| `import_jobs` | Jobs de importação |
| `events_inbox` | Fila de eventos |

---

## 3. Supabase Storage e Upload de Imagens

### 3.1 Buckets Disponíveis

O sistema possui **2 buckets públicos** para armazenamento de arquivos:

| Bucket | Descrição | Público | Uso |
|---|---|---|---|
| `product-images` | Imagens de produtos | ✅ Sim | Fotos de produtos e variantes |
| `store-assets` | Assets da loja | ✅ Sim | Logo, favicon, banners, mídias |

### 3.2 Estrutura de Pastas

```
product-images/
└── {tenant_id}/
    └── products/
        └── {product_id}/
            ├── main.jpg
            ├── gallery-1.jpg
            ├── gallery-2.jpg
            └── variants/
                └── {variant_id}.jpg

store-assets/
└── {tenant_id}/
    ├── logo.png
    ├── favicon.ico
    ├── banners/
    │   ├── hero-desktop-1.jpg
    │   ├── hero-mobile-1.jpg
    │   └── category-{slug}.jpg
    └── media-library/
        ├── desktop/
        │   └── {uuid}.jpg
        └── mobile/
            └── {uuid}.jpg
```

### 3.3 Upload de Imagens via Storage API

#### Upload Direto (JavaScript/TypeScript)

```typescript
import { supabase } from '@/integrations/supabase/client';

async function uploadProductImage(
  tenantId: string,
  productId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  const filePath = `${tenantId}/products/${productId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  // Obter URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return publicUrl;
}
```

#### Upload via REST API (para N8N/automação)

```http
POST https://{project_id}.supabase.co/storage/v1/object/product-images/{tenant_id}/products/{product_id}/image.jpg
Authorization: Bearer {service_role_key}
Content-Type: image/jpeg

[binary image data]
```

#### Resposta:

```json
{
  "Key": "product-images/{tenant_id}/products/{product_id}/image.jpg",
  "Id": "uuid-do-objeto"
}
```

### 3.4 URL Pública de Imagens

```
https://{project_id}.supabase.co/storage/v1/object/public/{bucket}/{path}
```

**Exemplo completo:**
```
https://ojssezfjhdvvncsqyhyq.supabase.co/storage/v1/object/public/product-images/550e8400-e29b-41d4-a716-446655440000/products/prod-001/main.jpg
```

### 3.5 RLS Policies do Storage

#### Bucket `product-images`:

```sql
-- Leitura pública
CREATE POLICY "Product images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Upload por usuários autenticados
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Update por usuários autenticados
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Delete por usuários autenticados
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');
```

#### Bucket `store-assets`:

```sql
-- Leitura pública
CREATE POLICY "Anyone can view store assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-assets');

-- Upload restrito ao tenant do usuário
CREATE POLICY "Users can upload store assets for their tenant"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);
```

### 3.6 Fluxo Completo de Upload para N8N

```
1. Obter imagem (URL externa ou arquivo)
   ↓
2. Converter para bytes/base64
   ↓
3. Upload via REST API do Supabase Storage
   ↓
4. Obter URL pública
   ↓
5. Inserir registro na tabela destino (product_images, media_library, etc.)
   ↓
6. Se for Media Library, registrar também na tabela media_library
```

### 3.7 Formatos Suportados

| Tipo | Extensões | MIME Types |
|---|---|---|
| **Imagens** | .jpg, .jpeg, .png, .webp, .gif, .svg | image/jpeg, image/png, image/webp, image/gif, image/svg+xml |
| **Vídeos** | .mp4, .webm, .mov | video/mp4, video/webm, video/quicktime |

### 3.8 Limites

- **Tamanho máximo por arquivo:** 50MB (pode ser configurado)
- **Sem limite de arquivos por bucket**

---

## 4. Media Library - Biblioteca de Mídias

### 4.1 Conceito

A Media Library é uma **camada de abstração** sobre o Storage que permite:
- Reutilização de mídias em múltiplos blocos/produtos
- Separação Desktop vs Mobile
- Organização por tenant
- Suporte a imagens E vídeos

### 4.2 Fluxo de Uso

```
1. Upload do arquivo para bucket store-assets
   ↓
2. Registro na tabela media_library
   ↓
3. URL da mídia disponível para uso em:
   - Blocos do Builder (HeroBanner, Image, etc.)
   - Categorias (banners)
   - Produtos (imagens)
   - Páginas institucionais
```

### 4.3 Payload de Registro na Media Library

```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_path": "550e8400-e29b-41d4-a716-446655440000/media-library/desktop/banner-1.jpg",
  "file_url": "https://ojssezfjhdvvncsqyhyq.supabase.co/storage/v1/object/public/store-assets/550e8400-e29b-41d4-a716-446655440000/media-library/desktop/banner-1.jpg",
  "file_name": "banner-1.jpg",
  "variant": "desktop",
  "file_size": 245000,
  "mime_type": "image/jpeg"
}
```

### 4.4 Consumo no Frontend

O hook `useMediaLibrary` busca mídias filtradas por:
- `tenant_id` (obrigatório, vem do contexto de auth)
- `variant` (opcional: 'desktop' ou 'mobile')
- `mediaType` (opcional: 'image', 'video' ou 'all')

---

## 5. Esquemas JSONB Detalhados

### 5.1 `store_settings.shipping_config`

```json
{
  "rules": [
    {
      "id": "uuid",
      "name": "Frete Grátis SP",
      "type": "free_shipping",
      "conditions": {
        "minValue": 199,
        "states": ["SP"]
      },
      "price": 0,
      "isActive": true
    }
  ],
  "provider": "frenet",
  "originZip": "01310100",
  "defaultDays": 7,
  "defaultPrice": 15.00,
  "freeShippingThreshold": 299
}
```

---

### 5.2 `store_settings.benefit_config`

```json
{
  "mode": "free_shipping",
  "enabled": true,
  "rewardLabel": "Frete Grátis",
  "successLabel": "Você ganhou frete grátis!",
  "progressColor": "#22c55e",
  "thresholdValue": 200
}
```

**Valores de `mode`:**
- `free_shipping` - Progresso para frete grátis
- `discount` - Progresso para desconto
- `gift` - Progresso para brinde

---

### 5.3 `store_settings.offers_config`

```json
{
  "crossSell": {
    "title": "Complete seu pedido",
    "enabled": false,
    "maxItems": 4,
    "strategy": "manual",
    "productIds": []
  },
  "bundles": {
    "title": "Kits com desconto",
    "enabled": false,
    "showSavings": true,
    "bundleProductIds": []
  },
  "orderBump": {
    "title": "Aproveite esta oferta!",
    "enabled": false,
    "productIds": [],
    "description": "Adicione ao seu pedido com desconto especial",
    "defaultChecked": false,
    "discountPercent": 10
  },
  "buyTogether": {
    "enabled": true,
    "useExistingRules": true
  }
}
```

---

### 5.4 `store_settings.social_custom`

```json
[
  {
    "name": "Pinterest",
    "url": "https://pinterest.com/minha-loja",
    "icon": "pinterest"
  },
  {
    "name": "LinkedIn",
    "url": "https://linkedin.com/company/minha-loja",
    "icon": "linkedin"
  }
]
```

---

## 6. Sistema de Blocos do Builder

### 6.1 Estrutura Base (BlockNode)

Todo conteúdo de página segue esta estrutura:

```typescript
interface BlockNode {
  id: string;           // ID único do bloco (ex: "hero-1703012345678-abc123def")
  type: string;         // Tipo do bloco (ex: "Hero", "ProductGrid")
  props: Record<string, unknown>;  // Propriedades configuráveis
  children?: BlockNode[];          // Blocos filhos (se suportado)
  hidden?: boolean;                // Bloco oculto?
}
```

### 6.2 Estrutura Raiz de uma Página

```json
{
  "id": "root",
  "type": "Page",
  "props": {
    "backgroundColor": "transparent",
    "padding": "none"
  },
  "children": [
    { "id": "header-xxx", "type": "Header", "props": {...} },
    { "id": "hero-xxx", "type": "HeroBanner", "props": {...} },
    { "id": "products-xxx", "type": "ProductGrid", "props": {...} },
    { "id": "footer-xxx", "type": "Footer", "props": {...} }
  ]
}
```

### 6.3 Blocos Disponíveis

#### LAYOUT

| Tipo | Label | Aceita Filhos | Removível | Essential |
|---|---|---|---|---|
| `Page` | Página | ✅ | ❌ | ✅ |
| `Section` | Seção | ✅ | ✅ | ❌ |
| `Container` | Container | ✅ | ✅ | ❌ |
| `Columns` | Colunas | ✅ (max 4) | ✅ | ❌ |
| `Divider` | Divisor | ❌ | ✅ | ❌ |
| `Spacer` | Espaçador | ❌ | ✅ | ❌ |

#### HEADER/FOOTER

| Tipo | Label | Aceita Filhos | Removível | Essential |
|---|---|---|---|---|
| `Header` | Cabeçalho | ❌ | ❌ | ✅ |
| `Footer` | Rodapé | ❌ | ❌ | ✅ |

#### CONTENT

| Tipo | Label | Aceita Filhos | Removível |
|---|---|---|---|
| `Hero` | Hero Banner | ❌ | ✅ |
| `RichText` | Texto | ❌ | ✅ |
| `Button` | Botão | ❌ | ✅ |
| `FAQ` | Perguntas Frequentes | ❌ | ✅ |
| `Testimonials` | Depoimentos | ❌ | ✅ |

#### MEDIA

| Tipo | Label | Aceita Filhos | Removível |
|---|---|---|---|
| `Image` | Imagem | ❌ | ✅ |
| `HeroBanner` | Banner Principal (Carrossel) | ❌ | ✅ |
| `VideoSection` | Seção de Vídeo | ❌ | ✅ |

#### E-COMMERCE

| Tipo | Label | Aceita Filhos | Removível | Template |
|---|---|---|---|---|
| `CategoryList` | Lista de Categorias | ❌ | ✅ | home |
| `ProductGrid` | Grade de Produtos | ❌ | ✅ | home, category |
| `ProductCarousel` | Carrossel de Produtos | ❌ | ✅ | home |
| `FeaturedProducts` | Produtos Selecionados | ❌ | ✅ | home |
| `ProductCard` | Card de Produto | ❌ | ✅ | - |
| `ProductDetails` | Detalhes do Produto | ❌ | ❌ | product |
| `CartSummary` | Resumo do Carrinho | ❌ | ❌ | cart |
| `CheckoutSteps` | Etapas do Checkout | ❌ | ❌ | checkout |
| `CollectionSection` | Categoria/Coleção | ❌ | ✅ | home |
| `InfoHighlights` | Destaques | ❌ | ✅ | home |
| `NewsletterSignup` | Newsletter | ❌ | ✅ | home |

---

### 6.4 Props por Tipo de Bloco

#### `Header` (Cabeçalho)

```json
{
  "menuId": "uuid-do-menu",
  "showSearch": true,
  "showCart": true,
  "sticky": true,
  "headerStyle": "logo_left_menu_inline",
  "headerBgColor": "#ffffff",
  "headerTextColor": "#1f2937",
  "headerIconColor": "#6b7280",
  "menuBgColor": "",
  "menuTextColor": "",
  "stickyOnMobile": true,
  "showWhatsApp": false,
  "whatsAppNumber": "5511999999999",
  "whatsAppLabel": "WhatsApp",
  "showPhone": false,
  "phoneNumber": "+55 (11) 99999-9999",
  "phoneLabel": "Atendimento",
  "customerAreaEnabled": false,
  "customerAreaLabel": "Minhas compras",
  "featuredPromosEnabled": false,
  "featuredPromosLabel": "Promoções",
  "featuredPromosTextColor": "#d97706",
  "featuredPromosPageId": "",
  "noticeEnabled": true,
  "noticeText": "Frete grátis em compras acima de R$199!",
  "noticeBgColor": "#1e40af",
  "noticeTextColor": "#ffffff",
  "noticeAnimation": "fade",
  "noticeActionEnabled": false,
  "noticeActionLabel": "Saiba mais",
  "noticeActionUrl": "/promocao",
  "noticeActionTarget": "_self"
}
```

**Valores de `headerStyle`:**
- `logo_left_menu_inline` - Logo à esquerda, menu ao lado
- `logo_left_menu_below` - Logo à esquerda, menu abaixo
- `logo_center_menu_below` - Logo centralizado, menu abaixo

---

#### `Footer` (Rodapé)

```json
{
  "showLogo": true,
  "showSac": true,
  "showSocial": true,
  "showLegal": true,
  "sacTitle": "Atendimento (SAC)",
  "legalTextOverride": "",
  "footerBgColor": "#1f2937",
  "footerTextColor": "#f3f4f6",
  "paymentMethods": {
    "title": "Formas de Pagamento",
    "items": [
      { "imageUrl": "data:image/svg+xml;base64,...", "alt": "Visa", "link": "" },
      { "imageUrl": "data:image/svg+xml;base64,...", "alt": "Mastercard", "link": "" }
    ]
  },
  "securitySeals": {
    "title": "Selos de Segurança",
    "items": []
  },
  "shippingMethods": {
    "title": "Formas de Envio",
    "items": []
  },
  "officialStores": {
    "title": "Lojas Oficiais",
    "items": []
  }
}
```

---

#### `HeroBanner` (Carrossel Principal)

```json
{
  "slides": [
    {
      "id": "slide-1",
      "imageDesktop": "https://exemplo.com/banner-desktop.jpg",
      "imageMobile": "https://exemplo.com/banner-mobile.jpg",
      "alt": "Promoção de Verão",
      "linkUrl": "/promocao-verao",
      "title": "",
      "subtitle": "",
      "buttonText": "",
      "overlayOpacity": 0
    }
  ],
  "autoplaySeconds": 5,
  "bannerWidth": "full",
  "showArrows": true,
  "showDots": true
}
```

---

#### `ProductGrid` (Grade de Produtos)

```json
{
  "title": "Produtos em Destaque",
  "source": "featured",
  "categoryId": "",
  "columns": 4,
  "limit": 8,
  "showPrice": true
}
```

**Valores de `source`:**
- `featured` - Produtos marcados como destaque
- `bestsellers` - Mais vendidos
- `newest` - Mais recentes
- `category` - Produtos de uma categoria específica (requer `categoryId`)

---

#### `ProductCarousel` (Carrossel de Produtos)

```json
{
  "title": "Novidades",
  "source": "newest",
  "categoryId": "",
  "limit": 8,
  "showPrice": true,
  "showButton": true,
  "buttonText": "Ver produto"
}
```

---

#### `FeaturedProducts` (Produtos Selecionados)

```json
{
  "title": "Produtos Selecionados",
  "productIds": [
    "uuid-produto-1",
    "uuid-produto-2",
    "uuid-produto-3"
  ],
  "limit": 4,
  "columns": 4,
  "showPrice": true,
  "showButton": true,
  "buttonText": "Ver produto"
}
```

---

#### `CategoryList` (Lista de Categorias)

```json
{
  "title": "Categorias",
  "layout": "grid",
  "columns": 4,
  "showDescription": false
}
```

**Valores de `layout`:**
- `grid` - Grade
- `list` - Lista
- `carousel` - Carrossel

---

#### `InfoHighlights` (Destaques Informativos)

```json
{
  "title": "",
  "layout": "horizontal",
  "items": [
    {
      "icon": "truck",
      "title": "Frete Grátis",
      "description": "Em compras acima de R$ 199"
    },
    {
      "icon": "shield-check",
      "title": "Compra Segura",
      "description": "Seus dados protegidos"
    },
    {
      "icon": "credit-card",
      "title": "Parcelamento",
      "description": "Em até 12x sem juros"
    }
  ],
  "iconColor": "#6366f1",
  "showBorder": true
}
```

**Ícones disponíveis:**
- `truck`, `shield-check`, `credit-card`, `package`, `refresh-cw`, `headphones`, `clock`, `star`, `heart`, `gift`

---

#### `Image` (Imagem)

```json
{
  "imageDesktop": "https://exemplo.com/imagem-desktop.jpg",
  "imageMobile": "https://exemplo.com/imagem-mobile.jpg",
  "alt": "Descrição da imagem",
  "width": "full",
  "height": "auto",
  "aspectRatio": "auto",
  "objectFit": "cover",
  "objectPosition": "center",
  "rounded": "none",
  "shadow": "none",
  "linkUrl": ""
}
```

---

#### `VideoSection` (Seção de Vídeo)

```json
{
  "title": "Conheça nossa marca",
  "videoType": "youtube",
  "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "vimeoUrl": "",
  "uploadedVideoUrl": "",
  "autoplay": false,
  "muted": true,
  "loop": true,
  "aspectRatio": "16:9"
}
```

**Valores de `videoType`:**
- `youtube` - Vídeo do YouTube (usar `youtubeUrl`)
- `vimeo` - Vídeo do Vimeo (usar `vimeoUrl`)
- `upload` - Vídeo hospedado (usar `uploadedVideoUrl`)

---

#### `RichText` (Texto Rico)

```json
{
  "content": "<h2>Título</h2><p>Parágrafo de texto com <strong>negrito</strong>.</p>",
  "fontFamily": "inherit",
  "fontSize": "base",
  "fontWeight": "normal"
}
```

---

#### `NewsletterSignup` (Newsletter)

```json
{
  "title": "Receba nossas novidades",
  "description": "Cadastre-se e ganhe 10% de desconto na primeira compra",
  "buttonText": "Cadastrar",
  "backgroundColor": "#f3f4f6",
  "successMessage": "Cadastro realizado com sucesso!"
}
```

---

#### `Testimonials` (Depoimentos)

```json
{
  "title": "O que nossos clientes dizem",
  "items": [
    {
      "id": "testimonial-1",
      "name": "Maria Silva",
      "role": "Cliente desde 2023",
      "content": "Excelente atendimento e produtos de qualidade!",
      "rating": 5,
      "avatar": ""
    }
  ],
  "layout": "carousel",
  "showRating": true
}
```

---

#### `FAQ` (Perguntas Frequentes)

```json
{
  "title": "Perguntas Frequentes",
  "items": [
    {
      "id": "faq-1",
      "question": "Qual o prazo de entrega?",
      "answer": "O prazo varia de acordo com sua região. Consulte no carrinho."
    }
  ],
  "layout": "accordion"
}
```

---

## 7. ENUMs e Tipos Customizados

### 7.1 `app_role` (Papéis de Usuário)

```sql
CREATE TYPE app_role AS ENUM ('owner', 'admin', 'operator', 'viewer');
```

| Valor | Descrição | Permissões |
|---|---|---|
| `owner` | Dono | Acesso total, pode excluir tenant |
| `admin` | Administrador | Quase tudo, exceto excluir tenant |
| `operator` | Operador | CRUD de produtos, pedidos, clientes |
| `viewer` | Visualizador | Somente leitura |

---

### 7.2 `order_status` (Status do Pedido)

```sql
CREATE TYPE order_status AS ENUM (
  'pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
);
```

| Valor | Descrição | Próximos Estados |
|---|---|---|
| `pending` | Aguardando pagamento | processing, cancelled |
| `processing` | Em processamento | shipped, cancelled |
| `shipped` | Enviado | delivered, returned |
| `delivered` | Entregue | refunded |
| `cancelled` | Cancelado | - |
| `refunded` | Reembolsado | - |

---

### 7.3 `payment_status` (Status do Pagamento)

```sql
CREATE TYPE payment_status AS ENUM (
  'pending', 'paid', 'failed', 'refunded', 'cancelled'
);
```

---

### 7.4 `shipping_status` (Status do Envio)

```sql
CREATE TYPE shipping_status AS ENUM (
  'pending', 'processing', 'shipped', 'in_transit', 'delivered', 'returned'
);
```

---

### 7.5 `payment_method` (Método de Pagamento)

```sql
CREATE TYPE payment_method AS ENUM (
  'credit_card', 'debit_card', 'pix', 'boleto', 'wallet'
);
```

---

### 7.6 `support_channel_type` (Canais de Suporte)

```sql
CREATE TYPE support_channel_type AS ENUM (
  'whatsapp', 'email', 'instagram', 'facebook', 'telegram', 'chat', 'phone'
);
```

---

### 7.7 `conversation_status` (Status da Conversa)

```sql
CREATE TYPE conversation_status AS ENUM (
  'new', 'open', 'bot', 'pending', 'resolved', 'closed'
);
```

| Valor | Descrição |
|---|---|
| `new` | Nova conversa |
| `open` | Em atendimento humano |
| `bot` | Sendo atendida pela IA |
| `pending` | Aguardando resposta do cliente |
| `resolved` | Resolvida |
| `closed` | Fechada |

---

### 7.8 `message_direction` (Direção da Mensagem)

```sql
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
```

---

### 7.9 `message_sender_type` (Tipo do Remetente)

```sql
CREATE TYPE message_sender_type AS ENUM (
  'customer', 'agent', 'bot', 'system'
);
```

---

### 7.10 `message_delivery_status` (Status de Entrega)

```sql
CREATE TYPE message_delivery_status AS ENUM (
  'pending', 'sent', 'delivered', 'read', 'failed'
);
```

---

## 8. Row Level Security (RLS)

### 8.1 Funções Auxiliares

```sql
-- Verifica se usuário pertence ao tenant
CREATE FUNCTION user_belongs_to_tenant(user_id UUID, tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = $1 
    AND user_roles.tenant_id = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica se usuário tem papel específico
CREATE FUNCTION has_role(user_id UUID, tenant_id UUID, required_role app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = $1 
    AND user_roles.tenant_id = $2
    AND user_roles.role = $3
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtém tenant atual do usuário
CREATE FUNCTION get_current_tenant_id(user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id FROM user_roles 
    WHERE user_roles.user_id = $1 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 8.2 Padrões de Policies

#### Leitura por membros do tenant:
```sql
CREATE POLICY "Users can view their tenant data"
ON table_name FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));
```

#### Escrita por admins:
```sql
CREATE POLICY "Admins can manage data"
ON table_name FOR ALL
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR 
  has_role(auth.uid(), tenant_id, 'admin')
);
```

#### Leitura pública (storefront):
```sql
CREATE POLICY "Anyone can view active products"
ON products FOR SELECT
USING (status = 'active');
```

### 8.3 Bypass de RLS

Para operações via N8N ou automações externas, use a **service_role key** que bypassa todas as policies:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ojssezfjhdvvncsqyhyq.supabase.co',
  'SERVICE_ROLE_KEY' // ⚠️ NUNCA expor no frontend
)
```

---

## 9. Edge Functions - Backend

### 9.1 Funções Disponíveis

| Função | Descrição | Auth | Uso |
|---|---|---|---|
| `checkout-create-order` | Cria pedido a partir do checkout | service_role | Checkout |
| `checkout-session-start` | Inicia sessão de checkout | anon | Storefront |
| `checkout-session-heartbeat` | Mantém sessão ativa | anon | Storefront |
| `get-order` | Busca pedido por número | anon | Thank You page |
| `discount-validate` | Valida cupom de desconto | anon | Storefront |
| `shipping-quote` | Cotação de frete | anon | Storefront |
| `frenet-quote` | Cotação via Frenet | service_role | Interno |
| `email-send` | Envia email transacional | service_role | Interno |
| `whatsapp-send` | Envia WhatsApp | service_role | Interno |
| `ai-support-chat` | IA de atendimento | service_role | Suporte |
| `support-send-message` | Envia mensagem de suporte | service_role | Suporte |
| `import-visual` | Importa visual de loja externa | authenticated | Importação |
| `import-data` | Importa dados (CSV/JSON) | authenticated | Importação |
| `process-events` | Processa fila de eventos | service_role | Background |
| `run-notifications` | Dispara notificações | service_role | Background |

### 9.2 Chamando Edge Functions via N8N

```http
POST https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/{function_name}
Authorization: Bearer {service_role_key}
Content-Type: application/json

{
  "param1": "value1",
  "param2": "value2"
}
```

---

## 10. Lógica de Navegação e Slugs

### 10.1 Padrão de URLs

| Entidade | Padrão de URL | Exemplo |
|---|---|---|
| Home | `/` | `/` |
| Categoria | `/categoria/{slug}` | `/categoria/roupas-femininas` |
| Subcategoria | `/categoria/{slug}` | `/categoria/vestidos` |
| Produto | `/produto/{slug}` | `/produto/vestido-floral-azul` |
| Página Institucional | `/pagina/{slug}` | `/pagina/sobre-nos` |
| Carrinho | `/carrinho` | `/carrinho` |
| Checkout | `/checkout` | `/checkout` |
| Obrigado | `/obrigado/{order_number}` | `/obrigado/1001` |
| Conta | `/conta` | `/conta` |
| Pedidos | `/conta/pedidos` | `/conta/pedidos` |
| Detalhe Pedido | `/conta/pedidos/{order_number}` | `/conta/pedidos/1001` |

### 10.2 Regras de Geração de Slug

```javascript
function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '')    // Remove caracteres especiais
    .replace(/\s+/g, '-')             // Espaços viram hífens
    .replace(/-+/g, '-')              // Remove hífens duplicados
    .replace(/^-|-$/g, '');           // Remove hífens no início/fim
}

// Exemplos:
generateSlug("Vestido Floral Azul") // "vestido-floral-azul"
generateSlug("Camiseta Básica (P)") // "camiseta-basica-p"
generateSlug("Tênis Nike Air Max")  // "tenis-nike-air-max"
```

### 10.3 Resolução de Links no Menu

```javascript
function resolveMenuItemUrl(item, categories, pages) {
  switch (item.item_type) {
    case 'home':
      return '/';
    case 'category':
      const cat = categories.find(c => c.id === item.ref_id);
      return cat ? `/categoria/${cat.slug}` : '#';
    case 'page':
      const page = pages.find(p => p.id === item.ref_id);
      return page ? `/pagina/${page.slug}` : '#';
    case 'product':
      return `/produto/${productSlug}`; // Buscar slug
    case 'external':
      return item.url;
    default:
      return '#';
  }
}
```

---

## 11. Frontend - Hooks e Componentes

### 11.1 Hooks Principais

| Hook | Descrição | Dependência |
|---|---|---|
| `useAuth` | Autenticação e contexto de tenant | - |
| `useTenantSlug` | Slug do tenant atual | useAuth |
| `useStoreSettings` | Configurações da loja | tenant_id |
| `useProducts` | CRUD de produtos | tenant_id |
| `useCategories` | CRUD de categorias | tenant_id |
| `useOrders` | CRUD de pedidos | tenant_id |
| `useCustomers` | CRUD de clientes | tenant_id |
| `useMenus` | CRUD de menus | tenant_id |
| `useMediaLibrary` | Biblioteca de mídias | tenant_id |
| `useBuilderStore` | Estado do Builder | zustand |
| `usePageBuilder` | CRUD de páginas/templates | tenant_id |

### 11.2 Componentes de Upload

| Componente | Uso | Props |
|---|---|---|
| `ImageUploader` | Upload simples | value, onChange, aspectRatio |
| `ImageUploaderWithLibrary` | Upload + Media Library | value, onChange, variant |
| `MediaLibraryPicker` | Seletor da biblioteca | onSelect, variant, mediaType |

### 11.3 Fluxo de Renderização do Storefront

```
1. Resolve tenant pelo domínio/slug
   ↓
2. Carrega store_settings
   ↓
3. Identifica page_type (home, category, product, etc.)
   ↓
4. Busca storefront_page_templates.published_version
   ↓
5. Carrega store_page_versions.content
   ↓
6. Renderiza BlockTree recursivamente
   ↓
7. Cada bloco busca dados dinâmicos (produtos, categorias, etc.)
```

---

## 12. Guia de Injeção de Dados (Step-by-Step)

### 12.1 Fluxo Completo: Clonar uma Loja

#### PASSO 1: Criar/Atualizar o Tenant

```sql
INSERT INTO tenants (id, name, slug)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Minha Loja Nova',
  'minha-loja-nova'
)
ON CONFLICT (slug) 
DO UPDATE SET name = EXCLUDED.name, updated_at = now();
```

#### PASSO 2: Criar Store Settings

```sql
INSERT INTO store_settings (
  tenant_id,
  store_name,
  store_description,
  logo_url,
  favicon_url,
  primary_color,
  secondary_color,
  accent_color,
  social_instagram,
  social_whatsapp,
  contact_email,
  contact_phone,
  business_cnpj,
  business_legal_name,
  is_published
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Minha Loja Nova',
  'A melhor loja do Brasil',
  'https://storage.exemplo.com/logo.png',
  'https://storage.exemplo.com/favicon.ico',
  '#6366f1',
  '#8b5cf6',
  '#f59e0b',
  'https://instagram.com/minhaloja',
  '5511999999999',
  'contato@minhaloja.com',
  '+55 (11) 99999-9999',
  '12.345.678/0001-90',
  'Minha Loja LTDA',
  true
)
ON CONFLICT (tenant_id)
DO UPDATE SET 
  store_name = EXCLUDED.store_name,
  updated_at = now();
```

#### PASSO 3: Upload de Imagens para Storage

```bash
# Via curl (exemplo para N8N HTTP Request)
curl -X POST \
  'https://ojssezfjhdvvncsqyhyq.supabase.co/storage/v1/object/store-assets/550e8400-e29b-41d4-a716-446655440000/logo.png' \
  -H 'Authorization: Bearer SERVICE_ROLE_KEY' \
  -H 'Content-Type: image/png' \
  --data-binary '@logo.png'
```

#### PASSO 4: Registrar na Media Library (se aplicável)

```sql
INSERT INTO media_library (
  tenant_id, file_path, file_url, file_name, variant, file_size, mime_type
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000/media-library/desktop/banner-1.jpg',
  'https://ojssezfjhdvvncsqyhyq.supabase.co/storage/v1/object/public/store-assets/550e8400-e29b-41d4-a716-446655440000/media-library/desktop/banner-1.jpg',
  'banner-1.jpg',
  'desktop',
  245000,
  'image/jpeg'
);
```

#### PASSO 5: Criar Árvore de Categorias

```sql
-- Categoria raiz
INSERT INTO categories (id, tenant_id, name, slug, is_active, sort_order)
VALUES (
  'cat-001',
  '550e8400-e29b-41d4-a716-446655440000',
  'Roupas Femininas',
  'roupas-femininas',
  true,
  1
);

-- Subcategoria
INSERT INTO categories (id, tenant_id, name, slug, parent_id, is_active, sort_order)
VALUES (
  'cat-002',
  '550e8400-e29b-41d4-a716-446655440000',
  'Vestidos',
  'vestidos',
  'cat-001',  -- parent_id aponta para a categoria pai
  true,
  1
);
```

#### PASSO 6: Cadastrar Produtos

```sql
INSERT INTO products (
  id, tenant_id, sku, name, slug, 
  price, compare_at_price, 
  description, short_description,
  stock_quantity, status, is_featured
)
VALUES (
  'prod-001',
  '550e8400-e29b-41d4-a716-446655440000',
  'VF-001',
  'Vestido Floral Azul',
  'vestido-floral-azul',
  199.90,
  249.90,
  '<p>Lindo vestido floral em tons de azul.</p>',
  'Vestido floral perfeito para o verão',
  50,
  'active',  -- ⚠️ Usar 'active' para produtos visíveis
  true
);
```

#### PASSO 7: Vincular Produtos a Categorias

```sql
INSERT INTO product_categories (tenant_id, product_id, category_id, position)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'prod-001',
  'cat-002',  -- Categoria "Vestidos"
  1
);
```

#### PASSO 8: Adicionar Imagens do Produto

```sql
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
VALUES 
  ('prod-001', 'https://storage.exemplo.com/vestido-1.jpg', 'Vestido Floral Azul - Frente', 1, true),
  ('prod-001', 'https://storage.exemplo.com/vestido-2.jpg', 'Vestido Floral Azul - Costas', 2, false),
  ('prod-001', 'https://storage.exemplo.com/vestido-3.jpg', 'Vestido Floral Azul - Detalhe', 3, false);
```

#### PASSO 9: Criar Variantes (se aplicável)

```sql
-- Marcar produto como tendo variantes
UPDATE products SET has_variants = true WHERE id = 'prod-001';

-- Inserir variantes
INSERT INTO product_variants (
  product_id, sku, name,
  option1_name, option1_value,
  option2_name, option2_value,
  price, stock_quantity, is_active
)
VALUES 
  ('prod-001', 'VF-001-P-AZ', 'P - Azul', 'Tamanho', 'P', 'Cor', 'Azul', 199.90, 20, true),
  ('prod-001', 'VF-001-M-AZ', 'M - Azul', 'Tamanho', 'M', 'Cor', 'Azul', 199.90, 20, true),
  ('prod-001', 'VF-001-G-AZ', 'G - Azul', 'Tamanho', 'G', 'Cor', 'Azul', 199.90, 10, true);
```

#### PASSO 10: Criar Menu Principal

```sql
-- Criar o menu
INSERT INTO menus (id, tenant_id, name, location)
VALUES (
  'menu-header-001',
  '550e8400-e29b-41d4-a716-446655440000',
  'Menu Principal',
  'header'
);

-- Inserir itens do menu
INSERT INTO menu_items (tenant_id, menu_id, label, item_type, ref_id, sort_order)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'menu-header-001', 'Início', 'home', NULL, 1),
  ('550e8400-e29b-41d4-a716-446655440000', 'menu-header-001', 'Roupas Femininas', 'category', 'cat-001', 2),
  ('550e8400-e29b-41d4-a716-446655440000', 'menu-header-001', 'Vestidos', 'category', 'cat-002', 3);
```

#### PASSO 11: Criar Templates do Storefront

```sql
INSERT INTO storefront_page_templates (tenant_id, page_type)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'home'),
  ('550e8400-e29b-41d4-a716-446655440000', 'category'),
  ('550e8400-e29b-41d4-a716-446655440000', 'product'),
  ('550e8400-e29b-41d4-a716-446655440000', 'cart'),
  ('550e8400-e29b-41d4-a716-446655440000', 'checkout');
```

#### PASSO 12: Gerar e Publicar Conteúdo da Home

```sql
-- Criar versão publicada
INSERT INTO store_page_versions (
  tenant_id,
  entity_type,
  page_type,
  version,
  status,
  content
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'template',
  'home',
  1,
  'published',
  '{"id":"root","type":"Page","props":{},"children":[...]}'::jsonb
);

-- Atualizar template apontando para versão publicada
UPDATE storefront_page_templates 
SET published_version = 1, updated_at = now()
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000' 
  AND page_type = 'home';
```

---

## 13. Payloads de Exemplo

### 13.1 Payload Completo: Home Page

```json
{
  "id": "root",
  "type": "Page",
  "props": {
    "backgroundColor": "transparent",
    "padding": "none"
  },
  "children": [
    {
      "id": "header-1703012345678",
      "type": "Header",
      "props": {
        "menuId": "menu-header-001",
        "showSearch": true,
        "showCart": true,
        "sticky": true,
        "headerStyle": "logo_left_menu_inline",
        "stickyOnMobile": true,
        "noticeEnabled": true,
        "noticeText": "Frete grátis em compras acima de R$199!",
        "noticeBgColor": "#1e40af",
        "noticeTextColor": "#ffffff"
      }
    },
    {
      "id": "hero-1703012345679",
      "type": "HeroBanner",
      "props": {
        "slides": [
          {
            "id": "slide-1",
            "imageDesktop": "https://storage.exemplo.com/banner-desktop.jpg",
            "imageMobile": "https://storage.exemplo.com/banner-mobile.jpg",
            "alt": "Coleção Verão 2024",
            "linkUrl": "/categoria/verao-2024"
          }
        ],
        "autoplaySeconds": 5,
        "bannerWidth": "full",
        "showArrows": true,
        "showDots": true
      }
    },
    {
      "id": "highlights-1703012345680",
      "type": "InfoHighlights",
      "props": {
        "layout": "horizontal",
        "items": [
          {
            "icon": "truck",
            "title": "Frete Grátis",
            "description": "Em compras acima de R$ 199"
          },
          {
            "icon": "shield-check",
            "title": "Compra Segura",
            "description": "Seus dados protegidos"
          },
          {
            "icon": "credit-card",
            "title": "Até 12x",
            "description": "Sem juros no cartão"
          }
        ],
        "iconColor": "#6366f1",
        "showBorder": true
      }
    },
    {
      "id": "products-1703012345681",
      "type": "ProductCarousel",
      "props": {
        "title": "Destaques",
        "source": "featured",
        "limit": 8,
        "showPrice": true,
        "showButton": true,
        "buttonText": "Ver produto"
      }
    },
    {
      "id": "categories-1703012345682",
      "type": "CategoryList",
      "props": {
        "title": "Categorias",
        "layout": "grid",
        "columns": 4,
        "showDescription": false
      }
    },
    {
      "id": "newsletter-1703012345683",
      "type": "NewsletterSignup",
      "props": {
        "title": "Receba nossas novidades",
        "description": "Cadastre-se e ganhe 10% OFF na primeira compra",
        "buttonText": "Cadastrar",
        "backgroundColor": "#f3f4f6"
      }
    },
    {
      "id": "footer-1703012345684",
      "type": "Footer",
      "props": {
        "showLogo": true,
        "showSac": true,
        "showSocial": true,
        "showLegal": true,
        "footerBgColor": "#1f2937",
        "footerTextColor": "#f3f4f6"
      }
    }
  ]
}
```

### 13.2 Payload: Produto Completo

```json
{
  "id": "prod-001",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "sku": "VF-001",
  "name": "Vestido Floral Azul",
  "slug": "vestido-floral-azul",
  "description": "<p>Lindo vestido floral em tons de azul, perfeito para o verão.</p><ul><li>Tecido leve e confortável</li><li>Comprimento midi</li><li>Decote V</li></ul>",
  "short_description": "Vestido floral perfeito para o verão",
  "price": 199.90,
  "compare_at_price": 249.90,
  "cost_price": 89.90,
  "stock_quantity": 50,
  "low_stock_threshold": 5,
  "manage_stock": true,
  "allow_backorder": false,
  "weight": 0.3,
  "width": 30,
  "height": 40,
  "depth": 5,
  "seo_title": "Vestido Floral Azul | Minha Loja",
  "seo_description": "Compre o Vestido Floral Azul com o melhor preço. Frete grátis em compras acima de R$199.",
  "status": "active",
  "is_featured": true,
  "has_variants": true
}
```

### 13.3 Payload: Menu com Submenus

```json
{
  "menu": {
    "id": "menu-001",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Menu Principal",
    "location": "header"
  },
  "items": [
    {
      "id": "item-001",
      "label": "Início",
      "item_type": "home",
      "ref_id": null,
      "url": null,
      "sort_order": 1,
      "parent_id": null
    },
    {
      "id": "item-002",
      "label": "Roupas",
      "item_type": "category",
      "ref_id": "cat-001",
      "url": null,
      "sort_order": 2,
      "parent_id": null
    },
    {
      "id": "item-003",
      "label": "Vestidos",
      "item_type": "category",
      "ref_id": "cat-002",
      "url": null,
      "sort_order": 1,
      "parent_id": "item-002"
    },
    {
      "id": "item-004",
      "label": "Blusas",
      "item_type": "category",
      "ref_id": "cat-003",
      "url": null,
      "sort_order": 2,
      "parent_id": "item-002"
    },
    {
      "id": "item-005",
      "label": "Sobre Nós",
      "item_type": "page",
      "ref_id": "page-sobre",
      "url": null,
      "sort_order": 3,
      "parent_id": null
    },
    {
      "id": "item-006",
      "label": "Blog",
      "item_type": "external",
      "ref_id": null,
      "url": "https://blog.minhaloja.com",
      "sort_order": 4,
      "parent_id": null
    }
  ]
}
```

### 13.4 Payload: Pedido Completo

```json
{
  "order": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_id": "cust-001",
    "order_number": "#1001",
    "status": "processing",
    "subtotal": 399.80,
    "discount_total": 39.98,
    "shipping_total": 0,
    "tax_total": 0,
    "total": 359.82,
    "payment_method": "credit_card",
    "payment_status": "paid",
    "payment_gateway": "pagarme",
    "paid_at": "2024-01-15T10:30:00Z",
    "shipping_status": "pending",
    "customer_name": "Maria Silva",
    "customer_email": "maria@email.com",
    "customer_phone": "11999999999",
    "shipping_street": "Rua das Flores",
    "shipping_number": "123",
    "shipping_complement": "Apto 45",
    "shipping_neighborhood": "Centro",
    "shipping_city": "São Paulo",
    "shipping_state": "SP",
    "shipping_postal_code": "01310100",
    "shipping_country": "BR",
    "discount_code": "DESCONTO10",
    "discount_name": "10% de desconto",
    "discount_type": "percentage",
    "free_shipping": true,
    "shipping_service_name": "PAC",
    "shipping_estimated_days": 7
  },
  "items": [
    {
      "order_id": "order-001",
      "product_id": "prod-001",
      "sku": "VF-001-M-AZ",
      "product_name": "Vestido Floral Azul - M",
      "product_image_url": "https://storage.exemplo.com/vestido-1.jpg",
      "quantity": 2,
      "unit_price": 199.90,
      "discount_amount": 19.99,
      "total_price": 379.81
    }
  ]
}
```

### 13.5 Payload: Media Library Item

```json
{
  "id": "media-001",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_path": "550e8400-e29b-41d4-a716-446655440000/media-library/desktop/hero-banner-verao.jpg",
  "file_url": "https://ojssezfjhdvvncsqyhyq.supabase.co/storage/v1/object/public/store-assets/550e8400-e29b-41d4-a716-446655440000/media-library/desktop/hero-banner-verao.jpg",
  "file_name": "hero-banner-verao.jpg",
  "variant": "desktop",
  "file_size": 524288,
  "mime_type": "image/jpeg",
  "created_at": "2024-12-30T10:00:00Z"
}
```

---

## 14. Troubleshooting e Notas Importantes

### 14.1 Idempotência

Sempre use `ON CONFLICT ... DO UPDATE` para operações de upsert, garantindo que reexecuções não criem duplicatas:

```sql
INSERT INTO categories (id, tenant_id, name, slug, is_active)
VALUES ('cat-001', 'tenant-001', 'Roupas', 'roupas', true)
ON CONFLICT (tenant_id, slug) 
DO UPDATE SET 
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  updated_at = now();
```

### 14.2 Ordem de Dependências

**SEMPRE** respeite a ordem de inserção. Tente inserir um produto antes do tenant e você terá erro de FK.

### 14.3 UUIDs

Prefira gerar UUIDs no lado do cliente/automação para ter controle dos IDs e facilitar referências cruzadas:

```javascript
// JavaScript - gerar UUID v4
const uuid = crypto.randomUUID();
```

### 14.4 Timestamps

Campos `created_at` e `updated_at` são preenchidos automaticamente. Não é necessário incluí-los nos INSERTs.

### 14.5 Slugs

Sempre valide a unicidade de slugs por tenant antes de inserir. Use a função de geração de slug descrita na seção 10.2.

### 14.6 RLS (Row Level Security)

As tabelas possuem RLS ativo. Para operações via N8N, use a **service_role key** do Supabase que bypassa RLS:

```javascript
// ⚠️ NUNCA expor no frontend ou em código público
const supabase = createClient(
  'https://ojssezfjhdvvncsqyhyq.supabase.co',
  'SERVICE_ROLE_KEY'
)
```

### 14.7 Status de Produtos

⚠️ **IMPORTANTE:** Use os status corretos:
- `draft` - Rascunho (não visível)
- `active` - Ativo (visível no storefront)
- `inactive` - Inativo temporariamente
- `archived` - Arquivado

### 14.8 Upload de Imagens

Para imagens externas, o fluxo recomendado é:
1. Baixar a imagem da URL externa
2. Fazer upload para o Supabase Storage
3. Usar a URL do Supabase no banco

Isso garante que as imagens não quebrem se a fonte externa ficar indisponível.

### 14.9 Vídeos

Vídeos podem ser:
- **YouTube/Vimeo:** Armazenar apenas a URL do embed
- **Upload direto:** Fazer upload para o bucket e armazenar a URL

### 14.10 Erros Comuns

| Erro | Causa | Solução |
|---|---|---|
| `23505` | Violação de unique constraint | Verificar se registro já existe |
| `23503` | Violação de FK | Inserir registro pai primeiro |
| `42501` | Permissão negada (RLS) | Usar service_role key |
| `22P02` | UUID inválido | Verificar formato do UUID |

---

## 📌 Resumo Executivo

1. **Sempre comece pelo tenant** - É a raiz de tudo
2. **Respeite a hierarquia de FKs** - Pai antes do filho
3. **Use service_role para automação** - Bypassa RLS
4. **Imagens vão no Storage** - Nunca base64 no banco
5. **Registre mídias na Media Library** - Para reutilização
6. **Status de produto = `active`** - Para visibilidade
7. **Slugs são únicos por tenant** - Não globalmente
8. **Blocos seguem estrutura fixa** - id, type, props, children
9. **UUIDs client-side** - Para controle de referências
10. **Upsert com ON CONFLICT** - Para idempotência

---

*Documento gerado em: 2024-12-30*
*Versão: 2.0.0*
*Autor: Comando Central AI*
