# Mercado Livre — Regras e Especificações

> **Status:** 🟩 Atualizado  
> **Última atualização:** 2026-02-25

---

## Visão Geral

Integração OAuth com Mercado Livre para sincronização de pedidos, atendimento, gestão de anúncios e métricas.

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/marketplaces/MercadoLivre.tsx` | Dashboard com abas (Conexão, Pedidos, Anúncios, Métricas) — aba Conexão exibe botão "Ir para Integrações" quando desconectado |
| `supabase/functions/meli-bulk-operations/` | Operações em massa (enviar produtos, gerar títulos/descrições, auto-categorizar) |
| `src/pages/MeliOAuthCallback.tsx` | Proxy page para callback OAuth |
| `src/hooks/useMeliConnection.ts` | Status/OAuth com listener de postMessage |
| `src/hooks/useMeliOrders.ts` | Pedidos |
| `src/hooks/useMeliListings.ts` | CRUD + publicação + criação em massa (`createBulkListings`) |
| `src/components/marketplaces/MeliListingsTab.tsx` | UI da aba Anúncios (lista + ações em massa + creator/wizard) |
| `src/components/marketplaces/MeliListingCreator.tsx` | Dialog multi-produto de 3 etapas para criação em massa com IA |
| `src/components/marketplaces/MeliListingWizard.tsx` | Wizard para edição individual de anúncios |
| `src/components/marketplaces/MeliCategoryPicker.tsx` | Seletor de categorias ML com busca, navegação hierárquica e auto-suggest |
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
1. Usuário acessa Integrações → aba Marketplaces
2. Clica "Conectar" no card do Mercado Livre (inicia OAuth direto, sem redirecionar)
3. meli-oauth-start → URL de autorização
4. Popup abre para ML
5. ML redireciona para /integrations/meli/callback (MeliOAuthCallback.tsx)
6. MeliOAuthCallback captura code/state e chama edge function meli-oauth-callback via fetch
7. meli-oauth-callback (edge function) → Troca code por tokens e salva no banco
8. MeliOAuthCallback envia window.opener.postMessage({ type: 'meli_connected' }) para janela principal
9. MeliOAuthCallback fecha o popup automaticamente (window.close())
10. Janela principal recebe postMessage e invalida queries de status
11. meli-token-refresh → Renovação automática
```

### Regra: Local de Conexão (OBRIGATÓRIO)

> A conexão OAuth com o Mercado Livre **DEVE acontecer em `/integrations` (aba Marketplaces)**.
> O módulo `/marketplaces/mercadolivre` é para **gestão** (pedidos, anúncios, métricas).
> Se o usuário acessar `/marketplaces/mercadolivre` sem conexão ativa, a aba "Conexão" é exibida com um **botão que direciona para `/integrations?tab=marketplaces`** (NÃO redirecionar automaticamente).
> O callback OAuth (fallback sem popup) redireciona para `/integrations?tab=marketplaces`.

### Regra: Popup OAuth (OBRIGATÓRIO)

> O `MeliOAuthCallback.tsx` **NÃO deve redirecionar** o navegador. Deve:
> 1. Capturar `code` e `state` dos query params
> 2. Chamar a edge function `meli-oauth-callback` via fetch
> 3. Enviar resultado via `window.opener.postMessage()`
> 4. Fechar o popup com `window.close()`

### Regra: Desconectar/Reconectar (OBRIGATÓRIO)

> Botões de **Reconectar** e **Desconectar** ficam no card do Mercado Livre em `/integrations` (aba Marketplaces).
> - **Reconectar**: Inicia novo fluxo OAuth para renovar tokens
> - **Desconectar**: Remove a conexão (com confirmação via AlertDialog)
> - **Token expirado**: Exibe alerta com botão de reconexão

## Rota Frontend

- **Path:** `/integrations/meli/callback`
- **Componente:** `MeliOAuthCallback`
- **Registrada em:** `src/App.tsx`

## Regra: Atendimento

