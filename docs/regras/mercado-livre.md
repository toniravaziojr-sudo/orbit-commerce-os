# Mercado Livre — Regras e Especificações

> **Status:** 🟩 Atualizado  
> **Última atualização:** 2026-02-25

---

## Visão Geral

Integração OAuth com Mercado Livre para sincronização de pedidos, atendimento, gestão de anúncios e métricas.

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/marketplaces/MercadoLivre.tsx` | Dashboard com abas (Conexão, Pedidos, Anúncios, Métricas) |
| `src/pages/MeliOAuthCallback.tsx` | Proxy page para callback OAuth |
| `src/hooks/useMeliConnection.ts` | Status/OAuth com listener de postMessage |
| `src/hooks/useMeliOrders.ts` | Pedidos |
| `src/hooks/useMeliListings.ts` | CRUD + publicação de anúncios (meli_listings) |
| `src/components/marketplaces/MeliListingsTab.tsx` | UI da aba Anúncios (preparar, aprovar, publicar) |
| `src/components/marketplaces/MeliCategoryPicker.tsx` | Seletor de categorias ML com busca e navegação hierárquica |
| `src/components/marketplaces/MeliMetricsTab.tsx` | UI da aba Métricas (KPIs + desempenho) |
| `src/components/marketplaces/MeliConnectionCard.tsx` | Card de conexão OAuth |
| `src/components/marketplaces/MeliOrdersTab.tsx` | Aba de pedidos |
| `supabase/functions/meli-oauth-*` | Fluxo OAuth |
| `supabase/functions/meli-publish-listing/` | Publicação de anúncios na API do ML |
| `supabase/functions/meli-search-categories/` | Busca de categorias ML (predictor + search fallback + children_count) |
| `supabase/functions/meli-generate-description/` | Geração IA de descrição/título para ML (texto plano, sem HTML/links/contato) |
| `supabase/functions/meli-sync-orders/` | Sincronização de pedidos |
| `supabase/functions/meli-sync-questions/` | Sincronização de perguntas → Atendimento |
| `supabase/functions/meli-answer-question/` | Responder perguntas via API ML |
| `supabase/functions/meli-webhook/` | Notificações do ML |

## Fluxo OAuth

```
1. meli-oauth-start → URL de autorização
2. Popup para ML
3. ML redireciona para /integrations/meli/callback (MeliOAuthCallback.tsx)
4. MeliOAuthCallback captura code/state e chama edge function meli-oauth-callback via fetch
5. meli-oauth-callback (edge function) → Troca code por tokens e salva no banco
6. MeliOAuthCallback envia window.opener.postMessage({ type: 'meli_connected' }) para janela principal
7. MeliOAuthCallback fecha o popup automaticamente (window.close())
8. Janela principal recebe postMessage e invalida queries de status
9. meli-token-refresh → Renovação automática
```

### Regra: Popup OAuth (OBRIGATÓRIO)

> O `MeliOAuthCallback.tsx` **NÃO deve redirecionar** o navegador. Deve:
> 1. Capturar `code` e `state` dos query params
> 2. Chamar a edge function `meli-oauth-callback` via fetch
> 3. Enviar resultado via `window.opener.postMessage()`
> 4. Fechar o popup com `window.close()`

## Rota Frontend

- **Path:** `/integrations/meli/callback`
- **Componente:** `MeliOAuthCallback`
- **Registrada em:** `src/App.tsx`

## Regra: Atendimento

> Mensagens do ML vão para módulo **Atendimento** (`channel_type='mercadolivre'`).
> **Proibido:** Manter aba de mensagens no marketplace.

## Fluxo de Anúncios (Listings)

### Pipeline: Preparar → Aprovar → Publicar

```
1. Lojista seleciona produto da loja na aba "Anúncios"
2. Preenche dados específicos do ML (título ≤60 chars, preço, estoque, tipo de anúncio, condição)
3. Anúncio salvo como status 'draft'
4. Lojista revisa e clica "Aprovar" → status 'approved'
5. Lojista clica "Publicar" → edge function meli-publish-listing → API do ML → status 'published'
6. Após publicação: pode pausar, reativar, sincronizar preço/estoque
```

### Edge Function: `meli-publish-listing`

```typescript
POST /meli-publish-listing
{
  "tenantId": "...",
  "listingId": "...",
  "action": "publish" | "pause" | "activate" | "update"  // opcional
}
```

### Ações Suportadas

| Ação | Descrição | API ML |
|------|-----------|--------|
| `publish` (default) | Publica novo anúncio | `POST /items` |
| `pause` | Pausa anúncio ativo | `PUT /items/{id}` status=paused |
| `activate` | Reativa anúncio pausado | `PUT /items/{id}` status=active |
| `update` | Sincroniza preço/estoque | `PUT /items/{id}` + `PUT /items/{id}/description` |

### Regras de Anúncio

- **Título:** Máximo 60 caracteres (limite do ML)
- **Tipos de anúncio:** `gold_special` (Clássico), `gold_pro` (Premium), `free` (Grátis)
- **Condição:** `new` (Novo), `used` (Usado) ou `not_specified`
- **Moeda:** `BRL` (padrão)
- **Imagens:** Máximo 10 (limite do ML), mínimo 1 (obrigatório)
- **Categoria:** `category_id` é **obrigatório** (ex: `MLB1000`). Sem fallback. Navegação hierárquica com `children_count`.
- **Descrição:** Apenas texto plano. Gerada via IA com botão "Gerar para ML" (edge function `meli-generate-description`).
- **Título:** Máximo 60 caracteres. Gerado via IA com botão "Gerar Título ML" (mesma edge function, `generateTitle: true`).
- **Unicidade:** Um produto só pode ter um anúncio ativo (constraint `idx_meli_listings_tenant_product`)

### Campos do Formulário de Anúncio

| Campo | Obrigatório | Descrição |
|-------|:-----------:|-----------|
| Título | ✅ | Máx. 60 chars |
| Descrição | — | Texto plano (HTML removido) |
| Preço (R$) | ✅ | Decimal |
| Quantidade | ✅ | Inteiro ≥ 1 |
| Tipo de anúncio | ✅ | gold_special / gold_pro / free |
| Condição | ✅ | new / used / not_specified |
| Categoria ML | ✅ | Selecionada via `MeliCategoryPicker` (busca + navegação) |
| Marca (BRAND) | — | Atributo ML |
| GTIN / EAN | — | Obrigatório para algumas categorias |
| Garantia | — | Texto livre |
| Frete Grátis | — | Switch (boolean) |
| Retirada no Local | — | Switch (boolean) |

### Componente: `MeliCategoryPicker`

Seletor de categorias do Mercado Livre com duas formas de uso:

1. **Busca por texto:** Digita o nome do produto/categoria → chama `meli-search-categories?q=...` → exibe categorias sugeridas
2. **Navegação hierárquica:** Breadcrumb com categorias raiz → subcategorias → folha

**Props:**

| Prop | Tipo | Descrição |
|------|------|-----------|
| `tenantId` | `string` | ID do tenant para chamadas autenticadas |
| `value` | `string` | `category_id` selecionado |
| `onSelect` | `(id: string, name: string) => void` | Callback ao selecionar |

**Edge Function:** `meli-search-categories`

```
GET ?q=celular           → Busca por texto (category_predictor + fallback search)
GET ?parentId=MLB5672    → Lista subcategorias
GET ?categoryId=MLB1055  → Detalhes de uma categoria
GET (sem params)         → Lista categorias raiz do MLB
```

**Estratégia de busca (em ordem):**
1. `category_predictor` do ML (mais preciso)
2. Filtro de categoria dos resultados de busca (`available_filters`)
3. Extração de categorias únicas dos resultados de busca

### Atributos Enviados Automaticamente

A edge function `meli-publish-listing` monta os atributos a partir do formulário + dados do produto:

| Atributo | Fonte |
|----------|-------|
| `BRAND` | Formulário ou `products.brand` |
| `GTIN` | Formulário |
| `SELLER_SKU` | `products.sku` |
| `PACKAGE_WEIGHT` | `products.weight` |
| `PACKAGE_WIDTH` | `products.width` |
| `PACKAGE_HEIGHT` | `products.height` |
| `PACKAGE_LENGTH` | `products.depth` |

### Status do Anúncio

| Status | Descrição | Ações Disponíveis |
|--------|-----------|-------------------|
| `draft` | Rascunho | Editar, Aprovar, Excluir |
| `ready` | Pronto para aprovação | Editar, Aprovar, Excluir |
| `approved` | Aprovado, aguardando publicação | Editar, Publicar, Excluir |
| `publishing` | Em processo de envio ao ML | — |
| `published` | Publicado no ML | Ver no ML, Sincronizar preço/estoque, Pausar |
| `paused` | Pausado no ML | Reativar |
| `error` | Erro na publicação | Editar, Retentar publicação, Excluir |

### Regra: Edição de Anúncios (OBRIGATÓRIO)

> O botão de edição (✏️) DEVE estar disponível em **todos os status pré-publicação**: `draft`, `ready`, `approved` e `error`.
> Anúncios com status `published`, `publishing` ou `paused` NÃO podem ser editados localmente (apenas via sync/update na API ML).

### Regra: Auto-Refresh de Token (OBRIGATÓRIO)

> A edge function `meli-publish-listing` DEVE tentar renovar o token automaticamente via `meli-token-refresh` quando detectar que o `expires_at` já passou, ANTES de retornar erro ao usuário. Só retorna `token_expired` se o refresh falhar.

## Tabela: marketplace_connections

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tenant_id` | UUID | FK |
| `marketplace` | TEXT | `mercadolivre` |
| `access_token` | TEXT | Token atual |
| `refresh_token` | TEXT | Renovação |
| `external_user_id` | TEXT | ID ML |
| `is_active` | BOOLEAN | Status |

