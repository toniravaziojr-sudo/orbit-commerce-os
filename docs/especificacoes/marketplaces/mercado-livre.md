# Mercado Livre — Regras e Especificações

> **Status:** 🟩 Atualizado  
> **Última atualização:** 2026-06-28 (v2.5.0: alinhamento de **Frete Grátis** com a regra do Mercado Livre Brasil. Anúncios com preço ≥ R$ 79 têm `free_shipping=true` forçado no UI (toggle bloqueado + badge "Obrigatório"), no adaptador `meli-publish-listing` e persistido em `meli_listings.shipping` com o `shipping` real devolvido pelo ML após publicação. Sync/webhook passam a buscar `shipping` do ML e atualizar localmente, detectando divergências passivamente — sem cron dedicado.)
> **Histórico v2.4.3 (2026-06-27):** adaptador de envio injeta `UNITS_PER_PACK=1` quando a categoria expõe o atributo e ele está ausente; drop universal de AFE/CONAMA/ANVISA-number quando o cadastro não tem o número correspondente.
> **Histórico v2.4.1 (2026-06-27):** cache de características versionado; rascunhos antigos recalculam uma única vez; ANVISA não escolhida sai do painel/payload; `meli-publish-listing` remove metadados internos antes de enviar ao ML.
> **Histórico v2.4.5 (2026-06-23):** novo campo `products.model` no cadastro; cascata `MODEL` no envio ao ML passa a ser model → product_type → ai_product_type → brand → "Genérico", **SKU nunca é usado como modelo**; ação `update` reenvia atributos saneados pela lista oficial da categoria.
> **Histórico v2.4.3 (2026-06-22):** OAuth do Mercado Livre passa a usar PKCE obrigatório quando o app integrador exigir `code_verifier`; o estado da tentativa é salvo no backend por curta duração e consumido no callback.
> **Histórico v2.4.0 (2026-06-21):** tela de Anúncios reorganizada em 3 abas — Rascunhos (padrão), Publicados, Pendências. Ações em massa reduzidas a **Editar em Lote** e **Excluir Selecionados**. Publicação movida para a última etapa do dialog de criação ("Salvar como rascunho" / "Salvar e publicar no Mercado Livre"). Editar em Lote, quando aplicado a anúncios já publicados, **atualiza** no ML em vez de publicar novos. Exclusão de anúncios publicados agora **encerra definitivamente no Mercado Livre** (status closed) antes de remover localmente.
> **Histórico:** 2026-06-21 (v2.3.4: bug fix "Configurar Selecionados"). 2026-06-21 (v2.3.3: releitura do banco ao reabrir rascunhos, anti-regeneração, spinner no Continuar). 2026-06-20 (v2.3.1: persistência por etapa com debounce).

> **Camada:** Layer 3 — Especificações / Marketplaces  
> **Migrado de:** `docs/regras/mercado-livre.md`  
> **Última atualização:** 2026-04-03


---

## Visão Geral

Integração OAuth com Mercado Livre para sincronização de pedidos, atendimento, gestão de anúncios e métricas.

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/marketplaces/MercadoLivre.tsx` | Dashboard com abas (Conexão, Anúncios, Métricas) — aba **Pedidos foi removida**; pedidos ML aparecem no módulo central `/orders` |
| `supabase/functions/meli-bulk-operations/` | Operações em massa (enviar produtos, gerar títulos/descrições, auto-categorizar) |
| `src/pages/MeliOAuthCallback.tsx` | Proxy page para callback OAuth |
| `src/hooks/useMeliConnection.ts` | Status/OAuth com listener de postMessage |
| `src/hooks/useMeliListings.ts` | CRUD + publicação + criação em massa (`createBulkListings`) + sincronização (`syncListings`) |
| `src/components/marketplaces/MeliListingsTab.tsx` | UI da aba Anúncios (lista + ações em massa + creator/wizard) |
| `src/components/marketplaces/MeliListingCreator.tsx` | Dialog multi-produto de 3 etapas para criação em massa com IA |
| `src/components/marketplaces/MeliListingWizard.tsx` | Wizard para edição individual de anúncios |
| `src/components/marketplaces/MeliCategoryPicker.tsx` | Seletor de categorias ML com busca, navegação hierárquica e auto-suggest |
| `src/components/marketplaces/MeliMetricsTab.tsx` | UI da aba Métricas (KPIs + desempenho) |
| `src/components/marketplaces/MeliConnectionCard.tsx` | Card de conexão OAuth |
| `supabase/functions/meli-oauth-*` | Fluxo OAuth |
| `supabase/functions/meli-publish-listing/` | Publicação de anúncios na API do ML |
| `supabase/functions/meli-search-categories/` | Busca de categorias ML (predictor + search fallback + children_count) |
| `supabase/functions/meli-generate-description/` | Geração IA de descrição/título para ML via ai-router (texto plano, sem HTML/links/contato) |
| `supabase/functions/meli-sync-orders/` | Sincronização de pedidos do ML para `orders` (canal central) |
| `supabase/functions/meli-orders-reconcile/` | Cron `*/15 * * * *` — reconciliação de pedidos por conexão ativa (fallback de webhook) |
| `supabase/functions/meli-sync-questions/` | Sincronização de perguntas → Atendimento |
| `supabase/functions/meli-answer-question/` | Responder perguntas via API ML |
| `supabase/functions/meli-webhook/` | Notificações do ML (topics: `orders_v2`, `orders`, `shipments`, `items`, `items_prices`, `questions`) |
| `supabase/functions/meli-sync-listings/` | Sincronização de status dos anúncios com o ML (detecta excluídos/pausados/encerrados) |

## Fluxo OAuth

```
1. Usuário acessa Integrações → aba Marketplaces
2. Clica "Conectar" no card do Mercado Livre (inicia OAuth direto, sem redirecionar)
3. meli-oauth-start → URL de autorização com PKCE quando exigido pelo app ML
4. Popup abre para ML
5. ML redireciona para /integrations/meli/callback (MeliOAuthCallback.tsx)
6. MeliOAuthCallback captura code/state e chama edge function meli-oauth-callback via POST (JSON)
7. meli-oauth-callback (edge function) → valida state, envia code_verifier, troca code por tokens e salva no banco → retorna JSON
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
>
> **PKCE obrigatório quando habilitado no app ML:** se o aplicativo do Mercado Livre estiver com PKCE ativo, o início do OAuth deve enviar `code_challenge` + `code_challenge_method=S256`, e o callback deve enviar o `code_verifier` correspondente. O `state` não carrega mais dados de tenant em base64; ele aponta para uma tentativa segura salva temporariamente no backend. Sem isso, o Mercado Livre retorna `code_verifier is a required parameter` e a UI mostra `token_exchange_failed`.

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

### Organização da Tela (Abas)

A tela de Anúncios é dividida em **quatro abas**, com filtro automático por status:

| Aba | Conteúdo | Quando aparece vazia |
|-----|----------|----------------------|
| **Rascunhos** (padrão) | Anúncios em `draft`, `ready`, `approved` | Mostra estado limpo com botão "Novo Anúncio" |
| **Publicados** | Anúncios em `published`, `paused` | Mensagem indicando ausência de anúncios ativos no ML |
| **Pendências** | Anúncios em `error` (revisão necessária) e `publishing` (em envio / em revisão pelo Mercado Livre) | Mensagem de "Nenhuma pendência" |
| **Inativos** (v2.6 — 2026-06-22) | Anúncios em `inactive` — finalizados no Mercado Livre (encerrados pelo lojista, expirados ou sem estoque) | Mensagem explicando que finalizados ficam preservados aqui para consulta |

Cada aba exibe um contador (badge) quando há itens; **Pendências** usa badge destrutivo para chamar atenção. A seleção de itens é escopada à aba ativa (trocar de aba limpa a seleção).

#### Selo de sincronização em tempo real (v2.6)

No cabeçalho da tela aparece um selo:
- **Verde "Sincronizado em tempo real com o Mercado Livre"** quando o sistema recebeu qualquer sinal do ML na última 1h (webhook ativo).
- **Âmbar "Sem sinal recente do Mercado Livre"** quando a última notificação tem mais de 1h. Nesse caso, a reconciliação diária às 5h cobre divergências e o lojista pode forçar com o botão "Sincronizar".

Ao lado do selo, label "Última atualização há X" baseado no maior entre `last_webhook_at` e `last_sync_at` da conexão.

#### Indicador de origem da última mudança (v2.6)

Cada anúncio exibe ao lado do badge de status um pequeno indicador da **origem da última alteração**:
- **"•" azul:** alterado aqui no sistema.
- **"ML" âmbar:** alterado no painel do Mercado Livre (pelo lojista ou pelo ML automaticamente).

Tooltip mostra a data/hora relativa em BRT.

### Ações em Massa (apenas com seleção)

A barra de ações aparece somente quando há itens marcados e contém **dois botões**:

- **Editar em Lote** — reabre o assistente de 9 etapas com os itens selecionados pré-carregados. Na última etapa:
  - Se **todos** os selecionados já estão publicados no ML (têm `meli_item_id`), o único botão é **"Atualizar anúncios no Mercado Livre"**, que dispara `meli-publish-listing` com `action: "update"` para cada item.
  - Caso contrário, exibe **"Salvar como rascunho"** e **"Salvar e publicar no Mercado Livre"** (este último publica os novos e atualiza os já publicados, conforme o caso).
- **Excluir Selecionados** — para itens nunca publicados, remove apenas localmente. Para itens publicados/pausados, **desativa (finaliza) no Mercado Livre** (status `closed` — sai do ar, link público para de funcionar) e remove daqui. O Mercado Livre não permite exclusão definitiva de anúncios já publicados; eles ficam apenas no histórico interno do ML. Texto da confirmação (v2.6):
  > "Este anúncio será desativado (finalizado) no Mercado Livre — sai do ar e o link público para de funcionar. O Mercado Livre não permite exclusão definitiva de anúncios já publicados; ele fica apenas no histórico interno do ML. Aqui no sistema o anúncio será removido. Deseja continuar?"


> **Removido da tela principal (v2.4.0):** "Enviar Todos", "Gerar Títulos", "Gerar Descrições", "Auto-Categorizar" e "Enviar Selecionados". Essas funções continuam disponíveis **dentro** do dialog de criação/edição em lote, onde são naturais ao fluxo. A edge function `meli-bulk-operations` permanece ativa porque é consumida pelo dialog.

### Pipeline: Criar → Publicar (no mesmo dialog)

