# Campanhas (Criador de Campanhas) — Regras e Especificações

> **Status:** 🟩 Atualizado  
> **Última atualização:** 2026-03-31

---

## Visão Geral

Sistema de planejamento e criação de campanhas de marketing com IA, dividido em quatro módulos:

1. **Campanhas** (`/campaigns`) - IA Estrategista para tráfego pago
2. **Mídias Sociais** (`/media`) - Calendário editorial para Facebook, Instagram e YouTube (EXCLUSIVO redes sociais, SEM Blog)
3. **Campanhas Blog** (`/blog/campaigns`) - Calendário editorial para posts de blog (ver `docs/regras/blog.md`)
4. **YouTube** - Upload e agendamento de vídeos no canal (integrado ao módulo Mídias Sociais)

---

## Arquivos Principais

### Mídias Sociais (Facebook/Instagram/YouTube)

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/Media.tsx` | Página principal — lista de campanhas direta (sem abas) |
| `src/hooks/useMediaCampaigns.ts` | Hook CRUD campanhas |
| `src/hooks/useMetaConnection.ts` | Hook de conexão Meta (OAuth, status, assets) |
| `src/components/media/CampaignCalendar.tsx` | Calendário visual com barra de ações progressiva |
| `src/components/media/CampaignsList.tsx` | Lista de campanhas |
| `src/components/media/CalendarItemDialog.tsx` | Dialog de edição manual (copy + upload de criativo) |
| `src/components/media/ApprovalDialog.tsx` | Dialog visual de aprovação com thumbnails e resumo |
| `src/components/media/PublicationDialog.tsx` | Dialog de publicação |
| `supabase/functions/media-generate-suggestions/` | IA Especialista em Estratégia de Conteúdo |
| `supabase/functions/media-generate-copys/` | IA Especialista em Copywriting |
| `supabase/functions/meta-publish-post/` | Publicação nativa Meta (Facebook + Instagram) |
| `supabase/functions/youtube-upload/` | Upload para YouTube |

### Campanhas Blog

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/BlogCampaigns.tsx` | Lista de campanhas de blog |
| `src/pages/BlogCampaignDetail.tsx` | Detalhe com calendário |
| `supabase/functions/media-publish-blog/` | Publicação em blog_posts |

### YouTube Integration

| Arquivo | Propósito |
|---------|-----------|
| `src/hooks/useYouTubeConnection.ts` | Hook para OAuth e status |
| `src/components/integrations/YouTubeSettings.tsx` | UI de configuração |
| `supabase/functions/youtube-oauth-start/` | Início do OAuth |
| `supabase/functions/youtube-oauth-callback/` | Callback OAuth |
| `supabase/functions/youtube-upload/` | Upload de vídeos |

---

## Módulo 1: Campanhas (IA Estrategista)

### Abas

| Aba | Propósito |
|-----|-----------|
| **Campanhas** | Estruturação de campanhas para Meta/Google/TikTok |
| **Personas** | Criação de personas com IA (dores, desejos, objeções) |
| **Ângulos** | Ângulos de copy (urgência, prova social, autoridade) |

### Status Atual
> Em construção - interface básica implementada, lógica de IA pendente.

---

## Módulo 2: Gestor de Mídias IA (`/media`)

### Arquitetura (SEM ABAS)

A página `/media` exibe a **lista de campanhas diretamente**, sem sistema de abas. Todo o fluxo (estratégia, copys, criativos, publicação) acontece **dentro do calendário de cada campanha**.

> **PROIBIDO:** Adicionar abas na página `/media`. O fluxo é sequencial dentro do calendário.

### Fluxo Principal — Dual (Manual + IA)

O calendário editorial suporta **dois fluxos paralelos** que podem ser combinados:

#### Fluxo Manual (sempre disponível)

```text
/media/campaign/:id (calendário editorial)
  │
  1. Clicar no dia → criar item (título, tipo, data)
     - Copy é OPCIONAL neste momento
  │
  2. Abrir item existente → preencher copy, CTA, hashtags
  │
  3. Abrir item → upload de criativo (imagem/vídeo)
     - Upload via sistema universal (arquivo local, Meu Drive, URL)
     - Preview da imagem/vídeo diretamente no dialog
  │
  4. Aprovar items prontos
  │
  5. Publicar/Agendar
```

#### Fluxo IA (botões na barra de ações)

