# Mercado Livre — Regras e Especificações

> **Status:** 🟩 Atualizado  
> **Última atualização:** 2026-03-01 (v2.1.0: melhoria na geração de títulos IA — validação mínima 60%, modelo Pro, coverage relaxado)

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
| `src/hooks/useMeliListings.ts` | CRUD + publicação + criação em massa (`createBulkListings`) + sincronização (`syncListings`) |
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
| `supabase/functions/meli-generate-description/` | Geração IA de descrição/título para ML via ai-router (texto plano, sem HTML/links/contato) |
| `supabase/functions/meli-sync-orders/` | Sincronização de pedidos |
| `supabase/functions/meli-sync-questions/` | Sincronização de perguntas → Atendimento |
| `supabase/functions/meli-answer-question/` | Responder perguntas via API ML |
| `supabase/functions/meli-webhook/` | Notificações do ML |
| `supabase/functions/meli-sync-listings/` | Sincronização de status dos anúncios com o ML (detecta excluídos/pausados/encerrados) |

## Fluxo OAuth

```
1. Usuário acessa Integrações → aba Marketplaces
2. Clica "Conectar" no card do Mercado Livre (inicia OAuth direto, sem redirecionar)
3. meli-oauth-start → URL de autorização
4. Popup abre para ML
5. ML redireciona para /integrations/meli/callback (MeliOAuthCallback.tsx)
6. MeliOAuthCallback captura code/state e chama edge function meli-oauth-callback via POST (JSON)
7. meli-oauth-callback (edge function) → Troca code por tokens e salva no banco → retorna JSON
8. MeliOAuthCallback envia window.opener.postMessage({ type: 'meli_connected' }) para janela principal
9. MeliOAuthCallback fecha o popup automaticamente (window.close())
10. Janela principal recebe postMessage e invalida queries de status
11. meli-token-refresh → Renovação automática
```

### Regra: Local de Conexão (OBRIGATÓRIO)

> A conexão OAuth com o Mercado Livre **DEVE acontecer em `/integrations` (aba Marketplaces)**.
> O módulo `/marketplaces/mercadolivre` é para **gestão** (pedidos, anúncios, métricas).
> Se o usuário acessar `/marketplaces/mercadolivre` sem conexão ativa, a aba "Conexão" é exibida com um **botão que direciona para `/integrations?tab=marketplaces`** (NÃO redirecionar automaticamente).
> O callback OAuth (fallback GET sem popup) redireciona para `/integrations?tab=marketplaces`.

### Regra: Popup OAuth (OBRIGATÓRIO)

> O `MeliOAuthCallback.tsx` **NÃO deve redirecionar** o navegador. Deve:
> 1. Capturar `code` e `state` dos query params
> 2. Chamar a edge function `meli-oauth-callback` via **POST fetch** (JSON body com `code` e `state`)
> 3. Usar `hasProcessedRef` para evitar processamento duplo em re-renders do React
> 4. Enviar resultado via `window.opener.postMessage()`
> 5. Fechar o popup com `window.close()`
>
> **Edge function `meli-oauth-callback` modos:**
> - **POST (JSON):** Recebe `{ code, state }`, troca tokens, retorna `{ success, error }` — usado pelo popup
> - **GET (fallback):** Quando popup falha, redireciona para `/integrations?tab=marketplaces` com query params `meli_connected=true` ou `meli_error=...`
>
> **Prevenção de `invalid_grant`:** O code do ML só pode ser trocado **uma vez**. O `hasProcessedRef` garante que a chamada POST aconteça apenas uma vez, mesmo com StrictMode/re-renders.

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

### Pipeline: Criar em Massa (7 Etapas) → Aprovar → Publicar

