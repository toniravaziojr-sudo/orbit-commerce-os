# Mapeamento de Campos das Plataformas de E-commerce (Brasil)

Este documento detalha todos os campos disponíveis para importação de Clientes, Produtos e Pedidos nas principais plataformas de e-commerce do Brasil.

## Campos de Clientes (Customer Fields)

| Campo Normalizado | Shopify | Tray | Yampi | Bagy | Nuvemshop | Loja Integrada |
|-------------------|---------|------|-------|------|-----------|----------------|
| `email` | Email / E-mail | email / E-mail | email / E-mail | email / E-mail | email / E-mail | email / E-mail |
| `full_name` | First Name + Last Name | name / Nome | name / Nome | name / Nome | name / Nome | nome / Nome |
| `first_name` | First Name | - | first_name | first_name | - | - |
| `last_name` | Last Name | - | last_name | last_name | - | - |
| `phone` | Phone | phone / Telefone | phone / Telefone | phone / Telefone | phone / Telefone | telefone / Telefone |
| `cellphone` | - | cellphone / Celular | - | - | - | celular / Celular |
| `cpf` | - | cpf / CPF | cpf / CPF | cpf / CPF | identification | cpf / CPF |
| `cnpj` | - | cnpj / CNPJ | cnpj / CNPJ | cnpj / CNPJ | identification | cnpj / CNPJ |
| `rg` | - | rg / RG | rg / RG | - | - | - |
| `state_inscription` | - | state_inscription / IE | ie / IE | ie | - | - |
| `company_name` | Company | company_name / Razão Social | company_name | company_name | billing_name | - |
| `person_type` | - | type (1=PF, 2=PJ) | type (PF/PJ) | entity (individual/company) | - | - |
| `birth_date` | - | birth_date / Data de Nascimento | birth_date | birthday | - | data_nascimento |
| `gender` | - | gender / Sexo | gender / Sexo | gender (male/female) | - | sexo / Sexo |
| `accepts_marketing` | Accepts Email Marketing | newsletter | accepts_marketing / Newsletter | newsletter (1/0) | accepts_marketing | aceita_newsletter |
| `accepts_sms` | Accepts SMS Marketing | - | - | - | - | - |
| `status` | - | blocked (0/1) | - | active (1/0) | - | - |
| `tags` | Tags | - | - | - | - | - |
| `notes` | Note | observation / Observação | notes / Observações | note | note | observacoes |
| `total_orders` | Total Orders | - | orders_count | - | - | - |
| `total_spent` | Total Spent | - | total_spent | - | - | - |
| `created_at` | Created At | created_at | created_at | created_at | created_at | criado_em |

### Campos de Endereço do Cliente

| Campo Normalizado | Shopify | Tray | Yampi | Bagy | Nuvemshop | Loja Integrada |
|-------------------|---------|------|-------|------|-----------|----------------|
| `street` | Address1 | address | street | address_street | address | endereco |
| `number` | (em Address1) | number | number | address_number | number | numero |
| `complement` | Address2 | complement | complement | address_detail | floor | complemento |
| `neighborhood` | (em Address2) | neighborhood | neighborhood | address_district | locality | bairro |
| `city` | City | city | city | address_city | city | cidade |
| `state` | Province / Province Code | state | state | address_state | province | estado |
| `postal_code` | Zip | zip_code | zipcode | address_zipcode | zipcode | cep |
| `country` | Country / Country Code | country | country | address_country | country | pais |
| `recipient_name` | - | recipient | receiver | address_receiver | name | destinatario |
| `is_default` | default | - | is_default | - | default | principal |

---

## Campos de Produtos (Product Fields)