```text
/media/campaign/:id (calendário editorial)
  │
  1. Selecionar dias no calendário
  │
  2. "Gerar Estratégia IA" → cria items (título, tema, tipo)
  │
  3. "Gerar Copys IA" → preenche copy, CTA, hashtags dos items existentes
  │
  4. "Gerar Criativos IA" → gera imagens para os items
  │
   5. "Aprovar" → marca items como aprovados
   │
   6. "Finalizar Campanha" → agenda TODOS os items aprovados:
      - Qualquer item com data/hora futura → entra como agendado
      - Itens com data/hora já passada → publicados imediatamente
      - Publicações imediatas usam intervalo curto apenas para evitar limite externo; agendamentos futuros não esperam em fila dentro da requisição
```

> **IMPORTANTE:** Os fluxos podem ser combinados. Ex: criar estratégia com IA, mas escrever copys manualmente e subir criativos próprios.

### Indicadores Visuais no Calendário

#### Status por Cor (Borda e Fundo do Dia)

Cada dia no calendário recebe estilização baseada no status dominante dos seus items:

| Cor | Status | Classe CSS |
|-----|--------|------------|
| 🟢 Verde | Publicado (`published`) | `border-green-500`, `bg-green-50` |
| 🔵 Azul | Agendado/Publicando (`scheduled`, `publishing`) | `border-blue-500`, `bg-blue-50` |
| 🟡 Âmbar | Aprovado (`approved`) | `border-amber-500`, `bg-amber-50` |
| 🔴 Vermelho | Falha (`failed`) | `border-red-500`, `bg-red-50` |
| ⚪ Cinza | Rascunho/Sugestão (`draft`, `suggested`) | `border-gray-300`, `bg-gray-50` |

#### Dots de Status por Item

Dentro de cada dia, uma linha de "dots" coloridos mostra a contagem por status com `Tooltip` descritivo (ex: "2 publicado(s)").

#### Badges de Completude (DayPostsList)

Cada item no dialog de detalhes mostra badges:

| Badge | Condição |
|-------|----------|
| `"Sem copy"` | Item tem título mas `copy` está vazio |
| `"Sem criativo"` | Item não tem `asset_url` |
| `"✓ Criativo"` | Item tem `asset_url` preenchida |

#### Legenda do Calendário

O calendário inclui uma legenda fixa no rodapé com todos os status e suas cores correspondentes.

### Barra de Ações Progressiva (CampaignCalendar.tsx)

Os botões seguem ordem sequencial e só ficam ativos quando o passo anterior está concluído:

| Passo | Botão | Condição de Ativação |
|-------|-------|---------------------|
| 1 | Selecionar Dias | Calendário interativo |
| 2 | Gerar Estratégia IA | Dias selecionados no calendário → abre dialog de prompt de direcionamento |
| 3 | Gerar Copys IA | Items existem com título mas sem copy |
| 4 | Gerar Criativos IA | Items têm copy preenchida |
| 5 | Aprovar | Items com copy e/ou criativo prontos → abre `ApprovalDialog` com resumo visual |
| 6 | Finalizar Campanha | Items aprovados |

#### Aprovação e Publicação (`ApprovalTab`)

- A lista de itens aprovados usa o rótulo **"Prontos para Publicar"**.
- O CTA principal dessa etapa usa o texto **"Agendar"**.
- Quando o agendamento falhar, a tela deve manter a seleção e exibir o primeiro motivo retornado, sem encerrar o fluxo em silêncio.

#### Diagnóstico de Seleção (SelectionDiagnostics)

Quando o usuário seleciona dias no calendário, dois feedbacks visuais são exibidos:

**1. Linha de contadores (abaixo dos botões de ação)**

Uma linha compacta de badges coloridos mostra o resumo da seleção:

| Badge | Cor | Significado |
|-------|-----|-------------|
| ✅ X prontos | Verde | Têm estratégia + copy + criativo |
| 📝 X sem copy | Âmbar/Amarelo | Têm estratégia mas faltam copys |
| 🖼 X sem criativo | Laranja | Têm copy mas faltam criativos |
| ❌ X sem estratégia | Vermelho | Sem título/estratégia definida |
| X dias vazios | Cinza | Dias selecionados sem publicações |

**2. Coloração dos cards do calendário (somente quando selecionados)**

Os cards dos dias selecionados mudam de cor conforme o status dos itens contidos, seguindo hierarquia de criticidade:

| Cor do card | Condição (prioridade) |
|-------------|----------------------|
| 🔴 Vermelho | Algum item sem estratégia (sem título) |
| 🟡 Amarelo | Algum item sem copy |
| 🟠 Laranja | Algum item sem criativo (exceto posts de texto) |
| 🟢 Verde | Todos os itens 100% prontos |
| ⚪ Cinza | Dia selecionado mas vazio (sem itens) |