```
1. Lojista clica "Novo Anúncio" → abre MeliListingCreator (dialog 7 etapas)
2. Creator Etapa 1 — Selecionar Produtos: checkboxes com busca, selecionar todos
3. Creator Etapa 2 — Categorizar via ML API: cria drafts no banco + chama bulk_auto_categories, exibe categorias com path legível + MeliCategoryPicker para troca manual
4. Creator Etapa 3 — Gerar Títulos IA: chama bulk_generate_titles (já com category_id definido, respeitando max_title_length da categoria), exibe preview editável (input + contador chars + botão Regenerar)
5. Creator Etapa 4 — Gerar Descrições IA: chama bulk_generate_descriptions, exibe preview colapsável com textarea editável + botão Regenerar
6. Creator Etapa 5 — Condição: cards visuais radio-style (Novo / Usado / Não especificado)
7. Creator Etapa 6 — Tipo de Anúncio: cards visuais (Clássico / Premium / Grátis)
8. Creator Etapa 7 — Frete: switches para Frete Grátis e Retirada no Local + botão Salvar
9. Rascunhos aparecem na tabela → lojista edita individualmente se necessário (MeliListingWizard modo edit)
10. Lojista revisa e clica "Aprovar" → status 'approved'
11. Lojista clica "Publicar" (individual) ou "Publicar Selecionados" (em massa) → edge function meli-publish-listing → API do ML → status 'published'
12. Após publicação: pode pausar, reativar, sincronizar preço/estoque
```

### Creator Multi-Produto (MeliListingCreator) — 7 Etapas

Dialog de 7 etapas para criação em massa de anúncios com validação ML sincronizada:

> **IMPORTANTE:** A ordem das etapas é **Categorias → Títulos → Descrições** (não o inverso).
> Isso garante que os títulos sejam gerados já respeitando o `max_title_length` da categoria atribuída, evitando erros de limite de caracteres.

| Etapa | Nome | Descrição |
|-------|------|-----------|
| 1 | Selecionar Produtos | Checkboxes com busca por nome/SKU, selecionar todos, badge de contagem |
| 2 | Categorizar via ML API | Cria drafts no banco + `bulk_auto_categories` → preview com path legível, troca manual via `MeliCategoryPicker` |
| 3 | Gerar Títulos IA | `bulk_generate_titles` (com `category_id` já definido → usa `max_title_length` real da categoria) → preview editável (input, validação semântica anti-truncamento, botão Regenerar com loading spinner) |
| 4 | Gerar Descrições IA | `bulk_generate_descriptions` → preview colapsável, textarea editável, botão Regenerar com loading spinner |
| 5 | Condição | Cards visuais radio-style: `new` (Novo), `used` (Usado), `not_specified` |
| 6 | Tipo de Anúncio | Cards visuais: `gold_special` (Clássico), `gold_pro` (Premium), `free` (Grátis) |
| 7 | Frete | Switches para `free_shipping` (Frete Grátis) e `local_pick_up` (Retirada no Local). Botão Salvar finaliza o wizard. |

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
1. Etapa 2 cria `meli_listings` com status `draft` via `createBulkListings`, depois chama `bulk_auto_categories` com `listingIds` para definir categorias
2. Etapa 3 chama `bulk_generate_titles` com mesmos `listingIds` — como `category_id` já está definido, a edge function consulta `max_title_length` da categoria e gera títulos dentro do limite
3. Etapa 4 chama `bulk_generate_descriptions` com mesmos `listingIds`
4. Etapas 5-7 aplicam condição, listing_type e shipping em batch via update direto
5. Ao finalizar, fecha dialog e tabela mostra os novos rascunhos

**Sincronização com o Mercado Livre:**
- **Títulos:** Prompt IA gera com tipo de produto primeiro, limite dinâmico por categoria (`max_title_length` da API ML), sem emojis/CAPS. Validação semântica (rejeita títulos truncados que terminam em preposições, hífens ou vírgulas)
- **Descrições:** Texto plano, sem HTML/links/contato/emojis, max 5000 chars
- **Categorias:** IDs válidos do ML (formato `MLBxxxx`), resolvidos via `domain_discovery/search` + fallback Search API. Nomes legíveis via `GET /categories/{id}` (path_from_root)
- **Condição:** Valores da API ML: `new`, `used`, `not_specified`
- **Tipo de Anúncio:** Valores da API ML: `gold_special`, `gold_pro`, `free`

### Wizard de Edição (MeliListingWizard)

Mantido **apenas para modo `edit`** — edição individual de um anúncio existente na tabela (botão ✏️).

Componente guiado de 3 etapas para criação/edição de anúncios:

| Etapa | Nome | Descrição |
|-------|------|-----------|
| 1 | Selecionar Produto | Dropdown com produtos ativos da loja |
| 2 | Preenchimento Inteligente | IA gera título (até 120 chars), descrição (texto plano) e categoria automaticamente |
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
| `publish` (default) | Publica novo anúncio | `POST /items` + `POST /items/{id}/description` (2 etapas) |
| `pause` | Pausa anúncio ativo | `PUT /items/{id}` status=paused |
| `activate` | Reativa anúncio pausado | `PUT /items/{id}` status=active |
| `update` | Sincroniza preço/estoque | `PUT /items/{id}` + `PUT /items/{id}/description` |

### Regras de Publicação (v3.1.0)

- **Descrição em 2 etapas:** O ML não aceita `description` no body do `POST /items`. A descrição é enviada separadamente via `POST /items/{id}/description` após a criação do item.
- **Multi-imagem:** Busca até 10 imagens do produto (deduplica primária + galeria). Mínimo 1 obrigatória.
- **GTIN automático:** Busca `products.gtin` e `products.barcode` como fallback para o atributo `GTIN`.
- **Garantia:** Envia obrigatoriamente via atributos `WARRANTY_TYPE` e `WARRANTY_TIME` (campo `warranty` de topo é **depreciado** na API ML). Valores: vendor → "Garantía del vendedor", factory → "Garantía de fábrica".
- **Dimensões de frete:** `PACKAGE_WEIGHT/WIDTH/HEIGHT/LENGTH` **NÃO são enviados** como atributos (não modificáveis via API de itens, removidos na v3.1.0).
- **Permalink:** Armazena `meli_response.permalink` para link "Ver no ML" funcional.

### Regras de Anúncio

- **Título:** Limite dinâmico por categoria (`max_title_length` da API ML, tipicamente 60-120 chars). Validado no frontend e no backend antes da publicação.
- **Tipos de anúncio:** `gold_special` (Clássico), `gold_pro` (Premium), `free` (Grátis)
- **Condição:** `new` (Novo), `used` (Usado) ou `not_specified`
- **Moeda:** `BRL` (padrão)
- **Imagens:** Máximo 10 (limite do ML), mínimo 1 (obrigatório)
- **Categoria:** `category_id` é **obrigatório** (ex: `MLB1000`). Sem fallback. Navegação hierárquica com `children_count`.
- **Descrição:** Apenas texto plano. Gerada via IA com botão "Gerar para ML" (edge function `meli-generate-description`).
- **Título:** Limite dinâmico por categoria (`max_title_length`). Gerado via IA com botão "Gerar Título ML" (mesma edge function, `generateTitle: true`).
- **Múltiplos anúncios:** Um produto pode ter múltiplos anúncios (sem constraint de unicidade). O mesmo produto pode aparecer na seleção do Creator mesmo que já tenha anúncios existentes.

### Campos do Formulário de Anúncio

| Campo | Obrigatório | Descrição |
|-------|:-----------:|-----------|
| Título | ✅ | Limite dinâmico por categoria (`max_title_length` da API ML, validação semântica anti-truncamento) |
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
| `GTIN` | `products.gtin` ou `products.barcode` (fallback automático) |
| `SELLER_SKU` | `products.sku` |
| `WARRANTY_TYPE` | `products.warranty_type` (vendor → "Garantía del vendedor", factory → "Garantía de fábrica") |
| `WARRANTY_TIME` | `products.warranty_duration` (ex: "6 meses") |

> **⚠️ Removidos na v3.1.0:** `PACKAGE_WEIGHT`, `PACKAGE_WIDTH`, `PACKAGE_HEIGHT` e `PACKAGE_LENGTH` **NÃO são enviados** como atributos na publicação. Esses campos não são modificáveis via API de itens do ML e causavam erros/warnings. Dimensões de frete devem ser configuradas via painel do ML ou API de shipping separada.

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
| `title` | TEXT | Título do anúncio (limite dinâmico por categoria) |
| `description` | TEXT | Descrição texto plano |
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

Edge function `meli-bulk-operations` processa em chunks de 5 itens.

**Roteamento IA:** Ambas as edge functions (`meli-bulk-operations` e `meli-generate-description`) utilizam o `ai-router.ts` centralizado (`aiChatCompletion`) para fallback multi-provedor. Para **títulos**, o provedor primário é **OpenAI** (`preferProvider: 'openai'`) pois o Gemini nativo retorna conteúdo vazio em marketing copy (filtro de segurança). O modelo usado é `google/gemini-2.5-pro` (roteado para OpenAI). Para **descrições**, usa roteamento automático (Gemini → OpenAI → Lovable Gateway). **NÃO fazem fetch direto** para provedores de IA.

