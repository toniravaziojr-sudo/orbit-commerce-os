# 🗄️ DATABASE MASTER GUIDE - Comando Central

> **Gabarito Mestre para Integração Externa via N8N**
> 
> Este documento é a fonte de verdade para injeção de dados externos no banco de dados Supabase da aplicação Comando Central. Qualquer agente de IA ou sistema de automação pode usar este guia para popular todas as tabelas sem causar quebras no Frontend ou erros de integridade.

---

## 📋 Índice

1. [Arquitetura e Dependências](#1-arquitetura-e-dependências)
2. [Dicionário de Dados - Tabelas Principais](#2-dicionário-de-dados---tabelas-principais)
3. [Esquemas JSONB Detalhados](#3-esquemas-jsonb-detalhados)
4. [Sistema de Blocos do Builder](#4-sistema-de-blocos-do-builder)
5. [Lógica de Navegação e Slugs](#5-lógica-de-navegação-e-slugs)
6. [Guia de Injeção de Dados (Step-by-Step)](#6-guia-de-injeção-de-dados-step-by-step)
7. [Payloads de Exemplo](#7-payloads-de-exemplo)

---

## 1. Arquitetura e Dependências

### 1.1 Diagrama de Dependências Hierárquicas

```
tenants (RAIZ - obrigatório para tudo)
├── store_settings (1:1 com tenant)
├── categories
│   └── products (via product_categories)
│       ├── product_images
│       └── product_variants
├── menus
│   └── menu_items
├── store_pages (páginas institucionais)
├── storefront_page_templates
│   └── store_page_versions (conteúdo do Builder)
├── customers
│   ├── customer_addresses
│   └── orders
│       └── order_items
└── discounts
```

### 1.2 Regra de Ouro

> **NUNCA insira dados em tabelas filhas antes de criar o registro pai correspondente.**

| Ordem de Inserção | Tabela | Dependência |
|---|---|---|
| 1 | `tenants` | Nenhuma |
| 2 | `store_settings` | `tenant_id` |
| 3 | `categories` | `tenant_id` |
| 4 | `products` | `tenant_id` |
| 5 | `product_categories` | `product_id`, `category_id` |
| 6 | `product_images` | `product_id` |
| 7 | `product_variants` | `product_id` |
| 8 | `menus` | `tenant_id` |
| 9 | `menu_items` | `tenant_id`, `menu_id`, `ref_id` (opcional) |
| 10 | `storefront_page_templates` | `tenant_id` |
| 11 | `store_page_versions` | `tenant_id`, `page_type` |
| 12 | `store_pages` | `tenant_id` |
| 13 | `customers` | `tenant_id` |
| 14 | `orders` | `tenant_id`, `customer_id` (opcional) |
| 15 | `order_items` | `order_id` |

---

## 2. Dicionário de Dados - Tabelas Principais

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

### 2.2 `store_settings` (Configurações da Loja)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
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

### 2.3 `categories` (Categorias de Produtos)

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

**Constraints:**
- `(tenant_id, slug)` deve ser único por tenant

---

### 2.4 `products` (Produtos)

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
| `status` | TEXT | ❌ | `'draft'` | `draft`, `published`, `archived` |
| `is_featured` | BOOLEAN | ✅ | `false` | Produto em destaque? |
| `has_variants` | BOOLEAN | ✅ | `false` | Possui variantes? |

**Constraints:**
- `(tenant_id, sku)` deve ser único
- `(tenant_id, slug)` deve ser único

---

### 2.5 `product_images` (Imagens de Produtos)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `product_id` | UUID | ❌ | - | **FK** → `products.id` |
| `variant_id` | UUID | ✅ | - | **FK** → `product_variants.id` |
| `url` | TEXT | ❌ | - | URL da imagem |
| `alt_text` | TEXT | ✅ | - | Texto alternativo |
| `sort_order` | INTEGER | ✅ | `0` | Ordem de exibição |
| `is_primary` | BOOLEAN | ✅ | `false` | Imagem principal? |

---

### 2.6 `product_variants` (Variantes de Produtos)

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

---

### 2.7 `product_categories` (Vínculo Produto ↔ Categoria)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `product_id` | UUID | ❌ | - | **FK** → `products.id` |
| `category_id` | UUID | ❌ | - | **FK** → `categories.id` |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `position` | INTEGER | ✅ | `0` | Posição na categoria |

**Constraints:**
- `(product_id, category_id)` deve ser único

---

### 2.8 `menus` (Menus de Navegação)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `name` | TEXT | ❌ | - | Nome do menu |
| `location` | TEXT | ❌ | `'header'` | `header`, `footer`, `mobile` |

---

### 2.9 `menu_items` (Itens do Menu)

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

**Valores de `item_type`:**
- `category` - Link para categoria (`ref_id` = category.id)
- `page` - Link para página institucional (`ref_id` = store_pages.id)
- `product` - Link para produto (`ref_id` = products.id)
- `external` - Link externo (usar campo `url`)
- `home` - Link para home (não precisa de ref_id)

---

### 2.10 `storefront_page_templates` (Templates de Páginas)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `tenant_id` | UUID | ❌ | - | **FK** → `tenants.id` |
| `page_type` | TEXT | ❌ | - | Tipo da página |
| `published_version` | INTEGER | ✅ | - | Versão publicada |
| `draft_version` | INTEGER | ✅ | - | Versão rascunho |
| `page_overrides` | JSONB | ✅ | `'{}'` | Configurações específicas |

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

### 2.11 `store_page_versions` (Versões de Páginas - Builder)

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

---

### 2.12 `store_pages` (Páginas Institucionais)

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

---

### 2.13 `customers` (Clientes)

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

---

### 2.14 `orders` (Pedidos)

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

**ENUM order_status:**
- `pending`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`

**ENUM payment_status:**
- `pending`, `paid`, `failed`, `refunded`, `cancelled`

**ENUM shipping_status:**
- `pending`, `processing`, `shipped`, `in_transit`, `delivered`, `returned`

---

### 2.15 `order_items` (Itens do Pedido)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | ❌ | `gen_random_uuid()` | **PK** |
| `order_id` | UUID | ❌ | - | **FK** → `orders.id` |
| `product_id` | UUID | ✅ | - | **FK** → `products.id` |
| `sku` | TEXT | ❌ | - | SKU do produto |
| `product_name` | TEXT | ❌ | - | Nome do produto |
| `product_image_url` | TEXT | ✅ | - | URL da imagem |
| `quantity` | INTEGER | ❌ | `1` | Quantidade |
| `unit_price` | NUMERIC | ❌ | - | Preço unitário |
| `discount_amount` | NUMERIC | ❌ | `0` | Desconto aplicado |
| `total_price` | NUMERIC | ❌ | - | Preço total |

---

## 3. Esquemas JSONB Detalhados

### 3.1 `store_settings.shipping_config`

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

### 3.2 `store_settings.benefit_config`

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

### 3.3 `store_settings.offers_config`

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

### 3.4 `store_settings.social_custom`

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

## 4. Sistema de Blocos do Builder

### 4.1 Estrutura Base (BlockNode)

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

### 4.2 Estrutura Raiz de uma Página

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

### 4.3 Blocos Disponíveis

#### LAYOUT

| Tipo | Label | Aceita Filhos | Removível |
|---|---|---|---|
| `Page` | Página | ✅ | ❌ |
| `Section` | Seção | ✅ | ✅ |
| `Container` | Container | ✅ | ✅ |
| `Columns` | Colunas | ✅ (max 4) | ✅ |
| `Divider` | Divisor | ❌ | ✅ |
| `Spacer` | Espaçador | ❌ | ✅ |

#### HEADER/FOOTER

| Tipo | Label | Aceita Filhos | Removível |
|---|---|---|---|
| `Header` | Cabeçalho | ❌ | ❌ |
| `Footer` | Rodapé | ❌ | ❌ |

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

#### E-COMMERCE

| Tipo | Label | Aceita Filhos | Removível |
|---|---|---|---|
| `CategoryList` | Lista de Categorias | ❌ | ✅ |
| `ProductGrid` | Grade de Produtos | ❌ | ✅ |
| `ProductCarousel` | Carrossel de Produtos | ❌ | ✅ |
| `FeaturedProducts` | Produtos Selecionados | ❌ | ✅ |
| `ProductCard` | Card de Produto | ❌ | ✅ |
| `ProductDetails` | Detalhes do Produto | ❌ | ❌ |
| `CartSummary` | Resumo do Carrinho | ❌ | ❌ |
| `CheckoutSteps` | Etapas do Checkout | ❌ | ❌ |
| `CollectionSection` | Categoria/Coleção | ❌ | ✅ |
| `InfoHighlights` | Destaques | ❌ | ✅ |
| `NewsletterSignup` | Newsletter | ❌ | ✅ |
| `VideoSection` | Seção de Vídeo | ❌ | ✅ |

---

### 4.4 Props por Tipo de Bloco

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

## 5. Lógica de Navegação e Slugs

### 5.1 Padrão de URLs

| Entidade | Padrão de URL | Exemplo |
|---|---|---|
| Home | `/` | `/` |
| Categoria | `/collections/{slug}` | `/collections/roupas-femininas` |
| Subcategoria | `/collections/{slug}` | `/collections/vestidos` |
| Produto | `/products/{slug}` | `/products/vestido-floral-azul` |
| Página Institucional | `/{slug}` | `/sobre-nos` |
| Carrinho | `/cart` | `/cart` |
| Checkout | `/checkout` | `/checkout` |
| Obrigado | `/thank-you/{order_number}` | `/thank-you/1001` |
| Conta | `/account` | `/account` |
| Pedidos | `/account/orders` | `/account/orders` |
| Detalhe Pedido | `/account/orders/{order_number}` | `/account/orders/1001` |

### 5.2 Regras de Geração de Slug

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
```

### 5.3 Resolução de Links no Menu

O Frontend resolve `menu_items` assim:

```javascript
function resolveMenuItemUrl(item, categories, pages) {
  switch (item.item_type) {
    case 'home':
      return '/';
    case 'category':
      const cat = categories.find(c => c.id === item.ref_id);
      return cat ? `/collections/${cat.slug}` : '#';
    case 'page':
      const page = pages.find(p => p.id === item.ref_id);
      return page ? `/${page.slug}` : '#';
    case 'product':
      // Busca produto pelo ID (menos comum em menus)
      return `/products/${productSlug}`;
    case 'external':
      return item.url;
    default:
      return '#';
  }
}
```

---

## 6. Guia de Injeção de Dados (Step-by-Step)

### 6.1 Fluxo Completo: Clonar uma Loja

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

#### PASSO 3: Criar Árvore de Categorias

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

#### PASSO 4: Cadastrar Produtos

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
  'published',
  true
);
```

#### PASSO 5: Vincular Produtos a Categorias

```sql
INSERT INTO product_categories (tenant_id, product_id, category_id, position)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'prod-001',
  'cat-002',  -- Categoria "Vestidos"
  1
);
```

#### PASSO 6: Adicionar Imagens do Produto

```sql
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
VALUES 
  ('prod-001', 'https://storage.exemplo.com/vestido-1.jpg', 'Vestido Floral Azul - Frente', 1, true),
  ('prod-001', 'https://storage.exemplo.com/vestido-2.jpg', 'Vestido Floral Azul - Costas', 2, false),
  ('prod-001', 'https://storage.exemplo.com/vestido-3.jpg', 'Vestido Floral Azul - Detalhe', 3, false);
```

#### PASSO 7: Criar Variantes (se aplicável)

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

#### PASSO 8: Criar Menu Principal

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

#### PASSO 9: Criar Templates do Storefront

```sql
-- Inicializar templates (normalmente feito automaticamente)
INSERT INTO storefront_page_templates (tenant_id, page_type)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'home'),
  ('550e8400-e29b-41d4-a716-446655440000', 'category'),
  ('550e8400-e29b-41d4-a716-446655440000', 'product'),
  ('550e8400-e29b-41d4-a716-446655440000', 'cart'),
  ('550e8400-e29b-41d4-a716-446655440000', 'checkout');
```

#### PASSO 10: Gerar e Publicar Conteúdo da Home

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

## 7. Payloads de Exemplo

### 7.1 Payload Completo: Home Page

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
            "linkUrl": "/collections/verao-2024"
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
        "footerTextColor": "#f3f4f6",
        "paymentMethods": {
          "title": "Formas de Pagamento",
          "items": [
            {
              "imageUrl": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCAzMiI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjZTBlMGUwIi8+PHBhdGggZmlsbD0iIzFBMUY3MSIgZD0iTTE5LjcgMjAuNmwtMS4xIDQuOWgtMi4zbDIuNy0xMi4yaDIuNGw0LjIgMTIuMmgtMi40bC0xLTMuOWgtMy41em0zLjEtMS44bC0xLjQtNS41LTEuMiA1LjVoMi42eiIvPjxwYXRoIGZpbGw9IiMxQTFGNzEiIGQ9Ik0xMy4zIDEzLjNoMi4zbC0yLjcgMTIuMmgtMi4zeiIvPjxwYXRoIGZpbGw9IiNGRkE2MDAiIGQ9Ik0zNC43IDEzLjNsLTMuNiA4LjItMS41LTguMmgtMi40bDIuMiAxMS41LjMuNy0yLjIgNS4zaC0yLjRsMy45LTguNyAzLjctNy44aDIuNHoiLz48L3N2Zz4=",
              "alt": "Visa",
              "link": ""
            }
          ]
        }
      }
    }
  ]
}
```

### 7.2 Payload: Produto Completo

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
  "status": "published",
  "is_featured": true,
  "has_variants": true
}
```

### 7.3 Payload: Menu com Submenus

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

### 7.4 Payload: Pedido Completo

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

---

## 📌 Notas Importantes

### Idempotência

Sempre use `ON CONFLICT ... DO UPDATE` para operações de upsert, garantindo que reexecuções não criem duplicatas.

### Ordem de Dependências

**SEMPRE** respeite a ordem de inserção. Tente inserir um produto antes do tenant e você terá erro de FK.

### UUIDs

Prefira gerar UUIDs no lado do cliente/automação para ter controle dos IDs e facilitar referências cruzadas.

```javascript
// JavaScript - gerar UUID v4
const uuid = crypto.randomUUID();
```

### Timestamps

Campos `created_at` e `updated_at` são preenchidos automaticamente. Não é necessário incluí-los nos INSERTs.

### Slugs

Sempre valide a unicidade de slugs por tenant antes de inserir. Use a função de geração de slug descrita na seção 5.2.

### RLS (Row Level Security)

As tabelas possuem RLS ativo. Para operações via N8N, use a **service_role key** do Supabase que bypassa RLS.

---

*Documento gerado em: 2024-12-30*
*Versão: 1.0.0*