```
1. Lojista clica "Novo Anúncio" → abre MeliListingCreator (dialog 9 etapas)
2. Etapa 1 — Selecionar Produtos
3. Etapa 2 — Categorizar via ML API (cria drafts no banco)
4. Etapa 3 — Gerar Títulos IA (respeitando max_title_length da categoria)
5. Etapa 4 — Gerar Descrições IA
6. Etapa 5 — Características
7. Etapa 6 — Condição
8. Etapa 7 — Tipo de Anúncio
9. Etapa 8 — Preços: ajuste do preço específico do anúncio, sem alterar o cadastro interno
10. Etapa 9 — Frete + escolha final:
     • "Salvar como rascunho" (fica em Rascunhos para revisão posterior)
     • "Salvar e publicar no Mercado Livre" (publica todos os itens em sequência)
11. Após publicação: aparece na aba Publicados, pode pausar/reativar/editar/sincronizar/excluir
```

### Sincronização ML em todas as ações

| Ação na UI | Comportamento no ML |
|------------|---------------------|
| Pausar | `PUT /items/{id}` com `status: paused` |
| Reativar | `PUT /items/{id}` com `status: active` |
| Editar publicado (individual) | Salva local + `meli-publish-listing` com `action: "update"` |
| Editar em Lote (publicados) | Salva local em batch + `action: "update"` por item |
| Excluir publicado | `PUT /items/{id}` com `status: paused` (best-effort) → `status: closed` (definitivo) → DELETE local |
| Excluir rascunho/erro nunca publicado | DELETE local apenas |
| Sincronizar | `meli-sync-listings` (detecta closed/paused/active no ML) |

> **Mercado Livre não suporta exclusão real** — apenas encerramento (`closed`), que é irreversível. A UI comunica isso explicitamente antes da confirmação.



### Creator Multi-Produto (MeliListingCreator) — 9 Etapas

Dialog de 9 etapas para criação em massa de anúncios com validação ML sincronizada:

> **IMPORTANTE:** A ordem das etapas é **Categorias → Títulos → Descrições** (não o inverso).
> Isso garante que os títulos sejam gerados já respeitando o `max_title_length` da categoria atribuída, evitando erros de limite de caracteres.

| Etapa | Nome | Descrição |
|-------|------|-----------|
| 1 | Selecionar Produtos | Checkboxes com busca por nome/SKU, selecionar todos, badge de contagem |
| 2 | Categorizar via ML API | Cria drafts no banco + `bulk_auto_categories` → preview com path legível, troca manual via `MeliCategoryPicker` |
| 3 | Gerar Títulos IA | `bulk_generate_titles` (com `category_id` já definido → usa `max_title_length` real da categoria) → preview editável (input, validação semântica anti-truncamento, botão Regenerar com loading spinner). Botão **"Manter nomes originais dos produtos"** substitui todos os títulos pelo nome cadastrado do produto (truncado a 60 chars), útil quando o lojista prefere o naming interno em vez do título gerado pela IA. |
| 4 | Gerar Descrições IA | `bulk_generate_descriptions` → preview colapsável, textarea editável, botão Regenerar com loading spinner |
| 5 | Características | Cruza cadastro, categoria e dicionário do ML; preenche obrigatórios e recomendados seguros antes de publicar. |
| 6 | Condição | Cards visuais radio-style: `new` (Novo), `used` (Usado), `not_specified` |
| 7 | Tipo de Anúncio | Cards visuais: `gold_special` (Clássico), `gold_pro` (Premium), `free` (Grátis) |
| 8 | Preços | Campo editável por produto, botões de desconto %, acréscimo % e restaurar preço do cadastro. Atualiza somente o preço do anúncio no ML. |
| 9 | Frete | Switches para `free_shipping` (Frete Grátis) e `local_pick_up` (Retirada no Local). Botão Salvar finaliza o wizard. |

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
4. Etapas 5-8 aplicam condição, listing_type, preço específico do anúncio e shipping em batch via update direto
5. Ao finalizar, fecha dialog e tabela mostra os novos rascunhos

**Reabertura de rascunhos (modo "Configurar Selecionados"):**
- Ao abrir o dialog para rascunhos já existentes, o sistema **relê o estado oficial do banco** (título, descrição, categoria, condição, tipo e frete) antes de exibir qualquer etapa, ignorando cache desatualizado da listagem.
- Ao reabrir rascunhos, a etapa de descrições **não dispara IA automaticamente**. O sistema apenas exibe o que está salvo; qualquer nova geração precisa partir de ação explícita do lojista. Itens com descrição já salva são exibidos diretamente — proibido regerar conteúdo já produzido.
- Botão "Continuar" mostra estado **"Salvando..." com spinner** durante a transição entre etapas (garante feedback visual e evita duplo clique).
- Barra de progresso de geração em massa exibe contador `X/Y` em tempo real e é **resetada ao trocar de etapa**, eliminando o bug visual da tarja azul aparecendo numa etapa diferente da atual.
- Gravação de títulos e descrições é feita em **paralelo** (batch), acelerando lotes grandes.

**Idempotência de etapas (anti-regressão, 2026-06-26):**
- No modo criação (Novo Anúncio), as etapas que envolvem chamadas à API do ML ou à IA — **Categorias**, **Títulos** e **Descrições** — só rodam **uma única vez por abertura do diálogo**. Cada etapa tem um marcador interno (`categorizeDoneRef`, `titlesDoneRef`, `descriptionsDoneRef`) que é setado no fim da execução bem-sucedida.
- Clicar **Voltar** e depois **Continuar** dentro do mesmo diálogo **não dispara reprocessamento**: o sistema apenas avança a tela, mantendo categoria, título e descrição já preenchidos.
- Os marcadores são resetados **apenas no fechamento do diálogo**. Falhas em uma etapa não setam o marcador — permitindo retry natural ao Continuar novamente.
- Regerar individualmente continua disponível via botões "Regerar" do próprio painel de cada etapa (ato consciente do lojista, gasto autorizado).

**Troca de categoria invalida características (anti-regressão, 2026-06-26):**
- Toda vez que a categoria de um anúncio muda — manualmente pelo seletor ou via **"Aplicar a todos"** — o cache de características daquele anúncio é zerado (`meli_listings.attributes = null`).
- Motivo: o Mercado Livre define o conjunto de atributos **por categoria**. Manter atributos da categoria anterior faria o painel exibir campos que não pertencem mais à categoria atual e ocultar campos novos (ex.: "Ingredientes Ativos" aparecendo em uma categoria e sumindo em outra).
- Efeito: na próxima abertura do painel, o motor de características roda uma única vez para a nova categoria e exibe exatamente os campos que o ML define para ela. A memória de ajustes manuais por produto (v2.1.0) continua sendo aplicada quando o nome da característica casa.
- A invalidação só ocorre quando o código da categoria realmente muda — selecionar a mesma categoria não dispara reprocessamento.

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
- **Características do anúncio:** A resolução automática deve usar somente campos reais do cadastro do produto; dimensões usam profundidade como comprimento, garantia usa duração/tipo cadastrados, e condição deve vir do rascunho do anúncio quando houver rascunho salvo. Se a consulta ao cadastro falhar por contrato quebrado, a UI não deve mascarar como produto inexistente.
- **Dimensões de frete:** `PACKAGE_WEIGHT/WIDTH/HEIGHT/LENGTH` **NÃO são enviados** como atributos (não modificáveis via API de itens, removidos na v3.1.0).
- **Permalink:** Armazena `meli_response.permalink` para link "Ver no ML" funcional.

#### Garantias Finais do Adaptador (v2.4.3 — 2026-06-27)

Antes do envio ao ML, depois da sanitização contra a lista oficial da categoria, o adaptador aplica duas regras adicionais. Ambas operam **apenas sobre o payload de envio**; o cadastro do produto **não é tocado** (regra 3.2.1 das Regras do Sistema).

1. **`UNITS_PER_PACK` garantido quando a categoria expõe.** Se o atributo `UNITS_PER_PACK` existe na spec da categoria e está **ausente** do payload final (não foi resolvido pelo motor, nem marcado N/A), o adaptador injeta o valor do cadastro com piso 1. Cobre venda avulsa (1) e kit (quantidade do cadastro). Sem isso o ML rejeita com "Unidades por kit deve ser ≥ 1 quando Formato de venda = Unidade".
2. **Drop universal de regulatórios quando o cadastro não tem o número.** Para cada atributo regulatório (AFE, CONAMA, qualquer variante ANVISA-number) presente no payload: se o campo correspondente em `products.regulatory_info` está vazio, o atributo é **removido** do payload, **independentemente da origem** (memória do tenant, sugestão da IA, marcação manual no painel). Cadastro vazio = atributo omitido. Cosmético notificado, por definição, não tem AFE — esse campo nunca mais chega ao ML.

A mensagem de erro do ML para AFE em formato inválido foi traduzida em `humanizeMeliError`: o lojista vê "Este produto não tem registro AFE no cadastro — o sistema vai omitir esse campo automaticamente na próxima tentativa." Sem termos técnicos.

**Anti-regressão:** qualquer evolução do adaptador deve manter as duas garantias acima e a regra de não alterar o cadastro.


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

### Resolução e Persistência de Categoria (v2026-06-25)

Cada anúncio guarda no banco, junto com o código da categoria (`category_id`), o nome amigável (`category_name`) e o caminho completo (`category_path_text`, formato "Pai > Filho > Neto"). Regras:

- **Abertura do diálogo (rascunho):** a tela hidrata o caminho completo direto do banco. Sem flicker, sem chamada à API do ML.
- **Backfill lazy (uma única vez):** se um anúncio antigo ainda estiver com `category_name`/`category_path_text` nulos, na primeira abertura o sistema resolve via `meli-search-categories` e persiste o resultado. Reaberturas seguintes ficam instantâneas.
- **Reconsulta ao ML só sob demanda:** ocorre apenas quando o usuário (a) troca a categoria manualmente, (b) aciona o botão "Auto" de categorização, ou (c) usa "Categorizar em massa". Todos esses caminhos gravam o nome e o caminho resolvidos junto com o novo `category_id`.
- **Operações em lote:** `meli-bulk-operations` (`bulk_auto_categories`) persiste `category_name` + `category_path_text` na mesma escrita do `category_id`; itens já categorizados que ainda não tenham nome amigável também recebem o backfill nesta passada.
- **Proibido:** resolver o nome da categoria em tempo de render sem persistir o resultado — isso reintroduz o flicker e gasta chamada de API a cada abertura.

### Política de Envio ao ML: 100% Manual (v2.5.0 — OBRIGATÓRIO)