**Pré-processamento de contexto:** Antes de enviar para a IA, o HTML da descrição do produto é stripado (`description.replace(/<[^>]*>/g, " ")`) para evitar confusão do modelo. O contexto enviado à IA para **títulos** inclui: nome do produto, marca, SKU, peso, resumo/benefícios (`short_description`) e até 800 caracteres da descrição completa. Para **descrições**, o contexto inclui peso, dimensões e SKU, mas **NÃO inclui** código de barras/EAN/GTIN (que vão como atributos separados do anúncio).

**Regra de Validação Semântica de Títulos (OBRIGATÓRIO):**
> A geração de títulos utiliza validação **semântica** + limite dinâmico por categoria (`max_title_length` da API ML).
> 1. **Truncamento semântico:** Títulos terminados em hífen (`-`), vírgula (`,`), dois-pontos (`:`), ponto-e-vírgula (`;`) ou preposições/artigos soltos (`de`, `com`, `para`, `e`, `em`, `o`, `a`, `os`, `as`, `do`, `da`, `no`, `na`, `por`) são rejeitados
> 2. **Contexto mínimo:** Títulos com menos de 3 palavras são rejeitados
> 3. **Temperatura progressiva:** A cada tentativa a temperatura da IA aumenta (0.35 → 0.5 → 0.65) para gerar variação
> 4. **Fallback final:** Se todas as 3 tentativas falharem, constrói título usando nome do produto + palavra-chave de benefício
> 5. **Log detalhado:** Cada tentativa é logada para debugging
>
> **PROIBIDO:** Cortes com `.slice(0, 60)` ou qualquer truncamento cego. O título deve ser uma frase naturalmente completa.
> **Anti-padrão:** Títulos truncados como "Balm Cabelo Barba Anti-" são automaticamente rejeitados e regenerados.
>
> **Limite dinâmico por categoria (aplicado na geração E na publicação):**
> - A edge function `meli-search-categories` retorna `max_title_length` ao consultar uma categoria específica (`?categoryId=MLBxxxx`)
> - O frontend armazena e usa esse valor para validação e exibição do contador de caracteres
> - **As edge functions de geração (`meli-bulk-operations` v1.8.0+ e `meli-generate-description` v1.5.0+) consultam a API do ML (`GET /categories/{id}`) para obter o `max_title_length` ANTES de gerar o título.** O prompt da IA, a sanitização (`sanitizeGeneratedTitle`) e a validação (`isValidGeneratedTitle`) usam esse limite dinâmico.
> - A edge function `meli-publish-listing` valida `title.length <= max_title_length` antes de publicar como guard final
> - Cache por `category_id` no bulk para evitar chamadas repetidas à API do ML
> - Para categorias com limite ≤60 chars, o `hardMinLength` é reduzido e o prompt instrui a IA a ser mais concisa
> - Fallback: se `max_title_length` não estiver disponível na API, usa 120 chars como limite padrão

**Regra de Priorização em Títulos (OBRIGATÓRIO):**
> O prompt de geração de títulos DEVE instruir a IA a:
> 1. Começar pelo **tipo de produto** (ex: Balm, Sérum, Kit, Camiseta), NUNCA pela marca sozinha
> 2. Incluir o principal **benefício ou função** do produto (ex: Anti-queda, Hidratante, Fortalecedor)
> 3. Usar informações da descrição e resumo para identificar o que o produto FAZ
> 4. NÃO incluir código de barras, EAN ou GTIN no título
> 5. O prompt inclui uma **checklist de autovalidação** que a IA deve executar antes de responder
> **Anti-padrão:** Títulos genéricos sem benefício como "Balm Pós-Banho Calvície Zero Dia" devem ser "Balm Pós-Banho Anti-queda Calvície Zero 60g".

**Regra: EAN/GTIN nas Descrições (OBRIGATÓRIO):**
> Códigos de barras (EAN/GTIN) **NÃO devem aparecer** nas descrições geradas pela IA. Esses dados são enviados como atributos separados do anúncio (`GTIN` attribute). Os prompts de descrição devem explicitar essa proibição.