> Mensagens do ML vão para módulo **Atendimento** (`channel_type='mercadolivre'`).
> **Proibido:** Manter aba de mensagens no marketplace.

## Fluxo de Anúncios (Listings)

### Pipeline: Criar em Massa → Aprovar → Publicar

```
1. Lojista clica "Novo Anúncio" → abre MeliListingCreator (dialog multi-produto)
2. Creator Etapa 1: Seleciona um ou vários produtos com checkboxes (busca, selecionar todos)
3. Creator Etapa 2: Define configurações padrão (tipo de anúncio, condição, frete) + toggles de IA
4. Creator Etapa 3: Cria rascunhos no banco + processa IA se ativada (progresso visual)
5. Rascunhos aparecem na tabela → lojista edita individualmente se necessário (MeliListingWizard modo edit)
6. Lojista revisa e clica "Aprovar" → status 'approved'
7. Lojista clica "Publicar" → edge function meli-publish-listing → API do ML → status 'published'
8. Após publicação: pode pausar, reativar, sincronizar preço/estoque
```

### Creator Multi-Produto (MeliListingCreator)

Dialog de 3 etapas para criação em massa de anúncios:

| Etapa | Nome | Descrição |
|-------|------|-----------|
| 1 | Selecionar Produtos | Checkboxes com busca por nome/SKU, selecionar todos, badge de contagem |
| 2 | Configurações Padrão | Tipo de anúncio, condição, frete + toggles IA (títulos, descrições, categorias) |
| 3 | Processamento | Cria rascunhos + executa IA (se ativada), barra de progresso com ETA |

**Props:**

| Prop | Tipo | Descrição |
|------|------|-----------|
| `open` | `boolean` | Controle de visibilidade |
| `onOpenChange` | `(open: boolean) => void` | Callback de toggle |
| `products` | `ProductWithImage[]` | Lista de produtos disponíveis |
| `listedProductIds` | `Set<string>` | IDs de produtos que já possuem anúncio |
| `onBulkCreate` | `(data) => Promise<any>` | Mutation de criação em massa |
| `onRefetch` | `() => void` | Callback para recarregar a tabela |

**Fluxo de Execução:**
1. Cria `meli_listings` com status `draft` via `createBulkListings` (insere múltiplos de uma vez)
2. Se IA ativada, chama `meli-bulk-operations` com `listingIds` para gerar títulos, descrições e categorias
3. Progresso visual com `ProgressWithETA`
4. Ao finalizar, fecha dialog e tabela mostra os novos rascunhos

### Wizard de Edição (MeliListingWizard)

Mantido **apenas para modo `edit`** — edição individual de um anúncio existente na tabela (botão ✏️).

Componente guiado de 3 etapas para criação/edição de anúncios:

| Etapa | Nome | Descrição |
|-------|------|-----------|
| 1 | Selecionar Produto | Dropdown com produtos ativos da loja |
| 2 | Preenchimento Inteligente | IA gera título (≤60 chars), descrição (texto plano) e categoria automaticamente |
| 3 | Revisar e Ajustar | Formulário completo com todos os campos do anúncio |

**Regra: Auto-fill IA (Etapa 2)**
> Ao selecionar um produto, o wizard dispara 3 chamadas sequenciais:
> 1. `meli-generate-description` com `generateTitle: true` → título otimizado
> 2. `meli-generate-description` → descrição texto plano
> 3. `meli-bulk-operations` com `action: "auto_suggest_category"` → categoria via ML predictor
>
> Cada etapa tem indicador visual de progresso e botão "Regenerar" individual.

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
| `value` | `string` | `category_id` selecionado |
| `onChange` | `(categoryId: string, categoryName?: string) => void` | Callback ao selecionar |
| `selectedName` | `string` | Nome da categoria selecionada (para exibição) |
| `productName` | `string` | Nome do produto (habilita botão "Auto") |