> **Não existe nenhum mecanismo automático (cron, gatilho ou job) que envie atualizações ao Mercado Livre.** Todo `POST` ou `PUT` para a API do ML é disparado exclusivamente por ação manual do usuário (publicar, atualizar, pausar, reativar, excluir).
>
> **Motivo:** o Mercado Livre penaliza anúncios editados com alta frequência — perda de relevância na busca orgânica, reset do score de qualidade do anúncio e queda em campanhas Mercado Ads. Por isso é proibido criar rotina que atualize anúncios sem intervenção do lojista.
>
> O único cron que toca em ML — `meli-sync-listings-auto` (08:00 diário) — é **somente leitura**: traz status/preço/estoque do ML para o nosso banco e nunca dispara `PUT` no sentido inverso.

### Atributos Enviados Automaticamente

A edge function `meli-publish-listing` monta os atributos a partir do formulário + dados do produto:

| Atributo | Fonte |
|----------|-------|
| `BRAND` | Formulário ou `products.brand` |
| `GTIN` | `products.gtin` ou `products.barcode` (fallback automático) |
| `SELLER_SKU` | `products.sku` |
| `LINE` | `products.line` → `products.product_type` → `products.ai_product_type` → `products.brand` → "Não se aplica" (cascata; SKU nunca é usado) |
| `MODEL` | `products.model` → `products.product_type` → `products.ai_product_type` → `products.brand` → "Genérico" (cascata; SKU nunca é usado como modelo — v2.4.5) |
| `WARRANTY_TYPE` | `products.warranty_type` (vendor → "Garantía del vendedor", factory → "Garantía de fábrica") |
| `WARRANTY_TIME` | `products.warranty_duration` (ex: "6 meses") |

### Auto-preenchimento de Atributos Obrigatórios por Categoria (v3.3.0 + v2.5.0)

Antes de publicar, a edge function consulta `GET /categories/{id}/attributes` e identifica os atributos marcados como `required` pela categoria escolhida. Para cada obrigatório que ainda não tenha valor, o sistema tenta preencher automaticamente:

| Atributo obrigatório | Fallback automático |
|----------------------|---------------------|
| `BRAND` | `products.brand` |
| `LINE` (Linha) | `products.line` → `products.product_type` → `products.ai_product_type` → `products.brand` → "Não se aplica" |
| `MODEL` (Modelo) | `products.model` → `products.product_type` → `products.ai_product_type` → `products.brand` → "Genérico" |
| `ITEM_CONDITION` | "Novo" (ou "Usado" se `listing.condition = used`) |
| `GTIN` / `EAN` | `products.gtin` |

> **⚠️ Anti-regressão (v2.4.5):** O SKU **NUNCA** deve ser usado como valor de `MODEL` em nenhum marketplace. SKU é código interno de inventário, não modelo comercial. Produtos sem modelo específico (caso comum em cosméticos como linha Respeite o Homem) devem cair no `product_type` (Shampoo, Balm, Loção, Óleo etc.). Regra registrada também em `_padrao-canonico-marketplaces.md`.

### Atributos Cosméticos Secundários — IA Preenche Sempre (v2.5.0)

Atributos cosméticos do tipo Sim/Não/Não se aplica (`DERMATOLOGICALLY_TESTED`, `HYPOALLERGENIC`, `IS_CRUELTY_FREE`, `IS_VEGAN`, `WITH_FRAGRANCE`, `IS_ORGANIC`, `IS_PARABEN_FREE`, `IS_NATURAL`, `IS_GLUTEN_FREE` e variações), **mesmo quando opcionais pela categoria do ML**, são SEMPRE consultados via `meli-resolve-attributes`:

1. Se o cadastro do produto tem o campo respectivo preenchido → usa o valor do cadastro.
2. Se não tem → IA é consultada e responde "Sim", "Não" ou "Não se aplica" com base no nome/descrição/contexto do produto.
3. **Se a IA não tem certeza, é obrigada a responder "Não"** — nunca deixa em branco. Isso elimina a seção "Características secundárias incompletas" no painel do ML.

### Anti-Alucinação e Tolerância a Erros da IA (v1.5.0)

Regras invioláveis aplicadas em `meli-resolve-attributes` para evitar marca/atributo inventado e crash em lote:

- **Marca de terceiros — bloqueio duplo:** se o produto não tem `brand` no cadastro, a IA **nunca** é aceita para o atributo `BRAND` (vira `missing` com mensagem "Preencha a marca no cadastro do produto"). Além disso, uma lista negra (`FAMOUS_BRAND_BLACKLIST`) descarta sugestões da IA como L'Oréal, Nivea, Dove, Garnier, Natura, Boticário, Johnson, Samsung, Apple, Nike etc. mesmo se vierem por engano.
- **GTIN/EAN:** nunca preenchido pela IA. Só vem do cadastro.
- **Anti-repetição preguiçosa:** sugestões opcionais que apenas repetem palavras do nome do produto (sem lista fechada) são descartadas — evita "Volume" aparecer em "Tipo de cuidado", "Efeitos" e "Tipo de aplicação" ao mesmo tempo.
- **Tolerância a formato inesperado:** helper `toSafeString()` converte qualquer retorno da IA (array, objeto, número, null) em string segura antes de qualquer `.trim()`. Elimina o erro `(...).trim is not a function`.
- **Isolamento por atributo:** o loop de processamento envolve cada atributo em `try/catch`. Falha em 1 atributo nunca derruba os demais nem o produto inteiro.
- **Prompt rígido:** a IA recebe regras explícitas — "value sempre string", "nunca inventar marca", "não repetir palavras do nome em campos descritivos", "se não houver evidência, devolva vazio".

### Fila de Concorrência no Painel (v1.5.0)

`MeliAttributesPanel` usa uma fila global de no máximo 3 resoluções simultâneas no app inteiro. Quando o usuário abre o dialog de configuração em lote com N produtos, apenas 3 chamadas ao motor de IA acontecem por vez — as demais ficam visivelmente "aguardando vez na fila". Isso evita 429/timeout e protege custo de IA.

Cada produto tem botão **"Tentar de novo"** isolado quando falha, com mensagem amigável em PT-BR (sem stacktrace). O resultado é salvo no anúncio assim que pronto — reabrir o dialog não recalcula (cache por `listingId + categoryId`).


### Marca/GTIN/Modelo em Texto Livre e Etiqueta de Origem (v1.6.0 — 2026-06-23)

Princípio: **o cadastro do produto é a fonte da informação**. O motor do Mercado Livre apenas traduz o cadastro para o formato exigido pela categoria. A IA entra somente quando o ML pede um campo que não existe no cadastro (ex.: "Tipo de aplicação", "Tipo de cuidado") ou para escolher o item certo de uma lista fechada quando o cadastro descreve em texto livre.

**Regras de texto livre (exceção à lista fechada do ML).** Para os atributos `BRAND`, `GTIN`, `EAN`, `MODEL` e `SELLER_SKU`, quando o valor vem do cadastro do produto, o sistema **mantém o texto livre mesmo que a categoria publique uma lista oficial fechada**. Isso resolve o caso da marca própria da loja (ex.: "Respeite o Homem"), que nunca aparece na lista de marcas conhecidas do ML, mas é aceita pelo ML como valor livre. A regra se aplica em dois pontos:

- **Resolver** (`meli-resolve-attributes`): o set `FREE_FORM_FROM_PRODUCT` libera o valor do cadastro como `filled` com `source: "product"` mesmo sem `value_id` da lista oficial.
- **Sanitização final** (`meli-publish-listing`, blocos inline e `sanitizeAttributesForCategory`): o set `FREE_FORM_IDS` mantém `value_name` livre em vez de descartar; demais atributos continuam sendo descartados quando fora da lista, como antes.

**Sugestão da IA = verde com etiqueta de origem.** Todo atributo resolvido com valor (cadastro, derivação, dicionário ou IA) entra como `status: "filled"`. O painel `MeliAttributesPanel` diferencia visualmente apenas pela etiqueta de origem ao lado do campo:

- **"Do cadastro do produto"** — verde — para `source ∈ {product, derivation, dictionary}`.
- **"Sugerido pela IA"** — azul — para `source = ai`.

Não existe mais bloco amarelo "para revisar" para sugestões da IA. **Tudo o que está verde será enviado ao Mercado Livre na publicação**, e o lojista enxerga claramente o que veio do cadastro e o que foi sugerido pela IA. É proibido reintroduzir status `review` para sugestões da IA — cria fricção falsa e desencoraja a publicação.

Memória anti-regressão: `.lovable/memory/constraints/meli-resolve-attributes-hardening.md` (regras 1 e 10).

### Edição Manual, Recalcular Todos e Aplicar a Todos (v1.7.0 — 2026-06-23)

O painel `MeliAttributesPanel` ganhou três comportamentos para devolver controle ao lojista sem perder a economia de IA:

1. **Edição manual em qualquer linha.** Toda característica (verde "Do cadastro do produto", azul "Sugerido pela IA" ou vermelha "Faltando") pode ser editada inline. Linhas compactas (já preenchidas) mostram um ícone de lápis no hover; ao salvar, o valor é marcado com a etiqueta **"Editado manualmente"** (roxo, `source: "manual"`) e gravado imediatamente no anúncio. O lojista pode corrigir erros do cadastro ou da IA sem precisar abrir o cadastro do produto.

2. **Persistência automática no anúncio.** Assim que o resolver termina (ou quando o usuário edita um valor), o painel grava o resultado em `meli_listings.attributes`. Reabrir o dialog não dispara IA de novo: o painel hidrata do banco quando `category_id` bate. Antes da v1.7.0, o resultado só era salvo no clique "Continuar" da etapa — quem fechava o dialog antes perdia o cálculo e era recobrado em IA na próxima abertura.

3. **Recalcular todos (topo da etapa).** Botão no cabeçalho da etapa "Características" força o resolver da IA em todos os anúncios da etapa simultaneamente. Usa a mesma fila de concorrência (máx 3 em paralelo). Útil quando o lojista atualiza o cadastro do produto e quer refletir nos rascunhos sem reabrir produto por produto.

4. **Aplicar a todos (por produto).** Cada card de produto na etapa exibe o botão **"Aplicar a todos"** quando o produto já tem características resolvidas E existe pelo menos um outro produto na mesma categoria do ML. Ao clicar, copia o conjunto completo de características (com a etiqueta de origem preservada) para os outros anúncios da **mesma categoria**, persistindo em banco. Não atravessa categorias diferentes — evita aplicar atributos de cosmético em produto de outra família.

Implementação: `MeliAttributesPanel` aceita `recalcToken` (incrementa → força resolve) e `seedToken + seedAttributes` (muda → substitui atributos atuais e persiste). `MeliListingCreator` controla esses tokens no estado da etapa.

Memória anti-regressão: `.lovable/memory/constraints/meli-resolve-attributes-hardening.md` (regras 10, 11 e 12).