| Ação | Descrição |
|------|-----------|
| `bulk_create` | Cria rascunhos para todos os produtos ativos sem anúncio ML |
| `bulk_generate_titles` | Gera títulos otimizados via ai-router (OpenAI como provedor primário, modelo `google/gemini-2.5-pro`), limite dinâmico por categoria, com instrução explícita no user message ("Gere UM título otimizado..."), validação semântica anti-truncamento com feedback de tentativas rejeitadas, e fallback robusto (nunca persiste título inválido). O prompt inclui exemplos de bons/maus títulos e checklist. **`hasSufficientProductCoverage` (v2.1.0):** aceita títulos que contenham a **marca** OU o **tipo do produto** (primeira palavra do nome), além de keywords. `requiredMatches` reduzido para 1 quando a marca está presente. |
| `bulk_generate_descriptions` | Converte descrições HTML para texto plano via ai-router (sem EAN/GTIN) |
| `bulk_auto_categories` | Categoriza em massa via ML domain_discovery (limit=5) + `pickBestCategory` com scoring inteligente baseado em `CATEGORY_DOMAIN_HINTS`, penalidades para domínios absurdos (Pet Shop, Hidroponia) e resolução de path completo para validação. Se todos os candidatos pontuam negativamente, tenta fallback com busca simplificada (nome + marca). |
| `auto_suggest_category` | Categorização individual com `productName` + `productDescription` para melhor precisão |

### Seleção em Massa (OBRIGATÓRIO)

> A tabela de anúncios possui **checkboxes** para seleção individual e em massa:
> - **Checkbox no header:** Seleciona/deseleciona todos os anúncios
> - **Checkbox por linha:** Seleção individual com highlight visual (`bg-muted/50`)
> - **Badge de contagem:** Exibe "X selecionado(s)" na barra de ações em massa quando há seleção
> - **Ações operam nos selecionados:** Quando há seleção, as ações em massa enviam `listingIds` (array de IDs) no body da edge function. Quando não há seleção, operam em todos.
> - **Excluir Selecionados:** Botão vermelho (destructive) aparece apenas quando há seleção. Filtra automaticamente anúncios `published`/`publishing` (que não podem ser excluídos). Usa `bulkDeleteListings` (DELETE em batch com `.in('id', ids)`) para exibir um único toast de resumo ("X anúncios removidos"). Confirma antes de executar e limpa seleção após conclusão.
> - **Publicar Selecionados:** Botão primário que aparece junto com "Excluir Selecionados" quando há seleção. Aprova rascunhos em batch silenciosamente (UPDATE direto no Supabase), depois publica sequencialmente via `meli-publish-listing` (chamada direta ao Supabase, sem mutation individual). Exibe barra de progresso e um único toast de resumo no final. Confirma antes de executar e limpa seleção após conclusão.
> - **Limpeza automática:** A seleção é resetada após executar uma ação em massa.
> - **Toasts em operações em massa (OBRIGATÓRIO):** Operações em massa DEVEM exibir um **único toast de resumo** (ex: "5 anúncios removidos", "3 anúncios enviados para publicação, 1 com erro"). **PROIBIDO** exibir um toast por item processado. Para isso, usar mutations batch (`bulkDeleteListings`, `bulkApproveListings`) ou chamadas diretas ao Supabase em vez de mutations individuais que possuem toasts em `onSuccess`.
>
> **Body da edge function com seleção:**
> ```json
> { "tenantId": "...", "action": "...", "offset": 0, "limit": 5, "listingIds": ["id1", "id2"] }
> ```

**Regra: Categorização Inteligente com Scoring (OBRIGATÓRIO):**
> A categorização automática (`bulk_auto_categories` e `auto_suggest_category`) utiliza um sistema de scoring multi-candidato (`pickBestCategory`) para evitar categorizações absurdas:
> - Busca **5 candidatos** do `domain_discovery` (não apenas 1)
> - **Resolve o path completo** de cada candidato via `/categories/{id}` antes de pontuar
> - Pontua usando `CATEGORY_DOMAIN_HINTS` (mapa de palavras-chave → domínios esperados, ex: "balm" → "beleza")
> - **Boost +5** para categorias em "Beleza e Cuidado Pessoal", "Barbearia", "Cuidados com o Cabelo"
> - **Penalidade -10** para domínios absurdos: Pet Shop, Hidroponia, Jardinagem, Aquário, Ferramentas (se o produto não menciona esses termos)
> - Se o **melhor score ≤ -5**, todos os resultados são descartados e tenta **fallback** com busca simplificada (nome + marca)
> - `bulk_auto_categories`: busca `products(name, description, short_description, brand)` e concatena keywords da descrição ao searchTerm
> - `auto_suggest_category`: aceita `productDescription` no body para enriquecer o termo de busca
>
> **Anti-padrão corrigido (v1.7.0):** Antes o sistema usava `limit=1` e aceitava cegamente o primeiro resultado da API, causando "Balm Pós-Banho" → "Nutrientes para Hidroponia" e "Balm Capilar" → "Pet Shop > Gatos".