Cards não selecionados mantêm a aparência padrão (sem coloração de status).

**Botões inteligentes**: Os botões "Copys IA" e "Criativos IA" ficam visualmente atenuados (opacity + tooltip explicativo) quando nenhum card elegível existe na seleção. Não bloqueiam quando há pelo menos 1 item elegível (regeneração parcial funciona).

**Arquivos**: `src/components/media/SelectionDiagnostics.tsx`, `src/components/media/PlanningTab.tsx`


#### IA de Estratégia (`media-generate-suggestions`)

Especialista em **planejamento editorial**. Gera APENAS:
- Título do post
- Tema/assunto
- Tipo de conteúdo (image, video, carousel, story, reel)
- Plataformas alvo
- Flag `needs_product_image` (true/false)
- **Horário estratégico de publicação (`scheduled_time`)** — baseado em pesquisas de engajamento por dia da semana e tipo de conteúdo

**NÃO gera:** copy, legendas, CTAs, hashtags ou prompts de criativos (isso é responsabilidade da IA de Copys).
**NÃO gera posts de Blog** — o módulo Mídias é EXCLUSIVO para redes sociais. Blog tem módulo dedicado (`/blog/campaigns`).

Considera:
- Datas comemorativas e sazonalidade
- Equilíbrio entre conteúdo educativo, promocional e engajamento
- Distribuição entre stories e feed (Instagram/Facebook)
- Tendências do nicho
- **Horários de pico de engajamento por dia da semana** (dados Buffer/SocialPilot 2025-2026)
- **Variação de horários entre Feed e Stories** (Feed em janelas de pico; Stories distribuídos ao longo do dia)
- **Datas especiais** — publicação 1-2h antes do pico para captar tráfego antecipado

Filtro de segurança: mesmo que a IA retorne items com `target_channel: "blog"`, eles são descartados automaticamente antes do insert.

#### IA de Copywriting (`media-generate-copys`)

Especialista em **copywriting para redes sociais**. Recebe items que já têm título/tema e gera:
- **Copy/legenda** otimizada por plataforma (Instagram 2200 chars, Facebook ilimitado)
- **CTA** persuasivo
- **Hashtags** relevantes (mix de volume alto e nicho)
- **Prompt de criativo (generation_prompt)** detalhado para geração de imagem posterior

**Catálogo de Produtos Real:**
A IA consulta o catálogo de produtos ativos do tenant (`products` table, `status = 'active'`) e injeta os nomes e preços reais no prompt. Regras:
- **PROIBIDO** inventar produtos que não existem no catálogo
- Deve usar os **nomes exatos** dos produtos cadastrados
- Se o catálogo estiver vazio, gera conteúdo genérico sem mencionar produtos específicos

**Produto Imutável na Geração de Criativos:**
O pipeline de geração de imagens (`media-process-generation-queue`) trata o produto como **SAGRADO e IMUTÁVEL**:
- A IA **NÃO PODE** redesenhar, recriar ou alterar a embalagem/rótulo/formato do produto
- A IA **NÃO PODE** criar variações fictícias do produto (frascos diferentes, tamanhos diferentes)
- A IA **PODE APENAS** mudar ambiente, cenário, iluminação e contexto ao redor do produto
- O QA Scorer penaliza severamente (LABEL 0-2) qualquer alteração no produto

Técnicas utilizadas:
- AIDA (Atenção, Interesse, Desejo, Ação)
- PAS (Problema, Agitação, Solução)
- Storytelling
- Emojis estratégicos
- Tom de voz adaptado ao nicho da loja

### CalendarItemDialog (Edição Manual de Item)

O dialog de edição manual (`CalendarItemDialog.tsx`) permite:
- **Título e tipo de conteúdo** (obrigatório)
- **Copy, CTA, hashtags** (opcional — pode ser preenchido depois)
- **Upload de criativo** (imagem/vídeo) via sistema universal de upload
  - Preview visual da imagem/vídeo diretamente no dialog com `object-contain` (sem corte)
  - Suporta arquivo local e Meu Drive
- **NÃO auto-aprova** — o item fica como `draft` ou `suggested` até o usuário aprovar manualmente
- **Exclusivo para redes sociais** — NÃO inclui opções de Blog (Blog tem módulo dedicado)

### ApprovalDialog (Aprovação Visual)