### Atualização de anúncio publicado (v2.4.5)

A ação `update` do `meli-publish-listing` reenvia também o array de `attributes` salvo localmente (não só título/preço/estoque/imagens). Antes de enviar, os atributos passam pelo helper `sanitizeAttributesForCategory` que consulta `GET /categories/{id}/attributes` e descarta valores fora da lista oficial da categoria — evitando `Validation error` quando o produto foi reclassificado pelo ML.

### Ajuste de Preço no Wizard de Publicação (v2.5.2)

No assistente em lote, a etapa **Preços** fica antes de **Frete**. Para cada produto, mostra o preço atual do anúncio e o preço do cadastro como referência. Existem 3 controles:

| Ação | Efeito |
|------|--------|
| **Aplicar desconto %** | Reduz o preço atual em X% (ex.: 10% → preço × 0,90) |
| **Aplicar acréscimo %** | Aumenta o preço atual em X% (ex.: 15% para cobrir taxa do ML) |
| **Restaurar do cadastro** | Volta para o preço definido em `products.price` |

O ajuste afeta APENAS o preço do anúncio (campo `meli_listings.price`). O preço de venda interno (`products.price`) **não é alterado** — o ajuste é específico do canal ML. O fluxo bloqueia avanço se algum preço ficar zero ou negativo.





> **⚠️ Removidos na v3.1.0:** `PACKAGE_WEIGHT`, `PACKAGE_WIDTH`, `PACKAGE_HEIGHT` e `PACKAGE_LENGTH` **NÃO são enviados** como atributos na publicação. Esses campos não são modificáveis via API de itens do ML e causavam erros/warnings. Dimensões de frete devem ser configuradas via painel do ML ou API de shipping separada.

### Status do Anúncio

| Status | Descrição | Aba | Ações Disponíveis |
|--------|-----------|-----|-------------------|
| `draft` | Rascunho | Rascunhos | Editar, Aprovar, Excluir (local) |
| `ready` | Pronto para aprovação | Rascunhos | Editar, Aprovar, Excluir (local) |
| `approved` | Aprovado, aguardando publicação | Rascunhos | Editar, Publicar, Excluir (local) |
| `publishing` | Em processo de envio ao ML / em revisão pelo ML | Pendências | Aguardar (sem ações até confirmação do ML) |
| `published` | Publicado no ML | Publicados | Ver no ML, Sincronizar, Pausar, Editar (sync ML), Excluir (encerra no ML) |
| `paused` | Pausado no ML | Publicados | Reativar, Editar (sync ML), Excluir (encerra no ML) |
| `error` | Erro na publicação | Pendências | Editar, Retentar publicação, Excluir |

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
| `category_id` | TEXT | Categoria ML (código, ex.: MLB32130) |
| `category_name` | TEXT | Nome amigável da categoria persistido (v2026-06-25) |
| `category_path_text` | TEXT | Caminho completo "Pai > Filho > Neto" persistido (v2026-06-25) |
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

## Regra: Pedidos do ML são unificados no módulo central de Pedidos (OBRIGATÓRIO — v3.3)

> A aba "Pedidos" do dashboard `/marketplaces/mercadolivre` foi **removida**. Pedidos do Mercado Livre entram no mesmo módulo de Pedidos da loja (`/orders`), no mesmo fluxo (fiscal → logística → cliente).
> A diferenciação visual é feita pelo `OrderSourceBadge` (logo do ML) e pelo filtro de Origem em `/orders` (`channel=mercadolivre`).
> Acessos antigos a `?tab=pedidos` no dashboard ML são redirecionados automaticamente para `/orders?channel=mercadolivre`.
> O dashboard ML mantém apenas **Conexão, Anúncios e Métricas**.

### Entrada automática de pedidos
> 1. **Webhook em tempo real** — `meli-webhook` trata os topics `orders_v2`, `orders` e `shipments`, extraindo o `orderId` do `resource` e chamando `meli-sync-orders` para aquele pedido específico.
> 2. **Reconciliação a cada 15 min** — `meli-orders-reconcile` (cron `*/15 * * * *`) percorre todas as conexões ML ativas e dispara `meli-sync-orders` em modo incremental (últimos 10 pedidos) como fallback de webhook perdido.
> 3. **Carimbo canônico** — todo pedido ML é gravado em `orders` com `sales_channel = 'marketplace'` + `marketplace_source = 'mercadolivre'`, conforme `_padrao-canonico-marketplaces.md`.
> 4. **Mesmo fluxo da loja** — após o upsert, triggers existentes (`enqueue_fiscal_draft`, gateway/local shipping routing, customer metrics, etc.) atuam normalmente. Nada de fluxo paralelo.

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

## Sincronização Bidirecional em Tempo Real (v2.6 — 2026-06-22)

A sincronização **anúncio sistema ↔ Mercado Livre** opera em três camadas:

1. **Sistema → ML (imediato):** toda ação no app (criar, pausar, reativar, editar, excluir) chama `meli-publish-listing` na hora. Carimba `last_status_change_source = 'local'`.
2. **ML → Sistema em tempo real (webhook):** `meli-webhook` escuta os topics `items`, `items_prices` e `questions`. Ao receber `items`/`items_prices` consulta o item no ML, aplica o mapeamento de status (mesma tabela de `meli-sync-listings`) e atualiza o registro local em segundos. Carimba `last_status_change_source = 'meli'`. Atualiza `marketplace_connections.last_webhook_at` (insumo do selo de tempo real na UI). A UI mantém uma subscription Realtime em `meli_listings` (filtrada por `tenant_id`, escopada à aba visível para não vazar canais), então a tabela reflete a mudança sem refresh do navegador.
3. **Reconciliação diária (`meli-sync-listings`, cron 05h BRT):** roda em todos os tenants ativos como rede de segurança. Métrica de saúde: deve tender a zero atualizações por execução conforme o webhook em tempo real cobrir o fluxo.

### Pré-requisito de plataforma

O app integrador (DevCenter do ML) precisa estar assinando os topics **`items`** e **`items_prices`** além do `questions` já existente. Callback continua sendo a edge function `meli-webhook`. Sem essa assinatura a sincronização cai apenas no cron 05h.

### Domínios das URLs expostas ao DevCenter (OBRIGATÓRIO)

O Mercado Livre exige URLs públicas que respondam o que ele espera. Por isso há **dois domínios distintos** na configuração:

| Item | Domínio correto | Por quê |
|------|-----------------|---------|
| **Redirect URI (callback OAuth)** | `https://app.comandocentral.com.br/integrations/meli/callback` | Precisa ser uma rota da aplicação porque renderiza a tela do popup que captura `code`/`state` e fecha a janela. |
| **Webhook (Notifications URL)** | `https://integrations.comandocentral.com.br/meli/webhook` | Precisa responder **JSON puro** e estar fora do roteamento da SPA. O domínio `integrations.*` é dedicado a endpoints de integração e é roteado direto para a edge function `meli-webhook`. |

> ⚠️ **Anti-regressão:** nunca usar `app.comandocentral.com.br/integrations/meli/webhook` como Notifications URL. Esse caminho devolve o HTML da aplicação (SPA) e o Mercado Livre rejeita como "URL inválida". A tela **Integrações → Mercado Livre → Configurações da Plataforma** já exibe as duas URLs prontas para copiar, com o domínio correto de cada uma e a explicação da diferença.

### Regra "excluído vs desativado" (alinhada à limitação do ML)

O Mercado Livre **não permite exclusão definitiva** de anúncios já publicados — apenas o status `closed`. Por isso:

| Cenário | Ação no sistema |
|---------|-----------------|
| Lojista exclui aqui um anúncio publicado/pausado | Sistema chama `closed` no ML (anúncio sai do ar, link público para) e remove o registro daqui. Aviso explícito ao usuário. |
| Lojista exclui aqui um rascunho nunca publicado | DELETE local apenas. |
| ML reporta `closed` + `sub_status: deleted` em item que **nunca** atingiu `published`/`paused`/`inactive` locais | DELETE local (rascunho remoto descartado). |
| ML reporta `closed` em item que já foi publicado | Vira `inactive` aqui, com `inactive_reason` preservado. Aparece na aba **Inativos**. |
| ML reporta `paused` | Vira `paused` aqui automaticamente. |
| ML reporta `active` | Vira `published` aqui automaticamente. |
| Item retornar 404 na consulta ao ML | Mesma regra: nunca publicado → DELETE; já publicado → `inactive` com motivo "Excluído no Mercado Livre". |

### Idempotência e ordem dos eventos

O webhook compara `notification.sent` com `meli_listings.last_status_change_at`. Se o evento for mais antigo que o último estado conhecido (com tolerância de 1s) é descartado — protege contra notificações fora de ordem.

### Origem da última mudança

Coluna `last_status_change_source` em `meli_listings` (`local` | `meli`) + `last_status_change_at` carimbada por trigger BEFORE UPDATE quando o `status` muda. Webhook envia explicitamente `'meli'`. UI mostra indicador discreto ao lado do badge de status (tooltip com data/hora relativa em BRT).

## Sincronização de Status dos Anúncios — Cron de Fallback (`meli-sync-listings`)

Edge function que consulta a API do ML para reconciliar status em lote. **Hoje serve como rede de segurança do webhook em tempo real**, não como fluxo primário.

```typescript
POST /meli-sync-listings
{
  "tenantId": "...",
  "listingIds": ["id1", "id2"]  // opcional — se vazio, sincroniza published/paused/publishing/inactive/error
}
```

### Mapeamento de Status ML → Local (canônico — usado por webhook e cron)

| Status ML | Sub-status | Status Local | Notas |
|-----------|-----------|--------------|-------|
| `active` | — | `published` | — |
| `paused` | — | `paused` | — |
| `closed` | `deleted` em item **nunca publicado localmente** | DELETE local | Rascunho remoto descartado |
| `closed` | `deleted` em item já publicado | `inactive` | Motivo: "Excluído no Mercado Livre" |
| `closed` | `expired` | `inactive` | Motivo: "Expirado no Mercado Livre" |
| `closed` | `out_of_stock` | `inactive` | Motivo: "Sem estoque no Mercado Livre" |
| `closed` | outros / vazio | `inactive` | Motivo: "Finalizado no Mercado Livre" |
| `under_review` | — | `publishing` | Mensagem: "Em revisão pelo Mercado Livre" |
| `inactive` | — | `paused` | Mensagem: "Inativo no ML: <sub_status>" |
| 404 em consulta | — | DELETE se nunca publicado; senão `inactive` "Excluído no Mercado Livre" | — |

### Dados Sincronizados