**Regra: Auto-fill GTIN e Marca na Edição (OBRIGATÓRIO):**
> Ao abrir o `MeliListingWizard` para edição, se os atributos `BRAND` e `GTIN` não existem nos `attributes` do anúncio, o `MeliListingsTab.handleEditListing` DEVE buscar esses dados diretamente do produto (`products.brand`, `products.gtin`, `products.barcode`) como fallback.

**Regra: Fallback de Categorização**
> O `auto_suggest_category` tenta primeiro o `domain_discovery/search` do ML com termo enriquecido (nome + descrição) e `pickBestCategory`.
> Se falhar (status != 200, sem resultados, ou todos os scores negativos), usa a Search API (`/sites/MLB/search?q=...`) e extrai categorias dos `available_filters`.
> Resolve o path completo da categoria via `/categories/{id}` para exibição ao usuário.

## Regra: Aba de Pedidos — Auto-Refresh (OBRIGATÓRIO)

> A aba de pedidos (`MeliOrdersTab`) **NÃO deve ter botões manuais** de "Atualizar" ou "Sincronizar".
> Os dados são recarregados automaticamente via `refetchOnWindowFocus: true` e `staleTime: 30_000` no hook `useMeliOrders`.
> Durante o carregamento, exibe apenas um badge "Atualizando..." com `animate-pulse`.
> A sincronização com a API do ML ocorre via webhook/cron, não via ação manual do usuário.

## Regra: Parâmetro `listingIds` na Edge Function (OBRIGATÓRIO)

> A edge function `meli-bulk-operations` aceita **tanto `listingIds` quanto `productIds`** no body.
> O `MeliListingCreator` envia `listingIds` (IDs dos rascunhos criados) para que a IA processe apenas os anúncios recém-criados.
> A edge function usa `const filterIds = listingIds || productIds;` para compatibilidade.

## Regra: Resolução de Nomes de Categoria na Edição (OBRIGATÓRIO)

> Ao abrir o `MeliListingWizard` para edição, se o anúncio já possui `category_id`, o `MeliListingsTab` DEVE resolver o nome legível da categoria via `meli-search-categories?categoryId=...` antes de passar como `categoryName` ao wizard.
> Isso evita exibir IDs crus como "MLB1000" no campo de categoria.

## Regra: Fallback de Contexto para IA no Wizard (OBRIGATÓRIO)

> No `MeliListingWizard` modo edição, os botões "Regenerar" de título/descrição DEVEM usar `initialData?.product?.name` como fallback quando `selectedProduct` é `null`.
> Isso garante que a IA tenha contexto do produto mesmo quando o wizard é aberto diretamente para edição.

## Regra: Título ML Sem Truncamento no `meli-generate-description` (OBRIGATÓRIO)

> A edge function `meli-generate-description` (modo `generateTitle: true`) DEVE aplicar validação semântica e retry:
> - Até 3 tentativas com temperatura progressiva (0.5 → 0.65 → 0.8)
> - Limite de caracteres dinâmico por categoria (`max_title_length` da API ML)
> - **Tamanho mínimo obrigatório:** 60% do `max_title_length` (ex: 36 chars para categorias de 60). Títulos abaixo do mínimo são rejeitados e retried com feedback para a IA ("título muito curto, precisa ter entre X e Y chars")
> - Rejeitar títulos que terminem em preposições soltas, hífens, vírgulas ou frases incompletas
> - **PROIBIDO** corte cego com `.slice(0, N)` no retorno final
> - Se todas as tentativas falharem, aplicar fallback seguro com nome do produto + benefício
> - Modelo: `google/gemini-2.5-pro` com `preferProvider: 'openai'` (consistente com bulk)
> - Prompt inclui range de caracteres explícito ("ENTRE X E Y caracteres") e instrução para preencher o espaço disponível
>
> Objetivo: impedir títulos truncados como `"Balm Respeite o Homem Anti-"` e títulos curtos como `"Balm Respeite o Homem Pós"` (25 chars) no botão **Regenerar** do Creator/Wizard.