O dialog de aprovação (`ApprovalDialog.tsx`) exibe um **resumo visual** das postagens pendentes:
- **Thumbnails** dos criativos gerados ou uploaded
- **Título, copy (preview), plataformas e horário** de cada item
- **Multi-select** com checkboxes individuais e "Selecionar todos"
- **Badge** com contagem de selecionados
- Aprovação em lote — apenas items selecionados são marcados como `approved`

> **PROIBIDO:** Auto-aprovar items sem revisão visual. O fluxo SEMPRE passa pelo ApprovalDialog.

### Regra de Separação de Módulos

O módulo Gestor de Mídias IA **NÃO** importa componentes do módulo Gestão de Criativos (`src/components/creatives/*`). São módulos independentes.

### Tabelas

#### media_campaigns

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `name` | TEXT | Nome da campanha |
| `prompt` | TEXT | Prompt de direcionamento (preenchido no Passo 2 — Estratégia IA, NÃO na criação) |
| `start_date` | DATE | Início |
| `end_date` | DATE | Fim |
| `days_of_week` | INT[] | Dias ativos (0-6) |
| `status` | ENUM | `draft`, `planning`, `generating`, `ready`, `active` |
| `target_channel` | ENUM | `all`, `facebook`, `instagram`, `youtube` (SEM blog — blog tem módulo dedicado) |
| `auto_publish` | BOOLEAN | Publicação automática |

#### media_calendar_items

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `campaign_id` | UUID | FK campaign |
| `scheduled_date` | DATE | Data agendada |
| `scheduled_time` | TIME | Horário |
| `content_type` | ENUM | `image`, `video`, `carousel`, `story`, `reel`, `text` |
| `title` | TEXT | Título |
| `copy` | TEXT | Texto do post / Descrição do vídeo |
| `cta` | TEXT | Call-to-action |
| `hashtags` | TEXT[] | Hashtags / Tags do YouTube |
| `generation_prompt` | TEXT | Prompt para imagem ou notas/roteiro |
| `asset_url` | TEXT | URL do asset gerado ou vídeo |
| `status` | ENUM | `draft`, `suggested`, `approved`, `published` |
| `target_channel` | ENUM | Canal alvo (`youtube`, `blog`, etc.) |

#### social_posts

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `calendar_item_id` | UUID | FK media_calendar_items (nullable) |
| `platform` | TEXT | `facebook` ou `instagram` |
| `post_type` | TEXT | `feed`, `story`, `reel`, `carousel` |
| `caption` | TEXT | Texto do post |
| `media_urls` | TEXT[] | URLs das mídias |
| `status` | TEXT | `draft`, `scheduled`, `publishing`, `published`, `failed` |
| `meta_post_id` | TEXT | ID retornado pela Meta após publicação |
| `api_response` | JSONB | Response completo da API (evidência App Review) |
| `error_message` | TEXT | Mensagem de erro (se failed) |
| `scheduled_at` | TIMESTAMPTZ | Horário agendado |
| `published_at` | TIMESTAMPTZ | Horário efetivo da publicação |
| `created_at` | TIMESTAMPTZ | Criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |

### Enums

```sql
CREATE TYPE media_campaign_status AS ENUM (
  'draft', 'planning', 'generating', 'ready', 
  'active', 'paused', 'completed', 'archived'
);

CREATE TYPE media_item_status AS ENUM (
  'draft', 'suggested', 'review', 'approved',
  'generating_asset', 'scheduled', 'publishing',
  'published', 'failed', 'skipped'
);

CREATE TYPE media_content_type AS ENUM (
  'image', 'video', 'carousel', 'story', 'reel', 'text'
);
```

---

## Fluxos

### Criação de Campanha de Mídia (Redes Sociais)

```
1. Admin cria campanha com:
   - Nome e mês (período)
   - Canal alvo (Instagram, Facebook, YouTube)
   - **NÃO inclui prompt** — prompt é exclusivo do Passo 2
   ↓
2. Fluxo IA (sequencial):
   a. "Gerar Estratégia IA" → abre dialog de prompt de direcionamento → cria items com título, tema, content_type
   b. "Gerar Copys IA" → preenche copy, CTA, hashtags, generation_prompt
   c. "Gerar Criativos IA" → gera imagens
   d. "Aprovar" → marca items como aprovados
   e. "Publicar" → publica nas redes
   ↓
   OU
   ↓
2. Fluxo Manual:
   a. Clicar no dia → criar item
   b. Preencher título, copy, CTA, hashtags
   c. Upload de criativo próprio
   d. Aprovar → Publicar
```