- Status (regra acima) + `inactive_reason`/`error_message`.
- Preço (`price`).
- Estoque (`available_quantity`).
- Permalink (`meli_response.permalink`).
- `last_status_change_source = 'meli'`.

### Regras

- API multiget (`GET /items?ids=...`) chunks de 20.
- Auto-refresh de token via `meli-token-refresh`.
- Só grava quando o status efetivamente mudou ou há nova mensagem de erro.
- Cron 05h BRT roda em todos tenants ativos sem auth (modo `cronMode`).

### Testes automatizados

`supabase/functions/meli-webhook/__tests__/status-mapper_test.ts` (Deno) cobre os 11 cenários canônicos do mapeamento, incluindo idempotência da regra "closed+deleted vs já-publicado" e tolerância a `sub_status` como string ou array.

### UI

- Botão **Sincronizar** no header força reconciliação imediata.
- Selo "Sincronizado em tempo real" + última atualização em BRT.
- Aba **Inativos** lista anúncios em `inactive` com motivo e link permanente para o histórico do ML.
- Toast com resultado.


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

## Edição Pós-Publicação (OBRIGATÓRIO)

### Campos Editáveis (PUT /items/{id})

Anúncios com status `published` ou `paused` podem ser editados nos seguintes campos:

| Campo | Endpoint | Implementado |
|-------|----------|-------------|
| Preço (`price`) | PUT /items/{id} | ✅ v3.1.0 |
| Estoque (`available_quantity`) | PUT /items/{id} | ✅ v3.1.0 |
| Título (`title`) | PUT /items/{id} | ✅ v3.2.0 |
| Imagens (`pictures`) | PUT /items/{id} | ✅ v3.1.0 |
| Descrição (`plain_text`) | PUT /items/{id}/description | ✅ v3.1.0 |

### Campos Imutáveis (Restrição ML)

| Campo | Motivo |
|-------|--------|
| `category_id` | Categoria é imutável após publicação |
| `condition` | Novo/usado é imutável |
| `buying_mode` | Modo de compra é imutável |
| `listing_type_id` | Tipo de anúncio é imutável |

### UI de Edição Pós-Publicação

> O `MeliListingWizard` DEVE permitir abertura para anúncios `published` e `paused`, mas:
> - Campos imutáveis (categoria, condição, tipo de listagem) ficam **desabilitados com tooltip explicativo**
> - Ao salvar, a action `update` na `meli-publish-listing` envia apenas os campos permitidos via PUT
> - Validação de título: respeitar `max_title_length` da categoria (mesmo na edição)
> - Após salvar, exibir toast de sucesso e invalidar cache de listings

---

## Gestão de Imagens nos Anúncios (OBRIGATÓRIO)

### Comportamento Padrão: Herdar + Customizar

> Na **criação** do anúncio, o sistema herda automaticamente todas as imagens do cadastro do produto (até 10).
> As imagens são salvas no campo `images` (JSONB) da `meli_listings` como **cópia editável**.
> A partir daí, o usuário pode customizar as imagens do anúncio independentemente do cadastro do produto.

### Customização por Anúncio

| Ação | Descrição |
|------|-----------|
| Reordenar | Drag-and-drop para alterar a ordem (primeira = principal no ML) |
| Adicionar | Upload ou URL de imagens extras |
| Remover | Remover imagens específicas daquele anúncio |
| Resetar | Botão para restaurar imagens do produto original |

### Regras

- **Mínimo 1 imagem** para publicar (já validado na edge function)
- **Máximo 10 imagens** (limite ML, aplicado em `buildImagesList`)
- **Merge inteligente:** `buildImagesList` evita duplicatas via `Set<URL>`
- **Edição pós-publicação:** PUT /items/{id} com `pictures` atualiza imagens no ML
- **Primeira imagem = imagem principal** do anúncio no ML

### Anti-Patterns de Imagens

| Proibido | Correto |
|----------|---------|
| Não mostrar preview das imagens no Wizard | Exibir galeria com thumbnails e ordem |
| Perder imagens ao editar anúncio | Carregar `images` do JSONB ao abrir edição |
| Permitir publicar sem imagem | Validar mínimo de 1 antes de aprovar |

---

## Multi-Anúncio por Produto

### Regra de Diferenciação (OBRIGATÓRIO)

> O sistema permite múltiplos anúncios para o mesmo produto (sem limite de quantidade).
> Porém, ao **aprovar/publicar** um anúncio para um produto que já possui anúncio ativo (`published` ou `paused`),
> é **obrigatório** que pelo menos o **título OU o preço** sejam diferentes dos anúncios existentes.
>
> **Validação:** Executada no momento da aprovação (transição para status `approved`), não na criação do rascunho.
> **Rascunhos:** Podem existir livremente sem restrição de diferenciação.
> **Demais campos:** Livres para edição sem restrição.

### UI de Multi-Anúncio

- **Badge na lista:** Exibir "X anúncios" quando o produto possui mais de 1 anúncio (qualquer status)
- **Alerta informativo:** Ao criar anúncio para produto com anúncio ativo, exibir alerta não-bloqueante: _"Este produto já possui X anúncio(s) ativo(s) no Mercado Livre"_
- **Validação na aprovação:** Se título E preço forem idênticos a um anúncio ativo existente, bloquear com mensagem explicativa

---

## Variações / SKUs (PLANEJADO — Não implementado)

### Visão Geral

Suporte completo a multi-variação (cor + tamanho, etc.) com estoque e fotos por variação.

### Modelo de Dados (Proposta)

```
Tabela: meli_listing_variations
- id: UUID PK
- listing_id: UUID FK → meli_listings
- tenant_id: UUID FK → tenants
- attribute_combinations: JSONB  -- ex: [{ id: "COLOR", value_name: "Azul" }, { id: "SIZE", value_name: "M" }]
- price: NUMERIC
- available_quantity: INT
- picture_ids: TEXT[]  -- IDs das imagens do anúncio associadas a essa variação
- seller_custom_field: TEXT  -- SKU da variação
- meli_variation_id: BIGINT  -- ID da variação no ML (após publicação)
- status: TEXT  -- active/inactive
- created_at / updated_at
```

### API ML para Variações

| Operação | Endpoint | Notas |
|----------|----------|-------|
| Criar com variações | POST /items (incluir array `variations`) | Cada variação: `attribute_combinations`, `price`, `available_quantity`, `picture_ids` |
| Atualizar variação | PUT /items/{id}/variations/{variation_id} | Preço, estoque, fotos |
| Adicionar variação | POST /items/{id}/variations | Nova combinação |
| Remover variação | DELETE /items/{id}/variations/{variation_id} | Não pode remover a última |

### Impacto Cruzado

| Módulo | Impacto |
|--------|---------|
| **Estoque** | Cada variação tem estoque próprio; soma = `available_quantity` total do anúncio |
| **Pedidos** | Pedido ML indica `variation_id`; precisa mapear para SKU interno |
| **Imagens** | Variações referenciam `picture_ids` (IDs das imagens do anúncio, não URLs) |
| **Sincronização** | `meli-sync-listings` precisa trazer dados de variações |

### Fases de Implementação

1. **Fase 1:** Modelo de dados + UI de criação de variações no Wizard
2. **Fase 2:** Publicação com variações via API ML (POST /items com `variations`)
3. **Fase 3:** Sincronização de estoque por variação (bidirecional)
4. **Fase 4:** Mapeamento variação→SKU nos pedidos recebidos do ML

---

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
- [ ] Edição pós-publicação (título no update) — edge function ajustada, UI pendente
- [ ] UI de gestão de imagens por anúncio (drag-and-drop, adicionar, remover)
- [ ] Validação de diferenciação em multi-anúncio (título OU preço diferente)
- [ ] Variações / SKUs (multi-variação completa — planejado)

## Pedidos na Esteira Fiscal (v3.2 — Onda Fiscal)

### Sincronização de Itens (OBRIGATÓRIO)
A função `meli-sync-orders` persiste **cabeçalho + itens** do pedido. Para cada item importado:

1. Lê `seller_sku` (ou `seller_custom_field`) do anúncio ML.
2. Busca um produto local da loja com mesmo SKU (`products.sku`, escopado por `tenant_id`).
3. Se encontrar: grava `order_items.product_id` e herda `weight`, `barcode`, `ncm` do cadastro.
4. Se NÃO encontrar: grava o item com `product_id = NULL` (estado "pendente de vínculo").

### Bloqueio Fiscal (OBRIGATÓRIO)
Pedidos com **qualquer item sem vínculo de produto local** NÃO entram na fila de Notas Fiscais. O trigger `enqueue_fiscal_draft` consulta `order_has_unlinked_items(order_id)` antes de inserir em `fiscal_draft_queue`.

### Vínculo Manual via UI
Na tela de detalhe do pedido (`/orders/:id`), itens pendentes mostram:
- Banner amarelo no topo da seção "Itens do Pedido"
- Badge "Pendente de vínculo" por item
- Botão "Vincular produto" que abre seletor de produto da loja

Ao vincular, o trigger `enqueue_fiscal_on_item_link` re-avalia o pedido: se está pago e todos os itens agora têm `product_id`, entra automaticamente na fila fiscal.

### Status Canônico de Pagamento
O mapeamento ML→sistema usa `approved/pending/declined/refunded/cancelled` (alinhado ao trigger fiscal que dispara em `payment_status = 'approved'`).

### Roteamento de Transporte
Pedidos com `marketplace_source = 'mercadolivre'` retornam `reason = 'marketplace'` em `resolve_order_shipping_provider` — não entram em `shipping_draft_queue` (envio é responsabilidade do ML/Mercado Envios).

## Motor de Atributos por Categoria (v3.4 — Onda Classificação Universal, 2026-06-21)

### Visão de negócio
Quando o lojista escolhe a categoria do anúncio, o sistema resolve **sozinho** quais atributos o Mercado Livre exige naquela categoria e tenta preencher cada um cruzando 4 fontes nesta ordem: (1) cadastro do produto, (2) derivações automáticas (kit, peso somado, unidades, garantia, regime regulatório), (3) dicionário universal de atributos, (4) IA Gemini cruzando nome/descrição/tipo/função.

Cada atributo volta com um status:
- **Preenchido** — valor confiável vindo do cadastro, derivação ou dicionário.
- **Revisar** — sugestão da IA, exige confirmação humana antes de publicar.
- **Faltando** — obrigatório do ML sem dado confiável. Publicação fica bloqueada até resolver (preencher no cadastro do produto OU diretamente no painel do anúncio).