## Tabela: meli_listings

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `product_id` | UUID | FK products |
| `status` | TEXT | draft/ready/approved/publishing/published/paused/error |
| `meli_item_id` | TEXT | ID do anúncio no ML (após publicação) |
| `title` | TEXT | Título do anúncio (≤60 chars) |
| `description` | TEXT | Descrição HTML |
| `price` | NUMERIC | Preço no ML |
| `available_quantity` | INT | Estoque disponível |
| `category_id` | TEXT | Categoria ML |
| `listing_type` | TEXT | gold_special/gold_pro/gold/free |
| `condition` | TEXT | new/used |
| `currency_id` | TEXT | BRL |
| `images` | JSONB | Array de URLs |
| `attributes` | JSONB | Atributos ML |
| `shipping` | JSONB | Config de frete ML |
| `meli_response` | JSONB | Resposta da API ML |
| `error_message` | TEXT | Mensagem de erro |
| `published_at` | TIMESTAMPTZ | Data de publicação |

### RLS: meli_listings

- SELECT/INSERT/UPDATE/DELETE: `user_has_tenant_access(tenant_id)`

## Aba Métricas

Busca dados diretamente da API do ML (não armazena localmente):

| Métrica | Endpoint ML |
|---------|-------------|
| Anúncios ativos | `GET /users/{seller_id}/items/search` |
| Detalhes dos itens | `GET /items?ids=...&attributes=...` |
| Visitas (30 dias) | `GET /items/{id}/visits/time_window` |

### KPIs exibidos

- Anúncios ativos / total
- Visitas (últimos 30 dias)
- Unidades vendidas
- Faturamento estimado

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Manter aba de mensagens no marketplace | Mensagens vão para Atendimento |
| Publicar sem aprovação | Fluxo: draft → approved → published |
| Hardcodar categoria ML | Usar `category_id` configurável |
| Ignorar erro da API ML | Salvar `error_message` e `meli_response` |

## Checklist

- [x] OAuth com popup + postMessage
- [x] Sincronização de pedidos
- [x] Sincronização de perguntas → Atendimento
- [x] Responder perguntas via API
- [x] CRUD de anúncios (preparar, aprovar)
- [x] Publicação de anúncios via API ML
- [x] Pausar/reativar anúncios
- [x] Sincronizar preço/estoque
- [x] Aba de métricas (visitas, vendas, faturamento)
- [x] Busca de categorias ML (category picker com busca + navegação + children_count)
- [x] Geração IA de descrição para ML (texto plano, sem HTML/links)
- [x] Geração IA de título otimizado para ML (máx 60 chars)
- [ ] Webhook de notificações de pedidos (real-time)