### Fluxo YouTube (Vídeos)

```
1. Campanha com target_channel = "youtube"
   ↓
2. Criar itens no calendário (tipo: vídeo)
   - Título, descrição, tags
   - Upload do arquivo de vídeo
   ↓
3. Aprovar item
   ↓
4. youtube-upload:
   - Verifica saldo de créditos (16+ por vídeo)
   - Reserva créditos
   - Upload resumable para YouTube
   - Consome créditos
   - Status → "published"
```

---

## Integração Meta Nativa (Facebook + Instagram)

### Edge Function: `meta-publish-post`

```typescript
POST /meta-publish-post
{
  "tenant_id": "...",
  "calendar_item_id": "...",       // opcional
  "platform": "facebook" | "instagram",
  "post_type": "feed" | "story" | "reel" | "carousel",
  "caption": "Texto do post...",
  "media_urls": ["https://..."],   // URLs públicas das mídias
  "scheduled_at": "2026-02-15T10:00:00Z"  // opcional (se omitido, publica imediatamente)
}
```

### Plataformas

| Plataforma | API | Tipos Suportados |
|------------|-----|------------------|
| **Facebook** | Pages API (`/{page-id}/feed`, `/{page-id}/photos`, `/{page-id}/videos`) | feed (texto, imagem, vídeo, link) |
| **Instagram** | Instagram Graph API (`/{ig-user-id}/media`, `/{ig-user-id}/media_publish`) | feed, story, reel, carousel |

### Lógica de Publicação Multi-Plataforma (v2.4.0)

A Edge Function `meta-publish-post` avalia **AMBOS** `target_channel` e `target_platforms` para decidir onde publicar:

```
shouldPublishInstagram = target_channel inclui "instagram" OU target_platforms contém "instagram_*"
shouldPublishFacebook  = target_channel inclui "facebook" OU target_platforms contém "facebook"
```

**Registro em `social_posts`:** Um registro separado é criado para CADA plataforma (Instagram e Facebook), permitindo rastreio independente de status e evidências para App Review.

### Lógica de Agendamento vs. Publicação Imediata

| Condição | Comportamento | Status do Item |
|----------|---------------|----------------|
| `scheduled_at` > 2 min no futuro (Facebook) | Se > 10 min: agendamento nativo Meta. Se 2-10 min: status `scheduled`, delegado ao worker. | `scheduled` (Azul) |
| `scheduled_at` > 2 min no futuro (Instagram) | Status `scheduled`, delegado ao worker `media-social-publish-worker` | `scheduled` (Azul) |
| `scheduled_at` ≤ 2 min no futuro ou passado | Publicação imediata | `published` (Verde) |

**REGRA CRÍTICA:** Itens agendados para o futuro **NUNCA** devem ficar com status `published` (Verde) antes do horário. Devem permanecer `scheduled` (Azul) até a publicação efetiva pelo worker.

### Worker de Publicação Automática: `media-social-publish-worker`

Cron job que roda a cada **5 minutos** e publica posts agendados cujo horário já chegou.

| Plataforma | Comportamento |
|------------|---------------|
| **Instagram** | Cria container + publica via Graph API (container flow completo) |
| **Facebook (com meta_post_id)** | Verifica se o Facebook já publicou nativamente, atualiza status |
| **Facebook (sem meta_post_id)** | Publica imediatamente via Pages API |

Após publicar todos os `social_posts` de um `calendar_item`, atualiza o status do item no calendário para `published`.

**Arquivo:** `supabase/functions/media-social-publish-worker/index.ts`
**Cron:** `*/5 * * * *` (a cada 5 minutos)
**Limite por execução:** 20 posts (para evitar timeout)

### Facebook: Gap de Agendamento Nativo

O Facebook exige mínimo de **10 minutos** para agendamento nativo via API. Para itens entre 2-10 minutos no futuro:
- Status é marcado como `scheduled`
- Publicação é delegada ao worker `media-social-publish-worker`
- Isso evita rejeição pela API da Meta

### Fluxo Instagram (Container Flow)

```
1. Criar Container de Mídia
   POST /{ig-user-id}/media
   { image_url, caption, media_type }
   → retorna container_id
   ↓
2. Aguardar processamento (polling)
   GET /{container_id}?fields=status_code
   → aguardar status_code = "FINISHED"
   ↓
3. Publicar Container
   POST /{ig-user-id}/media_publish
   { creation_id: container_id }
   → retorna post_id (salvo como meta_post_id)
```

### Escopos OAuth Necessários