### Backend
Edge function `meli-resolve-attributes` (verify_jwt=true), payload `{ tenantId, productId, categoryId }`. Retorna:
```
{
  success: true,
  attributes: [{ id, name, value_name, value_id?, status, source, required, message? }],
  summary: { filled, review, missing },
  can_publish: boolean
}
```
IA via `aiChatCompletionJSON` do `_shared/ai-router.ts` (Gemini 2.5 Flash → fallback automático). Nunca chama Lovable Gateway direto. O motor primeiro aplica inferências determinísticas de baixo custo e só consulta IA para atributos úteis que ainda ficaram sem resposta.

### Preenchimento ampliado de características recomendadas (v1.4.0 — 2026-06-23)
Para evitar nota baixa por envio de poucas características, o motor passa a preencher de forma determinística atributos recomendados seguros quando a categoria do Mercado Livre os oferece:
- **Formato do produto:** inferido por tipo/nome (ex.: Balm → Bálsamo, Loção → Loção).
- **Formato de venda:** Kit quando o produto tem composição; Unidade nos demais casos.
- **Unidades por kit:** soma da composição quando houver kit.
- **Conservação:** Temperatura ambiente para cosméticos sem requisito especial.

O motor ignora atributos somente leitura e atributos de embalagem que o próprio ML controla, evitando gasto de IA e evitando rejeição por campos não editáveis.

### Fallback determinístico por tokens (v1.2.0 — 2026-06-23)
Para atributos **obrigatórios de lista fechada** (ex.: `PRODUCT_TYPE` com lista oficial do ML), o motor garante que nunca devolva "Faltando" silenciosamente quando há base no produto:

1. **Prompt reforçado:** a IA é instruída explicitamente a NUNCA devolver vazio para esses atributos, e a escolher sempre o valor da lista oficial que mais se aproxima do nome / tipo cadastrado / tipo inferido. Exemplos no prompt: "Balm Pós-banho" → "Balm", "Loção de crescimento" → "Loção".
2. **Fallback por tokens:** se mesmo assim a IA devolver vazio ou um valor fora da lista, o motor faz casamento por palavras-chave entre `(nome do produto + product_type + ai_product_type + ai_main_function + categoria universal)` e cada valor da lista oficial do ML. O candidato com maior pontuação vence e entra como sugestão da IA (status **Revisar**).
3. **Marca "Faltando" apenas se ninguém bater:** se nem o casamento por tokens encontrar candidato compatível, o atributo entra como **Faltando** com mensagem clara para o lojista.

Resultado prático: o caso "Tipo de produto não encontrado" no Balm Pós-banho (cuja categoria ML aceita "Balm" mas o cadastro tinha "loção de crescimento") passa a resolver automaticamente para "Balm" via casamento de tokens com o nome do produto.

### UI (Etapa 5B — em andamento)
Painel "Atributos para o anúncio" dentro do dialog de novo/editar anúncio do ML, abaixo do seletor de categoria. Três blocos visuais (preenchido / revisar / faltando) e botão de publicação desabilitado enquanto houver faltando.

### Atributos cosméticos no cadastro (Etapa 5.5 — concluída 2026-06-21)
Quando o regime regulatório do produto é **ANVISA Cosmético**, o cadastro exibe um cartão extra **"Atributos Cosméticos"** com 9 campos: Dermatologicamente testado, Hipoalergênico, Livre de crueldade, Vegano, Com fragrância (todos tri-state Sim/Não/Não se aplica), Nome da fragrância (texto), Tipos de cabelo recomendados (multi-tag), Tipos de tratamento (multi-tag) e Efeitos esperados (texto).

Esses campos são consumidos diretamente pelo motor de atributos do Mercado Livre e mapeados para os IDs `DERMATOLOGICALLY_TESTED`, `HYPOALLERGENIC`, `CRUELTY_FREE`, `IS_VEGAN`, `WITH_FRAGRANCE`, `FRAGRANCE`, `HAIR_TYPES`, `HAIR_TREATMENT_TYPE` e `EFFECTS` com status ✅ Preenchido (sem precisar de IA).

**Aplicar atributos em lote:** botão na lista de produtos abre dialog que permite selecionar N produtos cosméticos, marcar quais atributos propagar e aplicar em 1 clique — mesmo padrão de "Aplicar a todos" usado em título/descrição.

### Aprendizado por tenant
Correção manual feita pelo lojista vira aprendizado escopado por tenant (a ser conectado em fase seguinte).


## Atalho "Abrir cadastro do produto" na aba Pendências (v3.5 — 2026-06-22)

Quando um anúncio fica em **Pendências** porque a publicação no Mercado Livre exigiu dado que precisa vir do cadastro do produto (marca, GTIN, atributo obrigatório de categoria), a aba mostra um botão **"Abrir cadastro"** ao lado das demais ações da linha.

Critério de exibição: a mensagem de erro do anúncio contém qualquer um destes sinais: `cadastro do produto`, `missing_required_attributes`, `marca`, `brand`, `gtin`, `ean`.

Comportamento:
- O botão abre `/products?edit=<productId>` em **nova aba**, direto no formulário de edição do produto.
- Quando o lojista volta para a aba Pendências, o sistema **revalida automaticamente** a lista de anúncios e o catálogo (listener de `focus` + `visibilitychange`). Custo zero — só reaproveita o React Query.
- A tela de Produtos passa a aceitar o deep link `?edit=<productId>` (uso interno do atalho).

## Etapas "Características" e "Preços" no assistente em lote (v3.6 — 2026-06-23)

O assistente de criação/edição em lote de anúncios tem **9 etapas**, com **"Características"** entre "Descrições" e "Condição" e **"Preços"** entre "Tipo" e "Frete":

1. Produtos → 2. Categorias → 3. Títulos → 4. Descrições → **5. Características** → 6. Condição → 7. Tipo → **8. Preços** → 9. Frete.

Comportamento da etapa:
- Para cada anúncio em preparação, o painel **"Atributos para o anúncio"** primeiro carrega o que já está salvo no próprio anúncio (`meli_listings.attributes`) **somente se o cache estiver na versão atual do motor**. Só chama o motor `meli-resolve-attributes` (IA + dicionário) quando não há nada salvo para aquela categoria, quando o cache salvo é legado/incompatível, ou quando o lojista clica em **Recalcular** (v3.7 — 2026-06-23; versionamento v2.4.1 — 2026-06-27).
- Anti-regressão: reabrir o dialog, trocar de aba do navegador ou voltar do cadastro do produto **não dispara** nova resolução automática — o conteúdo já resolvido é reaproveitado sem custo de IA.
- Se o lojista trocar a categoria do anúncio, as características salvas perdem validade e o motor é chamado novamente (categoria diferente = atributos diferentes).
- Mostra contador "X faltando" e atalho "Abrir cadastro" por anúncio, abrindo o produto correspondente em nova aba.
- Botão **"Continuar"** fica desabilitado enquanto houver atributos obrigatórios faltando em qualquer anúncio.
- Ao avançar, persiste para cada anúncio o array `attributes` em `meli_listings` no formato `[{ id, value_name?, value_id? }, ...]` — só os com status diferente de `missing`.
- Na etapa **Preços**, o lojista pode editar o preço por anúncio, aplicar desconto/acréscimo percentual em lote ou restaurar o preço do cadastro. O preço interno do produto não muda.

A função de publicação (`meli-publish-listing`) já consome esse array e faz merge sem sobrescrever: agora o anúncio nasce com pontuação alta no Mercado Livre porque vai com **todos** os atributos relevantes (obrigatórios + recomendados), não só os básicos.

Vale tanto na criação em lote (modo "Selecionar produtos") quanto na reabertura de rascunhos ("Editar em lote").

## Cadastro como Fonte Única do Mercado Livre (v3.8 — 2026-06-23)

O **cadastro do produto** é a única fonte de verdade para os campos obrigatórios do Mercado Livre. O motor de atributos (`meli-resolve-attributes`) e o assistente de criação/edição em lote **nunca** chamam IA para esses valores — todos vêm direto do cadastro.

### Campos obrigatórios no cadastro

Aplicados em `src/lib/marketplaces/mlReadiness.ts` (função `checkMlReadiness`, fonte única consumida pelo formulário de produto, pela tela de Produtos e pelo wizard de anúncios):

- **Marca** (`products.brand`)
- **Código de barras GTIN/EAN** (`products.gtin`, 8 a 14 dígitos)
- **Modelo** (`products.model`) — com botão **"Genérico"** ao lado do campo para o lojista marcar conscientemente quando não houver modelo específico. Persistido como o literal `"Genérico"`.
- **Peso (g) + dimensões (largura, altura, profundidade em cm)**
- **Categoria universal** (`products.universal_category_id`)
- **Conteúdo líquido** — valor numérico + unidade (ml/g/l/kg/un)
- **Atributos cosméticos tri-estado** (obrigatórios quando `regulatory_regime = anvisa_cosmetic`): dermatologicamente testado, hipoalergênico, cruelty free, vegano, tem fragrância

### Bloqueios e UX

1. **No formulário do produto** (`ProductForm.tsx`):
   - Banner amarelo no topo lista os campos faltantes assim que o lojista abre/edita o produto.
   - Botão **"Salvar"** travado por toast destrutivo enquanto qualquer item da lista estiver vazio.
   - Botão **"Genérico"** ao lado de **Modelo** preenche `products.model = "Genérico"` em um clique.

2. **Na lista de Produtos** (`ProductList.tsx`):
   - Contador **"N Incompletos para Mercado Livre"** visível no topo da lista.
   - Clique no contador ativa filtro que mostra **somente** os produtos pendentes.

3. **No wizard de anúncios** (`MeliListingWizard.tsx`):
   - Checagem silenciosa final imediatamente antes do `onSubmit`. Mesmo com o painel verde, consulta o cadastro do produto no banco e bloqueia a publicação com toast + ação **"Abrir cadastro"** se algum campo voltou a ficar vazio.
   - Garante que ninguém burla o fluxo apagando dados no cadastro depois de resolver atributos.

### Política para produtos antigos

Produtos cadastrados antes desta versão entram automaticamente na lista de incompletos. Estratégia em duas fases:

- **Fase 1 (atual):** Filtro **"Incompletos para Mercado Livre"** + banner por produto + bloqueio de salvar **na edição do próprio produto**. Permite atacar a fila sem travar operações não-ML.
- **Fase 2 (a ativar após relatório do passivo):** Bloqueio universal — qualquer salvamento que toque um produto incompleto é rejeitado, sem exceção. Depende de aprovação do lojista após revisar o passivo.

### Por que isso elimina alucinação da IA

