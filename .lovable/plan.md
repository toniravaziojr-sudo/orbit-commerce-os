

# Plano: Link Checkout de Produto + Geração de Imagens IA + Módulo Link Checkout

## Contexto

O sistema não possui link direto de checkout por produto, não tem geração de imagens secundárias por IA no cadastro de produto, e não existe o módulo "Link Checkout" para criação de links personalizados.

---

## Implementação 1 — Link Direto para Checkout no Produto

**O que faz**: Cada produto ativo terá um link copiável que leva direto ao checkout da loja com aquele produto no carrinho.

**Como funciona**:
- Na listagem de produtos e no formulário de edição, exibir um botão "Copiar Link de Checkout"
- O link será montado no formato: `https://{domínio-da-loja}/checkout?product={product_slug}&qty=1`
- Sem tabela nova — é apenas uma composição de URL no frontend usando o slug do produto e o domínio do tenant

**Arquivos impactados**:
- `src/components/products/ProductList.tsx` — botão na linha da tabela
- `src/components/products/ProductForm.tsx` — seção com link copiável na aba de dados

---

## Implementação 2 — Geração de Imagens Secundárias com IA

**O que faz**: Após o usuário subir a imagem principal do produto, aparece um botão "Gerar imagens com IA" que cria até 5 imagens secundárias automaticamente usando a imagem principal como referência.

**Capacidade**: A edge function `creative-image-generate` já suporta geração individual com referência. Para gerar múltiplas, faremos chamadas sequenciais (até 5). O pipeline existente (fal.ai → Gemini → OpenAI → Lovable Gateway) será reutilizado integralmente.

**Limite prático**: Cada geração leva ~10-30s. Gerar 5 em paralelo pode estourar timeout da edge function (máximo ~300s). Recomendo permitir até 3 em paralelo para segurança, e até 5 em modo sequencial. O usuário escolhe de 1 a 5.

**Como funciona**:
- No `ProductImageManager`, quando existe pelo menos 1 imagem (a principal), exibir botão "Gerar imagens com IA"
- Ao clicar, abre um dialog com: seletor de quantidade (1-5), seletor de estilo (Natural, Pessoa Interagindo, Promocional) — reusa os estilos existentes
- Chama a edge function `creative-image-generate` N vezes (ou cria uma nova rota batch)
- Imagens geradas são automaticamente salvas como imagens secundárias do produto

**Arquivos novos/impactados**:
- `src/components/products/AIImageGeneratorDialog.tsx` — dialog com opções
- `src/components/products/ProductImageManager.tsx` — adicionar botão que abre o dialog
- Possível nova edge function `product-ai-images-generate` (wrapper batch) ou reutilizar a existente com chamadas paralelas do frontend

---

## Implementação 3 — Módulo Link Checkout

**O que faz**: Novo módulo no sidebar (abaixo de "Produtos" no grupo E-commerce) onde o usuário cria links personalizados de checkout com produto, cupom, frete e preço alterado.

### Tabela nova: `checkout_links`

```text
id              uuid PK
tenant_id       uuid FK tenants
name            text (nome do link para identificação)
slug            text UNIQUE (código do link, ex: "promo-verao")
product_id      uuid FK products (produto principal)
quantity        integer default 1
coupon_code     text nullable
shipping_override numeric nullable (valor de frete fixo, null = calcular)
price_override  numeric nullable (preço final diferente)
additional_products jsonb nullable (array de {product_id, quantity})
is_active       boolean default true
expires_at      timestamptz nullable
click_count     integer default 0
conversion_count integer default 0
created_at      timestamptz
updated_at      timestamptz
```

### Sidebar
- Adicionar "Link Checkout" no grupo E-commerce, após "Produtos", com ícone `Link2`

### Página e componentes
- `src/pages/CheckoutLinks.tsx` — página principal (listagem + criação)
- `src/components/checkout-links/CheckoutLinkList.tsx` — tabela com links criados
- `src/components/checkout-links/CheckoutLinkForm.tsx` — formulário de criação/edição
  - Seletor de produto (com busca)
  - Campo de cupom
  - Toggle de frete (calcular normal ou valor fixo)
  - Campo de preço final alternativo
  - Seção de produtos opcionais adicionais

### Rota
- `/checkout-links` no App.tsx

### RLS
- Policies tenant-scoped para SELECT, INSERT, UPDATE, DELETE

---

## Documentação

- Atualizar `docs/REGRAS-DO-SISTEMA.md` com seção sobre Link Checkout
- Atualizar sidebar navigation no mapa de UI

## Validação Técnica

- Consultar banco para confirmar tabela criada
- Testar criação de link via interface
- Testar geração de imagens IA com 1 e 3 imagens
- Verificar link de checkout direto do produto

---

## Resumo de Impacto

| Item | Quantidade |
|------|-----------|
| Tabela nova | 1 (`checkout_links`) |
| Páginas novas | 1 (`CheckoutLinks`) |
| Componentes novos | ~4 |
| Componentes editados | ~3 |
| Edge functions | 0-1 (reuso ou wrapper) |
| Migration SQL | 1 |
| Docs atualizados | 1-2 |