| Escopo | Propósito |
|--------|-----------|
| `pages_manage_posts` | Publicar em Páginas do Facebook |
| `pages_read_engagement` | Ler métricas de posts |
| `instagram_basic` | Acesso básico ao Instagram |
| `instagram_content_publish` | Publicar conteúdo no Instagram |
| `instagram_manage_insights` | Métricas do Instagram |

### Tabelas de Conexão

| Tabela | Propósito |
|--------|-----------|
| `marketplace_connections` | Tokens OAuth Meta por tenant (marketplace = 'meta') |
| `social_posts` | Registro de publicações com evidências para App Review |

---

## Integração YouTube

| Função | Propósito |
|--------|-----------|
| `youtube-oauth-start` | Início OAuth com Google |
| `youtube-oauth-callback` | Callback OAuth e salvamento de tokens |
| `youtube-upload` | Upload de vídeo com metadados |

### Consumo de Créditos (YouTube)

| Operação | Créditos | Descrição |
|----------|----------|-----------|
| Upload base | 16 | Custo mínimo por vídeo |
| +Thumbnail | 1 | Upload de thumbnail customizada |
| +1GB de vídeo | 1 | Overhead por tamanho |

### Tabelas YouTube

| Tabela | Propósito |
|--------|-----------|
| `youtube_connections` | Tokens OAuth por tenant |
| `youtube_uploads` | Fila de uploads assíncronos |
| `youtube_oauth_states` | Estados OAuth temporários |

---

## Calendário Visual

O calendário editorial usa `MonthlyCalendar` (componente unificado — ver `regras-gerais.md` § MonthlyCalendar) como base para a grade mensal. Os componentes `PlanningTab` e `TrackingTab` injetam conteúdo específico via render prop `renderDayContent`.

```tsx
<MonthlyCalendar
  month={currentMonth}
  onMonthChange={setCurrentMonth}
  renderDayContent={(day) => <PlanningDayContent day={day} items={...} />}
/>
```

### DayPostsList (Dialog de Items do Dia)

O dialog segue o **padrão `max-h-[90vh]`** com:
- `flex flex-col overflow-hidden` no `DialogContent`
- Área de conteúdo com `flex-1 overflow-y-auto` (scroll interno)
- Rodapé fixo com botões de ação sempre visíveis
- Largura `sm:max-w-[600px]` para melhor legibilidade

---

## Geração de Criativos (Imagens) — Dual Provider v5.0

### Arquitetura Compartilhada

A geração de imagens usa a **mesma arquitetura dual-provider** em ambos os módulos:

| Módulo | Edge Function | Versão |
|--------|---------------|--------|
| **Gestão de Criativos** (`/creatives`) | `creative-image-generate` | v3.0 |
| **Gestor de Mídias IA** (`/media`) | `media-process-generation-queue` | v5.0 |

### Provedores via Lovable AI Gateway

| Provider | Modelo | Uso |
|----------|--------|-----|
| **Gemini Flash** | `google/gemini-2.5-flash-image` | Geração rápida (padrão) |
| **OpenAI (Gemini Pro)** | `google/gemini-3-pro-image-preview` | Alta qualidade, fotorrealismo |
| **QA Scorer** | `google/gemini-3-flash-preview` | Avaliação de realismo automática |

### Pipeline de Geração

```
1. DOWNLOAD: Baixar imagem do produto como referência (se aplicável)
2. GENERATE: Gerar com AMBOS provedores em PARALELO
3. QA SCORE: Avaliar realismo de cada resultado
   - Realism: 40% (parece foto real?)
   - Label: 25% (rótulo fiel?)
   - Quality: 20% (nitidez, resolução)
   - Composition: 15% (enquadramento)
4. SELECT: Escolher WINNER pelo maior score overall
5. UPLOAD: Salvar winner + runner-up no storage
6. UPDATE: Atualizar calendar_item com asset_url do winner
```

### Score Mínimo de Aprovação: **70%**

### Comportamento por Cenário

| Cenário | Comportamento |
|---------|---------------|
| Com produto (referência) | Envia imagem base64 + prompt → composição fiel |
| Sem produto | Text-to-image puro |
| Kit (múltiplos produtos) | Prompt adaptado: flatlay/bancada, proibido segurar múltiplos |

### Custos Estimados

| Configuração | Custo |
|--------------|-------|
| 1 provedor (Gemini Flash) | ~R$ 0,17/imagem |
| 1 provedor (OpenAI/Pro) | ~R$ 0,35/imagem |
| Dual provider + QA | ~R$ 0,60/imagem |