Quando os campos críticos (marca, modelo, GTIN, peso, dimensões) **sempre** existem no cadastro, o motor de atributos `meli-resolve-attributes` opera em modo "preferir cadastro": só consulta a IA para atributos descritivos restantes (efeitos, tipo de cuidado, indicações), e mesmo assim com a lista negra `FAMOUS_BRAND_BLACKLIST` ativa. Marcas de terceiros e modelos inventados (como o caso `MLB7017325810` que saiu com Modelo = `"0002"`) deixam de ser possíveis por construção.

---

## v1.8.0 — Multi-valor, Garantia e Órgão Regulatório (2026-06-23)

Esta onda fecha as 4 lacunas detectadas após a 1ª remessa de 21 anúncios:

### 1. Atributos multi-valor (Tipos de cabelo, Formatos de tratamento capilar etc.)
- Resolver detecta atributos do ML com `tags.multivalued=true` ou `value_max_quantity>1` e devolve `values: [{id, name}]` em vez de `value_name` único.
- Painel persiste o array em `meli_listings.attributes.values`. Display continua mostrando os valores separados por vírgula (com edição manual disponível).
- Publish envia no formato exigido pelo ML (`{ id, values: [{id, name}] }`). Antes, mandávamos `value_name: "A, B, C"` e o ML aceitava só "A".
- IA é instruída a **marcar TODAS** as opções compatíveis (mais alcance no ML). Para single-select obrigatório, escolher SEMPRE a opção mais próxima do produto.

### 2. Garantia automática
- Resolver cria `WARRANTY_TYPE` (`vendor`→"Garantia do vendedor"; `factory`→"Garantia de fábrica") e `WARRANTY_TIME` (texto do cadastro) a partir de `products.warranty_type` + `products.warranty_duration`. Aparece como verde "Do cadastro do produto" no painel.
- `WARRANTY_TIME` entrou no conjunto `FREE_FORM_IDS` do publish — texto livre não é descartado pela sanitização.

### 3. Órgão regulatório (ANVISA) automático
- Quando `regulatory_regime` do produto contém "anvisa", o publish preenche automaticamente o atributo de órgão regulatório da categoria com "ANVISA". IDs cobertos: `REGULATORY_AGENCY`, `SANITARY_REGISTRY_AGENCY`, `HEALTH_REGISTRATION_INSTITUTION`, `REGULATORY_BODY`, `ANVISA_REGISTRY_INSTITUTION` — só o que a categoria expuser.

### 4. Anti-regressão de IDs inválidos
- Sanitização do publish passa a descartar atributos cujo `id` não exista na spec da categoria (antes passavam direto e o ML rejeitava o item inteiro).

### Aplicar nos 21 anúncios já publicados
Os atributos não são reenviados automaticamente. Para atualizar, abrir Anúncios → selecionar os 21 → "Recalcular todos" no painel → "Salvar e publicar".

---

## v1.9.0 — Cobertura Total da Categoria + "Não se aplica" (2026-06-24)

**Problema resolvido:** depois da v1.8.0 ainda restavam campos opcionais da categoria do ML em branco (Dosador, Efeitos, Apresentação, Fragrância etc.). Resultado: barra "Corrija as características" continuava aparecendo no anúncio publicado.

### Regra de negócio
A categoria escolhida na Etapa 1 do dialog é a **única fonte** dos atributos. O sistema busca **todos** os atributos da categoria no ML e, para cada um, faz uma das três coisas:

1. **Preenche com valor real** — quando o cadastro do produto, a derivação determinística ou a IA com certeza conhecem o valor.
2. **Marca "Não se aplica"** — quando o atributo não faz sentido para o produto (ex.: Dosador num shampoo simples, Voltagem em cosmético) ou quando a IA está em dúvida.
3. **Marca "Faltando"** — apenas para atributos **obrigatórios** sem valor confiável. Bloqueia publicação até o lojista preencher.

### O que mudou no resolvedor (`meli-resolve-attributes` v1.9.0)
- Opcionais sem valor agora viram `not_applicable: true` no payload, em vez de serem omitidos.
- IA recebe instrução explícita para devolver `"NAO_SE_APLICA"` quando o atributo não faz sentido para o produto.
- Quando a IA devolve `""` (vazio) para opcional, o sistema converte automaticamente em "Não se aplica" — melhor enviar marcador oficial do que omitir.
- `WARRANTY_TYPE` ganha fallback determinístico `"Sem garantia"` quando o cadastro do produto está vazio (garantia é exigida por lei no ML).

### O que mudou no publicador (`meli-publish-listing` v3.6.0)
- Atributos com `not_applicable: true` viajam ao ML com o **marcador oficial**:
  - Se a categoria tiver opção `"Não se aplica"` / `"N/A"` na lista, usa o `value_id` correspondente.
  - Senão, envia `{ id, value_id: "-1", value_name: "N/A" }` (fallback universal aceito pelo ML).
- Valores fora da lista oficial da categoria são automaticamente substituídos pelo marcador "Não se aplica" (antes eram descartados — gerando o alerta "Corrija características").

### O que mudou no painel (`MeliAttributesPanel`)
- Nova seção colapsada **"Não se aplica"** em cinza, separada dos preenchidos.
- Cada linha "Não se aplica" tem botão de edição manual (lápis) para o lojista corrigir quando a IA errar.
- Cada linha preenchida tem botão **"N/A"** para o lojista marcar manualmente como "Não se aplica" (quando o cadastro estiver errado).
- Resumo no topo agora mostra 4 contadores: ✓ preenchidos, — não se aplica, ⚠ para revisar, ✗ faltando.

### Garantia
Todo produto tem WARRANTY_TYPE preenchido:
- `vendor` → "Garantia do vendedor"
- `factory` → "Garantia de fábrica"
- `none` / vazio → "Sem garantia"
WARRANTY_TIME usa o texto do cadastro (`30 dias`, `3 meses` etc.) ou nada quando vazio.

### Aplicar nos anúncios existentes
Anúncios já publicados não recebem retroativamente. Para corrigir os 21 da remessa anterior: Anúncios → selecionar todos → "Recalcular todos" → "Salvar e publicar".

---

## v2.0.0 — Cadastro Completo como Ficha Primária + Números Regulatórios (2026-06-24)

**Problema resolvido:** mesmo com a v1.9.0, campos que existiam no cadastro (Número ANVISA, Tipo de produto) ainda viravam "Não se aplica" porque (a) o motor não lia o número regulatório do produto, (b) a ficha enviada à IA era resumida demais e (c) o fallback por tokens só funcionava para atributos obrigatórios.

### Regra de negócio
O **cadastro completo do produto** é a ficha primária. A IA passa a receber TUDO que é útil do cadastro: tipo cadastrado, tipo IA, função principal, descrição curta E longa, marca, linha, modelo, conteúdo líquido, garantia, regime regulatório, números ANVISA/AFE/CONAMA, atributos cosméticos, tipos de cabelo, tratamentos, efeitos esperados e composição quando existir. A IA atua como intérprete que escolhe a opção da lista oficial do ML mais próxima do cadastro; "Não se aplica" só é usado quando a ficha inteira não dá nenhuma pista.

### Números regulatórios automáticos
Quando a categoria do ML expõe um atributo com nome contendo "Anvisa + Número/Notificação/Comunicação/Registro/Documento", "AFE + Certificado/Número/Autorização" ou "CONAMA", o sistema preenche automaticamente com o valor salvo em `products.regulatory_info.anvisa` / `.afe` / `.conama`. O match é por **nome do atributo** (não por ID), porque o ML usa IDs diferentes em cada categoria (ex.: `ANVISA_PRIOR_NOTIFICATION_COMMUNICATION_DOCUMENT_NUMBER`, `ANVISA_PRODUCT_REGISTRATION_NUMBER`). Implementado em paralelo no resolver e no publish — mesmo valor, dois caminhos seguros.

### Fallback por tokens estendido a opcionais
Antes, o casamento determinístico por palavras-chave entre o cadastro e a lista oficial do ML só rodava em atributos obrigatórios. Agora roda também em **opcionais de lista fechada** quando há evidência clara no cadastro (`product_type`, `ai_product_type`, `ai_main_function`, `line`, `model`). Para opcional, exige score mínimo 2 — evita N/A indevido sem inventar valor.

### Limite reconhecido — categoria do ML sem o tipo do produto
Se a categoria escolhida no Mercado Livre **não tem** o tipo do produto na lista oficial (ex.: produto "Shampoo" cadastrado em uma categoria de "Tratamentos Capilares" cuja lista oficial só aceita Máscara, Botox, Leave-in etc.), o motor não inventa — marca o atributo como "Não se aplica". A correção é **trocar a categoria do anúncio** no Mercado Livre para uma que aceite o tipo do produto. Esse caso é responsabilidade do lojista na etapa Categorias do assistente.

### Anti-regressão
- Proibido omitir `regulatory_info`, `product_type`, `ai_product_type`, `ai_main_function`, `line`, `model`, `description`, `short_description` do SELECT do resolver — esses campos compõem a ficha primária da IA.
- Proibido remover o casamento por nome do atributo para números regulatórios — IDs do ML variam por categoria.
- Proibido reduzir o fallback por tokens a apenas obrigatórios sem nova auditoria.



---

## v2.1.0 — Memória de Ajustes Manuais por Produto (2026-06-25)

**Problema resolvido:** o lojista corrigia um campo do anúncio (ex.: Tipo de produto → "Kit de tratamento capilar") e, da próxima vez que abrisse o painel de características do **mesmo produto**, a IA voltava a sugerir do zero. Mesmas correções se repetiam a cada anúncio.

### Regra de negócio
Toda edição manual do lojista (incluindo marcar "Não se aplica") é gravada como **preferência da loja para aquele produto + aquela característica**. Da próxima vez que o painel for aberto para o mesmo produto, o valor lembrado já entra preenchido sem chamar a IA.

- Chave: `(tenant, produto, nome da característica)`. Match por **nome** (ML troca IDs entre categorias) com fallback por ID.
- **Última edição vence.** Sem histórico, sem versionamento. Se o lojista corrigir de novo, sobrescreve.
- **Por produto.** Edição em produto A não influencia produto B.
- **Sem mudança de UI/UX.** O rótulo "Editado manualmente" (roxo) já existente continua aparecendo.
- **Limpeza em cascata.** Excluir o produto remove a memória.

### Cascata atualizada do motor de características
```
Cadastro do produto
   ↓
Derivação automática
   ↓
Dicionário universal
   ↓
👉 Memória de ajustes manuais da loja (este produto)   ← NOVO
   ↓
Heurística determinística
   ↓
IA
   ↓
"Não se aplica" (opcionais)
```

A memória entra **antes** da chamada de IA. Match positivo pula a IA inteira para aquela característica — economia de crédito e processamento.

