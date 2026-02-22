# Avaliações — Regras e Especificações

> **Status:** CONCLUÍDO E PROTEGIDO ✅ — Qualquer alteração estrutural requer aprovação do usuário.

## Visão Geral

O módulo de Avaliações permite gerenciar avaliações de produtos enviadas por clientes, com fluxo de aprovação e suporte a mídias (imagens/vídeos).

---

## Arquitetura de Componentes

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| **Página Admin** | `src/pages/Reviews.tsx` | Gerenciamento e moderação de avaliações |
| **Seção Pública** | `src/components/storefront/sections/ProductReviewsSection.tsx` | Exibição de avaliações aprovadas na página do produto |
| **Formulário Público** | `src/components/storefront/sections/ReviewForm.tsx` | Formulário para clientes enviarem avaliações |
| **Dialog Cadastro Manual** | `src/components/reviews/AddReviewDialog.tsx` | Cadastro manual de avaliações pelo admin |
| **Dialog Geração IA** | `src/components/reviews/GenerateReviewsDialog.tsx` | Geração de avaliações com IA (com filtros de gênero e notas) |
| **Upload de Mídias** | `src/components/reviews/ReviewMediaUploader.tsx` | Componente de upload de imagens/vídeos |
| **Bloco do Builder** | `src/components/builder/blocks/ReviewsBlock.tsx` | Bloco de avaliações para templates |
| **Hooks de Rating** | `src/hooks/useProductRating.ts` | Hooks para buscar média e contagem de estrelas |
| **Registro no Drive** | `src/lib/registerReviewMediaToDrive.ts` | Registra mídias aprovadas na pasta "Review clientes" |
| **Edge Function** | `supabase/functions/generate-reviews/index.ts` | Geração de avaliações via IA (Lovable AI) |

---

## Gerador de Avaliações com IA

O dialog `GenerateReviewsDialog.tsx` permite gerar avaliações automaticamente usando IA.

### Opções Disponíveis

| Opção | Valores | Descrição |
|-------|---------|-----------|
| **Produto** | Dropdown | Seleciona o produto (apenas `status: active`) |
| **Quantidade** | 5-50 | Número de avaliações a gerar |
| **Gênero dos Nomes** | `both`, `male`, `female` | Filtra os nomes gerados por gênero |
| **Distribuição de Notas** | `all5`, `mixed` | `all5` = todas 5 estrelas, `mixed` = 4-5 estrelas |

### Parâmetros da Edge Function `generate-reviews`

```typescript
interface RequestBody {
  product: {
    name: string;
    description?: string;
    price?: number;
    sku?: string;
  };
  quantity: number;           // 5-50 (default: 10)
  gender?: 'both' | 'male' | 'female';  // default: 'both'
  ratingDistribution?: 'all5' | 'mixed'; // default: 'mixed'
}
```

### Resposta

```typescript
interface Response {
  success: boolean;
  reviews?: Array<{
    customer_name: string;
    rating: number;
    title: string;
    content: string;
  }>;
  error?: string;
}
```

---

## Banco de Dados: `product_reviews`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `product_id` | UUID (FK) | Produto avaliado |
| `tenant_id` | UUID (FK) | Tenant da avaliação |
| `customer_name` | TEXT | Nome do cliente |
| `customer_email` | TEXT | Email do cliente |
| `rating` | INTEGER (1-5) | Nota em estrelas |
| `title` | TEXT | Título da avaliação |
| `content` | TEXT | Conteúdo/texto da avaliação |
| `status` | ENUM | `pending`, `approved`, `rejected` |
| `is_verified_purchase` | BOOLEAN | Se é compra verificada |
| `media_urls` | TEXT[] | URLs das mídias anexadas |
| `approved_at` | TIMESTAMP | Data de aprovação |
| `approved_by` | UUID (FK) | Usuário que aprovou |
| `created_at` | TIMESTAMP | Data de criação |

---

## Storage

| Item | Valor |
|------|-------|
| **Bucket** | `review-media` |
| **Tipos aceitos** | JPG, PNG, GIF, WebP, MP4, WebM |
| **Tamanho máximo** | 10MB por arquivo |
| **Máximo de arquivos** | 5 por avaliação |

---

## Fluxo de Aprovação (REGRA CRÍTICA)

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Cliente envia avaliação (com ou sem mídia)                      │
│     → status = 'pending'                                            │
│     → NÃO aparece na loja pública                                   │
│     → Mídia fica no bucket, NÃO vai para o Drive                    │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  2. Admin acessa /reviews e aprova a avaliação                      │
│     → status = 'approved'                                           │
│     → approved_at = now()                                           │
│     → approved_by = user.id                                         │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  3. Após aprovação:                                                 │
│     → Avaliação APARECE na página pública do produto                │
│     → Mídias são registradas na pasta "Review clientes" do Drive    │
│     → Queries públicas invalidadas (react-query)                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Painel Admin (`/reviews`)