## Sincronização de Status dos Anúncios (`meli-sync-listings`)

Edge function que consulta a API do ML para detectar anúncios excluídos, pausados ou encerrados externamente e atualizar o status local.

```typescript
POST /meli-sync-listings
{
  "tenantId": "...",
  "listingIds": ["id1", "id2"]  // opcional — se vazio, sincroniza todos published/paused/publishing
}
```

### Mapeamento de Status ML → Local

| Status ML | Sub-status | Status Local | Descrição |
|-----------|-----------|--------------|-----------|
| `active` | — | `published` | Anúncio ativo |
| `paused` | — | `paused` | Pausado |
| `closed` | `deleted` | `error` | Excluído no ML |
| `closed` | `expired` | `error` | Expirado no ML |
| `closed` | outros | `error` | Encerrado no ML |
| `under_review` | — | `publishing` | Em revisão pelo ML |
| `inactive` | — | `paused` | Inativo (sem estoque, etc.) |
| Item não encontrado | — | `error` | Excluído ou encerrado |

### Dados Sincronizados

- **Status** (mapeado conforme tabela acima)
- **Preço** (`price`) — atualizado do ML
- **Estoque** (`available_quantity`) — atualizado do ML
- **Permalink** (`meli_response.permalink`) — para link "Ver no ML"
- **Mensagem de erro** (`error_message`) — descrição do motivo quando status vira `error`

### Regras

- Usa API multiget (`GET /items?ids=...`) com chunks de 20 itens
- Auto-refresh de token expirado via `meli-token-refresh`
- Só atualiza registros cujo status realmente mudou
- Anúncios com status `error` (detectados como excluídos/encerrados no ML) podem ser **excluídos localmente** pelo usuário

### UI

- Botão **"Sincronizar"** (ícone RefreshCw) no header da aba Anúncios (`MeliListingsTab`)
- Exibe toast com resultado da sincronização
- Invalida cache de listings após conclusão

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Manter aba de mensagens no marketplace | Mensagens vão para Atendimento |
| Exigir aprovação manual antes de enviar em massa | Botão "Enviar Selecionados" auto-aprova rascunhos antes de publicar |
| Hardcodar categoria ML | Usar `category_id` configurável |
| Ignorar erro da API ML | Salvar `error_message` e `meli_response` |
| Criar anúncio sem creator | Usar MeliListingCreator para criação (multi-produto) |
| Usar MeliListingWizard para criar | MeliListingWizard é apenas para edição individual |
| Botões manuais de refresh/sync na aba Pedidos | Auto-refresh via `refetchOnWindowFocus` |
| Enviar `productIds` ao invés de `listingIds` no Creator | Creator envia `listingIds` dos rascunhos criados |
| Exibir `category_id` cru na edição | Resolver nome via `meli-search-categories` |
| Chamar IA sem contexto de produto | Usar fallback `initialData.product.name` |
| Usar `window.confirm()` para ações destrutivas | Usar `useConfirmDialog` com variante adequada |
| Aceitar títulos truncados da IA | Validar e retry até 3x com temperatura progressiva |
| Exibir um toast por item em operações em massa | Usar mutations batch (`bulkDeleteListings`, `bulkApproveListings`) ou chamadas diretas, com um único toast de resumo |
| Chamar `mutation.mutate()` em loop (for/forEach) | Usar mutation batch ou chamada direta ao Supabase com `.in('id', ids)` |
| Não sincronizar status com ML | Usar `meli-sync-listings` para detectar excluídos/encerrados |

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
- [x] Geração IA de título otimizado para ML (limite dinâmico por categoria via `max_title_length`)
- [x] Operações em massa (enviar todos, gerar títulos/descrições, auto-categorizar)
- [x] Envio em massa: "Enviar Selecionados" (auto-aprova draft/ready + publica)
- [x] Auto-suggest de categoria via category_predictor no formulário individual
- [x] Sincronização de status de anúncios com ML (detecta excluídos/pausados/encerrados)
- [ ] Webhook de notificações de pedidos (real-time)