| Campo Normalizado | Shopify | Tray | Yampi | Bagy | Nuvemshop | Loja Integrada |
|-------------------|---------|------|-------|------|-----------|----------------|
| `name` | Title | name / Nome | name / Nome | name / Nome | name / Nome | nome / Nome |
| `slug` | Handle | (gerado) | slug / Slug | slug | handle / URL | slug |
| `description` | Body (HTML) | description / Descrição | description | description | description | descricao_completa |
| `short_description` | - | description_small / Descrição Curta | short_description | - | - | descricao |
| `technical_specs` | - | - | specifications | - | - | - |
| `sku` | Variant SKU | reference / Referência | sku / SKU | sku / SKU | Variant.sku / SKU | sku / SKU |
| `barcode` | Variant Barcode | ean / EAN | ean | barcode | Variant.barcode | - |
| `price` | Variant Price | price / Preço | price / Preço | price / Preço | Variant.price / Preço | preco_venda / Preço |
| `compare_at_price` | Variant Compare At Price | promotional_price | price_compare | promotional_price | Variant.promotional_price | preco_promocional |
| `cost_price` | Cost per item | cost_price / Preço de Custo | cost / Custo | cost | Variant.cost | preco_custo |
| `weight` | Variant Grams (g) | weight / Peso (kg) | weight / Peso | weight | Variant.weight | peso |
| `width` | - | width / Largura | width / Largura | width | Variant.width | largura |
| `height` | - | height / Altura | height / Altura | height | Variant.height | altura |
| `depth` | - | length / Comprimento | depth / Profundidade | length | Variant.depth | profundidade |
| `stock_quantity` | Variant Inventory Qty | stock / Estoque | quantity / Estoque | quantity | Variant.stock | estoque |
| `min_stock` | - | minimum_stock | min_quantity | - | - | - |
| `out_of_stock_action` | Continue selling when out of stock | - | out_of_stock_action | - | - | - |
| `status` | Status (active/draft/archived) | available (0/1) / Ativo | is_active / Ativo | is_active | published | ativo |
| `is_featured` | - | hot (0/1) / Destaque | is_featured | is_featured | - | destaque |
| `is_new` | - | release (0/1) / Lançamento | is_new | - | - | - |
| `brand` | Vendor | brand / Marca | brand_id | brand | brand | marca |
| `categories` | Type / Product Category | category_id / Categoria | categories | categories | categories | categorias |
| `tags` | Tags | - | search_terms | - | - | - |
| `seo_title` | SEO Title | - | seo_title / Título SEO | seo_title | seo_title | seo_title |
| `seo_description` | SEO Description | - | seo_description | seo_description | seo_description | seo_description |
| `video_url` | - | - | video_url (YouTube) | - | video_url | - |
| `requires_shipping` | Variant Requires Shipping | virtual_product (0/1) | - | - | requires_shipping | - |
| `is_taxable` | Variant Taxable | - | - | - | - | - |

### Campos de Variante de Produto

| Campo Normalizado | Shopify | Tray | Yampi | Bagy | Nuvemshop | Loja Integrada |
|-------------------|---------|------|-------|------|-----------|----------------|
| `variant_sku` | Variant SKU | Variant.reference | Sku.sku | Variation.sku | Variant.sku | Variacao.sku |
| `variant_price` | Variant Price | Variant.price | Sku.price | Variation.price | Variant.price | Variacao.preco |
| `variant_stock` | Variant Inventory Qty | Variant.stock | Sku.quantity | Variation.quantity | Variant.stock | Variacao.estoque |
| `option1_name` | Option1 Name | Sku.type | Variation.name | Option.name | - | Valor.tipo |
| `option1_value` | Option1 Value | Sku.value | Variation.value | Option.value | Variant.values | Valor.valor |
| `option2_name` | Option2 Name | - | - | - | - | - |
| `option2_value` | Option2 Value | - | - | - | - | - |
| `option3_name` | Option3 Name | - | - | - | - | - |
| `option3_value` | Option3 Value | - | - | - | - | - |

---

## Campos de Pedidos (Order Fields)