> **IMPORTANTE:** Ambos módulos usam `LOVABLE_API_KEY` (auto-configurada). Não requer API key externa.

---

## Geração de Vídeos IA (v2.0)

O módulo de Mídias inclui geração de vídeos com pipeline de alta fidelidade:

### Tabelas

| Tabela | Propósito |
|--------|-----------|
| `media_category_profiles` | Perfis de nicho com pesos de QA |
| `media_preset_components` | Componentes modulares (cena, luz, câmera, narrativa) |
| `media_video_presets` | Presets compostos para geração |
| `media_video_jobs` | Jobs de geração com pipeline de 6 estágios |
| `media_video_candidates` | Candidatos gerados com scores de QA |

### Pipeline de 6 Estágios

```
1. PREPROCESS → Preparar cutout/mask do produto
2. REWRITE → Converter prompt em shot_plan estruturado
3. GENERATE_CANDIDATES → Gerar N variações
4. QA_SELECT → Avaliar com IA vision (similarity + OCR + quality)
5. RETRY → Tentativa extra com fidelidade rígida (se QA falhar)
6. FALLBACK → Composição do produto sobre cenário gerado
```

### Pesos de QA por Nicho

| Nicho | Similaridade | OCR Rótulo | Qualidade | Estabilidade |
|-------|--------------|------------|-----------|--------------|
| Foco no Produto | 45% | 30% | 25% | 0% |
| Lifestyle | 35% | 25% | 30% | 10% |
| Storytelling | 30% | 20% | 35% | 15% |

### Arquivos

| Arquivo | Propósito |
|---------|-----------|
| `supabase/functions/media-video-generate/` | Edge Function do pipeline |
| `src/hooks/useMediaVideoCreatives.ts` | Hooks React |
| `src/components/media/MediaVideoJobsList.tsx` | Lista de jobs com progresso |

---

## Separação de Fluxos: Blog vs. Mídias vs. YouTube

O `PublicationDialog` recebe a prop `campaignType` para diferenciar o fluxo:

| `campaignType` | Comportamento |
|----------------|---------------|
| `"blog"` | Vai direto para formulário de artigo (título + conteúdo) |
| `"social"` | Exibe seleção de tipo (Feed/Stories) → seleção de canais (Instagram/Facebook) → detalhes |
| `"youtube"` | Vai direto para formulário de vídeo (título + descrição + tags) |

### Regras de Isolamento

| ✅ Correto | ❌ Proibido |
|-----------|-------------|
| Blog mostra apenas formulário de artigo | Blog mostrar opções Feed/Stories/YouTube |
| Mídias mostra apenas Feed/Stories | Mídias mostrar opção de Blog ou YouTube |
| YouTube mostra apenas formulário de vídeo | YouTube mostrar opções de outras plataformas |
| Cada módulo usa sua Edge Function | Misturar `meta-publish-post` com `youtube-upload` |

### Implementação

```tsx
// CampaignCalendar.tsx
<PublicationDialog
  campaignType={
    campaign?.target_channel === "blog" ? "blog" : 
    campaign?.target_channel === "youtube" ? "youtube" : 
    "social"
  }
  ...
/>
```

---

## Edge Functions

### `media-generate-suggestions` (IA Estrategista)

```typescript
POST /media-generate-suggestions
{
  "campaign_id": "...",
  "tenant_id": "...",
  "selected_dates": ["2026-03-01", "2026-03-03", ...],
  "prompt": "Direcionamento opcional da estratégia (capturado no dialog do Passo 2)"
}
```

Gera APENAS: título, tema, content_type, target_platforms, **scheduled_time** (horário estratégico).
**NÃO gera copy, CTA ou hashtags.**

**Horários Estratégicos:** A IA recebe um guia de horários de pico por dia da semana (baseado em dados de engajamento 2025-2026) e escolhe horários otimizados considerando:
- Dia da semana (ex: Quarta 07:00-09:00 para Feed)
- Tipo de conteúdo (Feed em janelas de pico; Stories distribuídos em intervalos de 2-3h)
- Datas especiais/feriados (1-2h antes do pico)
- O horário é validado via regex (`HH:MM` ou `HH:MM:SS`) antes de salvar; fallback para `default_time` da campanha se inválido

### `media-generate-copys` (IA Copywriter)

```typescript
POST /media-generate-copys
{
  "campaign_id": "...",
  "tenant_id": "..."
}
```

Busca items com título mas sem copy e gera: copy, CTA, hashtags, generation_prompt.
Usa técnicas AIDA, PAS e storytelling.

