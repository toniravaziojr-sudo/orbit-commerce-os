# Especificação — Link Checkout

> **Módulo:** E-commerce → Link Checkout  
> **Rota:** `/checkout-links`  
> **Sidebar:** E-commerce, abaixo de Produtos, ícone `Link2`  
> **Tabela:** `checkout_links`  
> **Layer:** 3 — Especificação Funcional

---

## Objetivo

Permitir que o lojista crie links personalizados de checkout com produto pré-selecionado, cupom, frete fixo, preço alterado e produtos opcionais adicionais.

---

## Tela: Listagem (`CheckoutLinkList`)

- Tabela com colunas: Nome, Slug, Produto, Status (Ativo/Inativo), Cliques, Conversões, Ações
- Botão "Novo Link" no topo
- Ações por linha: Editar, Copiar Link, Ativar/Desativar, Excluir
- Link copiado segue formato: `https://{domínio}/checkout?link={slug}`

---

## Tela: Formulário (`CheckoutLinkForm`)

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Nome | text | ✅ | Identificação interna do link |
| Slug | text | ✅ | Código único na URL (auto-gerado, editável) |
| Produto principal | select (busca) | ✅ | Produto que será adicionado ao carrinho |
| Quantidade | number | ✅ | Quantidade do produto principal (default: 1) |
| Cupom | text | ❌ | Código de cupom aplicado automaticamente |
| Frete fixo | number | ❌ | Valor de frete sobrescrito (null = calcular normal) |
| Preço final | number | ❌ | Preço sobrescrito do produto (null = preço original) |
| Produtos adicionais | multi-select | ❌ | Array de {product_id, quantity} como opcionais |
| Ativo | toggle | ✅ | Controla se o link está acessível (default: true) |
| Expira em | datetime | ❌ | Data/hora de expiração do link |

### Regras

- Slug deve ser único por tenant
- Slug é gerado automaticamente a partir do nome, mas pode ser editado
- Produtos adicionais são salvos como JSONB

---

## Tabela: `checkout_links`

| Coluna | Tipo | Default | Nota |
|--------|------|---------|------|
| id | uuid | gen_random_uuid() | PK |
| tenant_id | uuid | — | FK tenants, ON DELETE CASCADE |
| name | text | — | NOT NULL |
| slug | text | — | NOT NULL, UNIQUE(tenant_id, slug) |
| product_id | uuid | — | FK products, ON DELETE CASCADE |
| quantity | integer | 1 | — |
| coupon_code | text | null | — |
| shipping_override | numeric | null | — |
| price_override | numeric | null | — |
| additional_products | jsonb | '[]' | Array de {product_id, quantity} |
| is_active | boolean | true | — |
| expires_at | timestamptz | null | — |
| click_count | integer | 0 | — |
| conversion_count | integer | 0 | — |
| created_at | timestamptz | now() | — |
| updated_at | timestamptz | now() | — |

---

## Segurança (RLS)

- Todas as operações (SELECT, INSERT, UPDATE, DELETE) exigem `user_belongs_to_tenant(auth.uid(), tenant_id)`
- Dados são 100% tenant-scoped

---

## Funcionalidades Relacionadas

### Link Direto de Produto

Cada produto ativo possui botão "Copiar Link Checkout" no menu de ações da listagem. Formato: `https://{domínio}/checkout?product={slug}&qty=1`. Não usa a tabela `checkout_links` — é composição de URL no frontend.

### Geração de Imagens com IA

No gerenciador de imagens do produto, após subir a imagem principal, o botão "Gerar com IA" permite criar até 5 imagens secundárias usando a edge function `creative-image-generate`. Estilos disponíveis: Natural, Pessoa Interagindo, Promocional.

---

*Fim da especificação.*