| Campo Normalizado | Shopify | Tray | Yampi | Bagy | Nuvemshop | Loja Integrada |
|-------------------|---------|------|-------|------|-----------|----------------|
| `order_number` | Name (#1001) | id / Número | number / Número | number / Número | number / Número | numero / Número |
| `status` | Financial + Fulfillment Status | status / Status | status.alias | status / Status | status | situacao / Situação |
| `payment_status` | Financial Status | status | payment_status | payment_status | payment_status | situacao_pagamento |
| `shipping_status` | Fulfillment Status | delivered (0/1) | shipping_status | shipping_status | shipping_status | situacao_envio |
| `subtotal` | Subtotal | partial_total / Subtotal | value_products | subtotal / Subtotal | subtotal | valor_subtotal |
| `discount_total` | Discount Amount | discount / Desconto | value_discount | discount / Desconto | discount | valor_desconto |
| `shipping_total` | Shipping | shipment_value / Frete | value_shipment | shipping / Frete | shipping | valor_frete |
| `taxes` | Taxes | taxes / Impostos | - | - | - | - |
| `total` | Total | value_1 / Total | value_total | total / Total | total | valor_total |
| `currency` | Currency | (BRL) | (BRL) | (BRL) | currency | (BRL) |
| `payment_method` | Payment Method / Gateway | payment_form / Forma de Pagamento | payment_method | payment_method | gateway | meio_pagamento |
| `payment_date` | Paid at | payment_date / Data Pagamento | paid_at | paid_at | paid_at | pago_em |
| `customer_email` | Email | Customer.email / E-mail | customer.email | customer.email | customer.email | cliente.email |
| `customer_name` | Billing Name | Customer.name / Cliente | customer.name / Cliente | customer.name | customer.name | cliente.nome |
| `customer_phone` | Phone | Customer.cellphone | customer.phone | customer.phone | customer.phone | cliente.celular |
| `coupon_code` | Discount Code | discount_coupon / Cupom | coupon_code | coupon_code | coupon | - |
| `created_at` | Created at | date + hour / Data | created_at / Data | created_at / Data | created_at | criado_em / Data |
| `shipped_at` | Fulfilled at | sending_date / Data Envio | shipped_at | shipped_at | shipped_at | enviado_em |
| `delivered_at` | - | - | delivered_at | delivered_at | - | entregue_em |
| `tracking_code` | Tracking Number | sending_code / Código Rastreio | tracking_code | tracking_code | shipping_tracking_number | codigo_rastreio |
| `tracking_url` | Tracking Url | - | tracking_url | tracking_url | - | - |
| `tracking_carrier` | Tracking Company | shipment_integrator | shipping_service | shipping_company | shipping_carrier_name | transportadora |
| `estimated_delivery` | - | estimated_delivery_date / Previsão | - | - | - | - |
| `notes_customer` | Notes | customer_note / Obs. Cliente | notes | notes | note | observacoes |
| `notes_internal` | - | store_note / Obs. Loja | - | - | - | - |
| `source` | Source | point_sale / Canal | - | - | - | - |
| `marketplace` | - | partner_id / Parceiro | - | - | - | - |
| `risk_level` | Risk Level | - | - | - | - | - |
| `tags` | Tags | - | - | - | - | - |

### Campos de Item do Pedido

| Campo Normalizado | Shopify | Tray | Yampi | Bagy | Nuvemshop | Loja Integrada |
|-------------------|---------|------|-------|------|-----------|----------------|
| `product_name` | Lineitem name | ProductsSold.name | Item.name | Item.name | Product.name | Item.nome |
| `product_sku` | Lineitem sku | ProductsSold.reference | Item.sku | Item.sku | Product.sku | Item.sku |
| `quantity` | Lineitem quantity | ProductsSold.quantity | Item.quantity | Item.quantity | Product.quantity | Item.quantidade |
| `unit_price` | Lineitem price | ProductsSold.price | Item.price | Item.price | Product.price | Item.preco |
| `total_price` | - | (calculado) | Item.total | Item.total | (calculado) | Item.total |
| `compare_at_price` | Lineitem compare at price | - | - | - | - | - |
| `discount` | Lineitem discount | - | - | - | - | - |
| `requires_shipping` | Lineitem requires shipping | virtual_product | - | - | - | - |

### Campos de Endereço de Entrega do Pedido

| Campo Normalizado | Shopify | Tray | Yampi | Bagy | Nuvemshop | Loja Integrada |
|-------------------|---------|------|-------|------|-----------|----------------|
| `shipping_name` | Shipping Name | (Destinatário) | shipping_address.receiver | shipping_address.recipient | shipping_address.name | endereco_entrega.destinatario |
| `shipping_street` | Shipping Address1 | (Endereço) | shipping_address.street | shipping_address.street | shipping_address.address | endereco_entrega.endereco |
| `shipping_number` | (em Address1) | (Número) | shipping_address.number | shipping_address.number | shipping_address.number | endereco_entrega.numero |
| `shipping_complement` | Shipping Address2 | (Complemento) | shipping_address.complement | shipping_address.complement | shipping_address.floor | endereco_entrega.complemento |
| `shipping_neighborhood` | - | (Bairro) | shipping_address.neighborhood | shipping_address.neighborhood | shipping_address.locality | endereco_entrega.bairro |
| `shipping_city` | Shipping City | (Cidade) | shipping_address.city | shipping_address.city | shipping_address.city | endereco_entrega.cidade |
| `shipping_state` | Shipping Province | (Estado) | shipping_address.state | shipping_address.state | shipping_address.province | endereco_entrega.estado |
| `shipping_zip` | Shipping Zip | (CEP) | shipping_address.zipcode | shipping_address.zipcode | shipping_address.zipcode | endereco_entrega.cep |
| `shipping_country` | Shipping Country | - | shipping_address.country | shipping_address.country | shipping_address.country | endereco_entrega.pais |
| `shipping_phone` | Shipping Phone | - | - | - | - | - |

---

## Mapeamento de Status de Pedidos

### Status Geral do Pedido

| Status Normalizado | Shopify | Tray | Yampi | Bagy | Nuvemshop | Loja Integrada |
|-------------------|---------|------|-------|------|-----------|----------------|
| `pending` | pending/authorized | Pendente | pending | pending | open | pendente |
| `paid` | paid | Pago/Aprovado | paid/approved | paid | paid | pago/aprovado |
| `shipped` | fulfilled | Enviado | shipped/transit | shipped | shipped | enviado/transito |
| `delivered` | - | Entregue | delivered/completed | delivered | - | entregue/concluido |
| `cancelled` | voided | Cancelado | cancelled | cancelled | cancelled | cancelado |
| `refunded` | refunded | Reembolsado | refunded | refunded | - | reembolsado/estornado |

### Status de Pagamento

| Status Normalizado | Shopify | Tray | Yampi | Bagy | Nuvemshop | Loja Integrada |
|-------------------|---------|------|-------|------|-----------|----------------|
| `pending` | pending | Aguardando | pending | pending | pending | pendente |
| `paid` | paid | Pago/Aprovado | paid/approved | paid | paid | pago/aprovado/confirmado |
| `failed` | - | Recusado | failed/declined | failed | - | recusado/negado |
| `cancelled` | voided | Cancelado | cancelled | cancelled | cancelled | cancelado |
| `refunded` | refunded | Reembolsado | refunded | refunded | refunded | reembolsado/estornado |

---

## Campos Especiais por Plataforma

### Shopify
- `Gift Card` - Indica se é cartão presente
- `Tax Code` - Código de imposto (Shopify Plus)
- `Employee` - Vendedor (POS)
- `Location` - Localização (POS)

### Tray
- `rg` - RG do cliente
- `reseller` - Se é revendedor
- `credit_limit` - Limite de crédito
- `indicator_id` - ID do indicador
- `profile_customer_id` - ID do perfil
- `ncm` - NCM do produto
- `additional_button` - Botão adicional
- `hot` - Produto em destaque
- `release` - Produto lançamento
- `printed` - Pedido impresso
- `is_traceable` - Se é rastreável
- `id_quotation` - ID da cotação

### Yampi
- `specifications` - Especificações técnicas
- `search_terms` - Termos de pesquisa
- `min_quantity` - Estoque mínimo
- `out_of_stock_action` - Ação quando esgotado
- `video_url` - URL do YouTube

### Bagy
- `entity` - Tipo de pessoa (individual/company)
- `ie` - Inscrição estadual
- `warranty` - Garantia do produto
- `address_receiver` - Nome do destinatário
- `newsletter` - Assinante (1/0)
- `active` - Status ativo (1/0)

### Nuvemshop/Tiendanube
- Suporte a múltiplos idiomas (pt/es/en)
- `free_shipping` - Frete grátis
- `canonical_url` - URL canônica
- `video_url` - URL de vídeo

### Loja Integrada
- Campos em português nativo
- `preco_venda` - Preço de venda
- `preco_custo` - Preço de custo
- `preco_promocional` - Preço promocional
- `criado_em` / `atualizado_em` - Timestamps
- `aceita_newsletter` - Newsletter