| Funcionalidade | Descrição |
|----------------|-----------|
| **Estatísticas** | Cards com Total, Pendentes, Aprovadas, Rejeitadas |
| **Abas** | Pendentes, Aprovadas, Rejeitadas, Todas |
| **Busca** | Por nome, conteúdo ou produto |
| **Filtro por produto** | Dropdown com todos os produtos |
| **Coluna Mídia** | Thumbnails clicáveis com lightbox |
| **Ações individuais** | Aprovar, Rejeitar, Excluir (menu dropdown por linha) |
| **Ações em massa** | Checkbox por linha + "Selecionar todos" no cabeçalho. Barra de ações exibida ao selecionar: Aprovar, Rejeitar, Excluir em lote. Seleção limpa ao trocar aba/filtro/busca. Mídias registradas no Drive ao aprovar em massa. |

---

## Página Pública do Produto

| Funcionalidade | Descrição |
|----------------|-----------|
| **Resumo com barras** | Card com nota média grande + barras de distribuição por estrela (5→1) |
| **Média de estrelas** | Estrelas com preenchimento parcial proporcional à nota |
| **Lista de avaliações** | Cards com `rounded-xl`, hover shadow, somente `status = 'approved'` |
| **Carregar mais** | Botão "Ver mais avaliações" carrega 5 por vez (até 50 total) |
| **Badge verificada** | Ícone CheckCircle verde ao lado do nome/data |
| **Mídias** | Thumbnails clicáveis com lightbox |
| **Formulário** | Permite cliente enviar nova avaliação |
| **Empty state** | Borda dashed com fundo suave quando sem avaliações |

---

## Regras de Visibilidade (OBRIGATÓRIO)

| Contexto | Query obrigatória |
|----------|-------------------|
| **Storefront Público** | `.eq('status', 'approved')` |
| **Admin** | Todas as avaliações (com filtro por status) |

---

## Integração com Meu Drive

| Regra | Descrição |
|-------|-----------|
| **Pasta** | "Review clientes" dentro de "Uploads do sistema" |
| **Criação automática** | Pasta criada automaticamente ao acessar `/reviews` |
| **Registro de mídias** | Somente após aprovação da avaliação |
| **Metadata** | `source: 'review'`, `review_id`, `customer_name` |

---

## Bloco ReviewsBlock (Builder)

| Comportamento | Descrição |
|---------------|-----------|
| **No Editor** (`isEditing=true`) | Exibe dados demo como fallback |
| **No Storefront** (`isEditing=false`) | Exibe apenas dados reais; se vazio, retorna `null` |
| **Indicador demo** | Mensagem "[Exemplo demonstrativo]" no editor |

---

## Link de Avaliação Pós-Venda

O sistema permite enviar links de avaliação para clientes após a compra via notificações.

### Variáveis Disponíveis

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{review_link}}` | Link único para avaliar todos os produtos do pedido | `https://loja.com/avaliar/abc123xyz` |
| `{{products_review_links}}` | Links individuais por produto | `Camiseta: https://...\nCalça: https://...` |

### Tabela `review_tokens`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `tenant_id` | UUID (FK) | Tenant do token |
| `order_id` | UUID (FK) | Pedido relacionado |
| `customer_id` | UUID (FK) | Cliente (opcional) |
| `customer_email` | TEXT | Email do cliente |
| `token` | TEXT | Token único e seguro |
| `expires_at` | TIMESTAMP | Expiração (30 dias) |
| `used_at` | TIMESTAMP | Data de uso (null = não usado) |
| `created_at` | TIMESTAMP | Data de criação |

### Funções do Banco

| Função | Descrição |
|--------|-----------|
| `generate_review_token(...)` | Gera token seguro para um pedido |
| `validate_review_token(p_token)` | Valida token e retorna dados do pedido |

### Página Dedicada de Avaliação

| Item | Valor |
|------|-------|
| **Rota** | `/avaliar/:token` |
| **Componente** | `src/pages/storefront/StorefrontReview.tsx` |
| **Funcionalidades** | Lista produtos do pedido, formulário de avaliação, badge "Compra verificada" |

### Fluxo de Avaliação via Link

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Pedido é pago/entregue                                          │
│     → Edge Function gera token via generate_review_token()          │
│     → Variáveis {{review_link}} e {{products_review_links}}         │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  2. Notificação enviada com link de avaliação                       │
│     → Cliente recebe WhatsApp/Email com link                        │
│     → Token válido por 30 dias                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  3. Cliente acessa /avaliar/:token                                  │
│     → Token validado via validate_review_token()                    │
│     → Exibe produtos do pedido para avaliar                         │
│     → Avaliação salva com is_verified_purchase = true               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `src/pages/Reviews.tsx` | Este documento |
| `src/components/reviews/*` | Este documento |
| `src/components/storefront/sections/ProductReviewsSection.tsx` | Este documento |
| `src/components/storefront/sections/ReviewForm.tsx` | Este documento |
| `src/components/builder/blocks/ReviewsBlock.tsx` | Este documento |
| `src/hooks/useProductRating.ts` | Este documento |
| `src/pages/storefront/StorefrontReview.tsx` | Este documento |
| `src/components/notifications/MessageEditor.tsx` | Este documento (variáveis) |
| `supabase/functions/process-events/index.ts` | Este documento (geração de links) |