**Botão "Auto" (Wand2):**
> Quando `productName` é fornecido, exibe botão "Auto" que chama `meli-bulk-operations` com `action: "auto_suggest_category"`.
> Utiliza o `category_predictor` da API do ML como método primário.
> **Fallback:** Se o predictor falhar, busca via Search API (`/sites/MLB/search`) e extrai a categoria mais relevante dos filtros de resultado.
> Em caso de falha total, exibe toast de erro e abre o browser de categorias para seleção manual.

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

## Operações em Massa (Bulk Actions)

Edge function `meli-bulk-operations` processa em chunks de 5 itens:

| Ação | Descrição |
|------|-----------|
| `bulk_create` | Cria rascunhos para todos os produtos ativos sem anúncio ML |
| `bulk_generate_titles` | Gera títulos otimizados via Gemini 2.5 Flash (≤60 chars) |
| `bulk_generate_descriptions` | Converte descrições HTML para texto plano via IA |
| `bulk_auto_categories` | Categoriza em massa via ML category_predictor + fallback Search API |
| `auto_suggest_category` | Categorização individual de produto (usado pelo botão "Auto" e pelo Wizard) |

### Seleção em Massa (OBRIGATÓRIO)

> A tabela de anúncios possui **checkboxes** para seleção individual e em massa:
> - **Checkbox no header:** Seleciona/deseleciona todos os anúncios
> - **Checkbox por linha:** Seleção individual com highlight visual (`bg-muted/50`)
> - **Badge de contagem:** Exibe "X selecionado(s)" na barra de ações em massa quando há seleção
> - **Ações operam nos selecionados:** Quando há seleção, as ações em massa enviam `listingIds` (array de IDs) no body da edge function. Quando não há seleção, operam em todos.
> - **Excluir Selecionados:** Botão vermelho (destructive) aparece apenas quando há seleção. Filtra automaticamente anúncios `published`/`publishing` (que não podem ser excluídos). Confirma antes de executar e limpa seleção após conclusão.
> - **Limpeza automática:** A seleção é resetada após executar uma ação em massa.
>
> **Body da edge function com seleção:**
> ```json
> { "tenantId": "...", "action": "...", "offset": 0, "limit": 5, "listingIds": ["id1", "id2"] }
> ```

**Regra: Fallback de Categorização**
> O `auto_suggest_category` tenta primeiro o `category_predictor` do ML.
> Se falhar (status != 200 ou sem resultados), usa a Search API (`/sites/MLB/search?q=...`) e extrai categorias dos `available_filters`.
> Resolve o path completo da categoria via `/categories/{id}` para exibição ao usuário.

## Regra: Aba de Pedidos — Auto-Refresh (OBRIGATÓRIO)

> A aba de pedidos (`MeliOrdersTab`) **NÃO deve ter botões manuais** de "Atualizar" ou "Sincronizar".
> Os dados são recarregados automaticamente via `refetchOnWindowFocus: true` e `staleTime: 30_000` no hook `useMeliOrders`.
> Durante o carregamento, exibe apenas um badge "Atualizando..." com `animate-pulse`.
> A sincronização com a API do ML ocorre via webhook/cron, não via ação manual do usuário.

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Manter aba de mensagens no marketplace | Mensagens vão para Atendimento |
| Publicar sem aprovação | Fluxo: draft → approved → published |
| Hardcodar categoria ML | Usar `category_id` configurável |
| Ignorar erro da API ML | Salvar `error_message` e `meli_response` |
| Criar anúncio sem creator | Usar MeliListingCreator para criação (multi-produto) |
| Usar MeliListingWizard para criar | MeliListingWizard é apenas para edição individual |
| Botões manuais de refresh/sync na aba Pedidos | Auto-refresh via `refetchOnWindowFocus` |

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
- [x] Operações em massa (enviar todos, gerar títulos/descrições, auto-categorizar)
- [x] Auto-suggest de categoria via category_predictor no formulário individual
- [ ] Webhook de notificações de pedidos (real-time)