---

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Adicionar abas na página `/media` | Lista de campanhas direta, fluxo no calendário |
| Publicar sem revisão | Fluxo: suggested → approved → finalizar campanha |
| Publicar items passados sem intervalo | Stagger de 30s entre publicações imediatas para evitar rate limit |
| Gerar asset sem prompt | Sempre ter generation_prompt |
| Ignorar canal alvo | Respeitar target_channel da campanha |
| Misturar fluxos Blog/Mídias/YouTube | Usar `campaignType` para separar |
| Upload YouTube sem verificar créditos | Sempre verificar saldo antes |
| Usar fal.ai para imagens | Usar Lovable AI Gateway (Gemini + OpenAI dual provider) |
| Usar apenas 1 provedor para imagens | Dual provider com QA Scorer para máximo realismo |
| Publicar no Instagram sem aguardar container FINISHED | Sempre fazer polling do status_code antes de media_publish |
| Publicar sem criar registro em social_posts | Toda publicação Meta deve ter registro para evidência App Review |
| Gerar copys na IA de Estratégia | Estratégia gera apenas título/tema; Copys são geradas pela IA Copywriter |
| IA Copywriter gerar estratégia | Copywriter só preenche copy/CTA/hashtags de items existentes |
| Marcar item como `published` antes do horário | Item agendado para futuro deve ficar `scheduled` (Azul) até publicação efetiva |
| Publicar apenas no Instagram quando Facebook está selecionado | Avaliar `target_channel` + `target_platforms` para publicar em AMBAS plataformas |
| Criar apenas 1 registro `social_posts` para multi-plataforma | Criar registro separado para CADA plataforma (Instagram e Facebook) |
| Excluir campanha sem cancelar social_posts | Ao excluir campanha, cancelar todos os social_posts pendentes ANTES do CASCADE |
| Publicar sem verificar toggle de integração ativo | Worker DEVE validar que a integração (facebook_publicacoes/instagram_publicacoes) está ativa em tenant_meta_integrations |

---

## Regras de Integridade — Exclusão e Publicação

### Exclusão de Campanha
Ao excluir uma campanha, o sistema executa em sequência:
1. Busca todos os `calendar_item_ids` vinculados à campanha
2. Atualiza `social_posts` com status `scheduled` ou `draft` para `cancelled`
3. Só então deleta a campanha (CASCADE remove calendar_items; social_posts ficam com `calendar_item_id = NULL` mas já cancelados)

> **Motivo:** A FK `social_posts.calendar_item_id` usa `ON DELETE SET NULL`, então sem o passo 2 os posts ficariam órfãos e o worker continuaria tentando publicá-los.

### Validação de Integração no Worker
O `media-social-publish-worker` valida ANTES de cada publicação:
1. Consulta `tenant_meta_integrations` filtrando por `tenant_id`, `status = 'active'` e `integration_id` correspondente (`facebook_publicacoes` ou `instagram_publicacoes`)
2. Se a integração não estiver ativa, marca o post com falha permanente (`integration_inactive`)
3. Isso impede publicações quando o lojista desativou o toggle ou desconectou a Meta

---

## Checklist

- [x] Criar campanha com período
- [x] Gerar sugestões com IA (estratégia especialista)
- [x] Gerar copys com IA (copywriter especialista)
- [x] Calendário visual funciona
- [x] Edição inline de items
- [x] Upload manual de criativos
- [x] Fluxo separado Blog vs Mídias vs YouTube
- [x] Integração YouTube (OAuth + Upload)
- [x] Geração de vídeos IA (v2.0 pipeline)
- [x] Conexão com Meta (nativa via Graph API)
- [x] Tabela social_posts para evidências App Review
- [x] Barra de ações progressiva no calendário
- [x] Geração de imagens (dual provider v5.0 — Gemini Flash + OpenAI/Pro + QA Scorer)
- [x] Indicadores visuais de status no calendário (cores, dots, legenda)
- [x] DayPostsList com layout `max-h-[90vh]` e scroll interno
- [x] Finalizar Campanha com stagger de 30s para items passados
- [x] Cancelamento automático de social_posts ao excluir campanha (anti-órfãos)
- [x] Validação de integração ativa no worker antes de publicar
- [ ] Publicação automática (worker/cron)
- [x] Diagnóstico de seleção simplificado (contadores coloridos em linha única)
- [x] Coloração dinâmica dos cards selecionados por status (verde/amarelo/laranja/vermelho/cinza)