### Compatibilidade com a categoria atual
- **Texto livre** (Marca, Modelo, números regulatórios): aplica direto.
- **Lista fechada**: valida se o valor lembrado existe na lista oficial da categoria atual. Se não existir, a memória é **ignorada** para aquela característica nessa categoria e segue a cascata.
- **Multi-valor**: aplica cada item; só os que casarem com a lista da categoria entram.
- **"Não se aplica"**: usa a opção oficial da categoria quando existe; fallback "Não se aplica".

### Anti-regressão
- Proibido criar UI de listagem/remoção/edição dessa memória sem aprovação explícita.
- Proibido compartilhar memória entre produtos diferentes.
- Proibido versionar/manter histórico — a regra é "última edição vence".
- Proibido aplicar memória da loja **acima** do cadastro/derivação/dicionário (o cadastro do produto continua sendo fonte primária).
- Proibido forçar valor lembrado em lista fechada que não tem o item — sempre validar antes.

### Onde está implementado
- Armazenamento: tabela `meli_product_attribute_memory` (RLS por tenant; ON DELETE CASCADE em `products.id`).
- Captura: `MeliAttributesPanel.handleEdit` e `handleMarkNotApplicable` fazem upsert direto no banco.
- Leitura/aplicação: `supabase/functions/meli-resolve-attributes/index.ts` carrega `tenantMemoryByName`/`tenantMemoryById` no início e aplica como nova etapa **5.0** do loop por atributo, antes da heurística determinística e da IA.

## v2.2.0 — Extração de Ingredientes/Componentes da Descrição (2026-06-26)

### Problema
Em atributos multi-valor de lista fechada como `ACTIVE_INGREDIENTS` (13 opções oficiais: Aloe vera, Cafeína, Pantenol, Queratina, Proteína, Karité etc.), a IA escolhia apenas um item óbvio ("Aloe vera") e ignorava os demais que apareciam na descrição. O contexto enviado à IA não destacava a seção de ingredientes nem orientava o cruzamento sistemático com a lista oficial.

### Solução
1. **Extração estruturada (zero IA).** Helper `extractSubstancesFromDescription` faz regex sobre `description` + `short_description` procurando blocos rotulados como **Ingredientes / Ingredientes ativos / Ativos / Composição / Fórmula / Componentes / Compostos / Tecnologia / Materiais**. Splita por vírgula, ponto-e-vírgula, " e ", "/", "+", bullets e quebras de linha. Resultado: array `ingredientes_extraidos_texto`.
2. **Rótulo correto por natureza do produto.** Helper `substanceLabelForProduct` mapeia `product_type`/`ai_product_type`/`regulatory_category`/categoria universal para o rótulo certo:
   - cosmético/capilar/pele → "ingredientes ativos"
   - suplemento/alimento → "compostos / nutrientes"
   - eletrônico/equipamento → "componentes / materiais"
   - roupa/tecido → "materiais"
   - default → "componentes"
3. **Regra explícita no prompt.** Para qualquer atributo cujo NOME ou ID contenha ingrediente/ativo/composição/componente/material/compostos/fórmula (inclusive `ACTIVE_INGREDIENTS`, `INGREDIENTS`, `MATERIALS`, `COMPONENTS`), a IA deve:
   - Cruzar CADA item de `ingredientes_extraidos_texto` com a lista oficial `values`.
   - Normalizar antes (case, acento, espaço, sinônimos óbvios: AloeVera↔Aloe vera, B5↔Pantenol, Vit E↔Vitamina E, Karité↔Manteiga de Karité).
   - Quando `multi=true`, devolver TODOS os matches separados por vírgula — nunca parar no primeiro.
   - Ignorar itens da descrição que não estão na lista oficial. Proibido inventar opção fora de `values`.
   - Fallback: se `ingredientes_extraidos_texto` for nulo, varrer descrições inteiras procurando ocorrências da lista oficial.

### Onde está implementado
- `supabase/functions/meli-resolve-attributes/index.ts` (helpers `extractSubstancesFromDescription` e `substanceLabelForProduct`; campos `ingredientes_extraidos_texto` e `rotulo_de_substancias` no `productContext`; regra no prompt da etapa 6).
- Memória manual por produto (v2.1.0) continua tendo prioridade absoluta — a extração só roda quando o atributo está pendente após cadastro/derivação/dicionário/memória.

### Resultado esperado
Em "Balm Pós-Banho Calvície Zero" (descrição com Cafeína, Aloe vera, Alecrim, Mentol, Cetoconazol, BPantol, BIOEX, Proteção UV), `ACTIVE_INGREDIENTS` passa a sugerir **"Aloe vera, Cafeína, Proteína"** (os 3 itens que casam com a lista oficial do ML) em vez de só "Aloe vera". Em produtos não-cosméticos, o mesmo motor funciona usando o rótulo correto para a natureza do produto.

## v2.4.0 — ANVISA Único + Pipeline Determinístico de Substâncias (2026-06-27)

### Problemas resolvidos
1. **ANVISA duplicada.** Em categorias que expõem dois atributos Anvisa (`ANVISA_PRIOR_NOTIFICATION_COMMUNICATION_DOCUMENT_NUMBER` + `ANVISA_PRODUCT_REGISTRATION_NUMBER`), a heurística por nome casava com ambos e o mesmo número era enviado duas vezes — confundindo o lojista no painel.
2. **Ingredientes incompletos.** O cruzamento contra a lista oficial dependia 100% do prompt da IA. A IA agia de forma conservadora e devolvia só 1 item ("Aloe vera"), ignorando Cafeína, Pantenol, etc. que estavam claramente na descrição.

### Solução
**ANVISA — atributo único por categoria.** Antes do loop de resolução, `pickAnvisaAttrId(meliAttrs)` escolhe **UM** atributo da categoria para receber o número, na hierarquia: (1) qualquer obrigatório → (2) notificação/comunicação prévia → (3) primeiro disponível (geralmente registro). O atributo escolhido recebe `regulatory_info.anvisa`; o outro fica vazio e segue a cascata normal (vira "Não se aplica" no final). Isso reflete a realidade do negócio: no Brasil, o número de notificação e o de registro são o **mesmo identificador** após registrado — basta um campo preenchido.

**Substâncias — dicionário determinístico antes da IA.** Para qualquer atributo de natureza substância (`ACTIVE_INGREDIENTS`, `INGREDIENTS`, `MATERIALS`, `COMPONENTS`, `MAIN_INGREDIENTS` ou cujo nome contenha ingrediente/ativo/composição/componente/material/fórmula/composto) **com lista fechada**, antes de mandar à IA o motor executa `crossReferenceClosedList`:
- Para cada valor oficial da categoria, monta um conjunto de aliases a partir de `SUBSTANCE_SYNONYMS` (Pantenol ↔ B5/BPantol/Vitamina B5/D-Pantenol; Aloe vera ↔ AloeVera/Babosa; Vitamina E ↔ Tocoferol; etc. — ~30 ativos cobertos).
- Casa cada alias contra `description + short_description + name + ingredientes_extraidos_texto` usando regex com fronteira de token (não casa substring acidental).
- Quando casa ≥1 valores, preenche o atributo direto com `source: "derivation"` (sem chamar a IA). Multi-valor pega todos; mono-valor pega o primeiro.

A IA continua sendo o fallback quando o dicionário não casa nada — útil para sinônimos novos que ainda não estão no dicionário.

### Ordem final de prioridade (atributos de substância com lista fechada)
1. Memória manual do lojista (v2.1.0).
2. Dicionário universal por `universal_key` (v2.0.0).
3. Heurísticas por ID/nome do atributo (BRAND, GTIN, MODEL, ANVISA único, etc.).
4. **Dicionário de sinônimos de substâncias (novo v2.4.0).**
5. IA (com prompt orientado a cruzamento + extração estruturada da v2.2.0).
6. "Não se aplica" / "missing" para opcionais/obrigatórios sem evidência.

### Onde está implementado
- `supabase/functions/meli-resolve-attributes/index.ts`:
  - Constantes `ANVISA_NUMBER_ATTR_IDS` e `SUBSTANCE_SYNONYMS` no topo.
  - `pickAnvisaAttrId(attrs)`, `crossReferenceClosedList(attr, texts)`, `isSubstanceAttribute(a)`.
  - Loop principal usa `selectedAnvisaAttrId` no bloco regulatório.
  - Pipeline determinístico de substâncias roda imediatamente antes de `aiPending.push(a)`.

### Resultado esperado
- "Balm Pós-Banho Calvície Zero" (descrição com BPantol, Cafeína, AloeVera, Alecrim) → `ACTIVE_INGREDIENTS` preenchido com **"Pantenol, Cafeína, Aloe vera, Alecrim"** sem depender da IA.
- ANVISA aparece **uma única vez** no painel, no atributo escolhido pela categoria.
- Redução de chamadas à IA para atributos de substância → custo menor e resultado determinístico (mesma entrada → mesma saída).

## v2.4.1 — Cache Versionado do Painel de Características (2026-06-27)

### Problema resolvido
O ajuste v2.4.0 estava correto no motor, mas rascunhos já existentes — caso real do **Balm Pós-Banho Calvície Zero** — continuavam mostrando o resultado antigo porque o painel reaproveitava `attributes` salvos no anúncio. Como esses dados antigos tinham sido persistidos antes da correção, a reabertura do diálogo não chamava o motor novo. Resultado: o lojista via dois números ANVISA e apenas um ingrediente ativo, mesmo após a atualização do classificador.

### Regra nova
- Todo cache salvo pelo painel recebe uma versão interna de resolução.
- O motor `meli-resolve-attributes` também devolve `resolver_version` em cada atributo, garantindo que o resultado recém-calculado já chegue ao painel marcado como cache atual.
- Ao reabrir um rascunho, o painel só reaproveita características salvas se a versão do cache for compatível com a versão atual do motor.
- Cache legado/incompatível é recalculado **uma única vez**; depois o novo resultado é salvo com a versão atual e volta a abrir sem custo de IA.
- Clicar em **Recalcular** continua sendo ação explícita do lojista e sempre força nova resolução.

### Blindagens adicionais
- Campo ANVISA não escolhido pela categoria é ignorado completamente: não aparece no painel, não vai para IA e não é enviado como "Não se aplica".
- O publicador limpa metadados internos do cache antes de enviar atributos ao Mercado Livre. Somente `id`, `value_id`, `value_name` e `values` saem para a API externa.

### Anti-regressão
- Proibido tratar `attributes.length > 0` como cache válido sem verificar versão.
- Proibido enviar metadados internos do painel ao Mercado Livre.
- Mudança estrutural no motor de atributos deve incrementar a versão do cache do painel quando alterar o significado do resultado salvo.

