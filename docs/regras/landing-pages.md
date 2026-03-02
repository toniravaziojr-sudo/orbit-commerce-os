# Landing Pages — Regras e Especificações

> **Status:** PRONTO ✅ | **Atualizado:** 2026-03-02

## Visão Geral

O módulo Landing Pages oferece **dois modos de criação distintos** com tabelas e editores separados:

| Modo | Tabela | Editor | Conteúdo |
|------|--------|--------|----------|
| **Landing Pages IA** | `ai_landing_pages` | `/landing-pages/:id` (Editor HTML + IA) | HTML (`generated_html`) |
| **Landing Pages Builder** | `store_pages` (type: `landing_page`) | `/pages/:pageId/builder` (VisualBuilder) | BlockNode JSON (`content`) |

---

## ⚠️ Separação Obrigatória: Landing Pages IA vs Builder vs Páginas Institucionais

| Característica | Landing Pages IA | Landing Pages Builder | Páginas Institucionais |
|---|---|---|---|
| **Tabela** | `ai_landing_pages` | `store_pages` (type: `landing_page`) | `store_pages` (type: `institutional`) |
| **Conteúdo** | HTML (`generated_html`) | BlockNode JSON (`content`) | BlockNode JSON (`content`) |
| **Editor** | `/landing-pages/:id` | `/pages/:pageId/builder` | `/pages/:pageId/builder` |
| **Listagem** | `/landing-pages` | `/landing-pages` | `/pages` |
| **Rota pública** | `/loja/:slug/ai-lp/:lpSlug` | `/loja/:slug/lp/:pageSlug` | `/loja/:slug/pagina/:pageSlug` |
| **Geração** | IA (Gemini) ou importação | Manual no Visual Builder | Manual no Visual Builder |

**PROIBIDO:** Misturar os modos. Ações de IA usam `ai_landing_pages`. Ações de Builder usam `store_pages` com `type: 'landing_page'`.

---

## Rotas

| Rota | Descrição |
|------|-----------|
| **Admin:** `/pages` (aba "Landing Pages") | Listagem unificada de todas as landing pages (IA + Builder) |
| **Admin:** `/landing-pages/:id` | Editor HTML + IA (apenas landing pages IA) |
| **Admin:** `/pages/:pageId/builder` | VisualBuilder (landing pages Builder) |
| **Storefront:** `/loja/:slug/ai-lp/:lpSlug` | Landing page IA pública |
| **Storefront:** `/loja/:slug/lp/:pageSlug` | Landing page Builder pública |

> **NOTA:** A rota `/landing-pages` redireciona para `/pages`. A listagem agora é unificada dentro do módulo "Páginas da Loja" com abas.

---

## Tabelas

| Tabela | Descrição |
|--------|-----------|
| `ai_landing_pages` | Landing pages geradas por IA |
| `ai_landing_page_versions` | Histórico de versões (HTML + prompt) |
| `store_pages` (type: `landing_page`) | Landing pages criadas no Builder |

### Colunas Principais (`ai_landing_pages`)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | ID único |
| `tenant_id` | uuid | Tenant owner |
| `created_by` | uuid | Usuário criador |
| `name` | string | Nome da landing page |
| `slug` | string | URL amigável |
| `status` | string | `draft`, `generating`, `published`, `archived` |
| `is_published` | boolean | Se está publicada |
| `generated_html` | text | HTML da landing page |
| `generated_css` | text | CSS customizado |
| `initial_prompt` | text | Prompt inicial de geração |
| `reference_url` | text | URL de referência de design |
| `reference_screenshot_url` | text | Screenshot da referência |
| `product_ids` | text[] | IDs de produtos vinculados |
| `current_version` | integer | Versão atual |
| `seo_title` | string | Título para SEO |
| `seo_description` | string | Descrição para SEO |
| `seo_image_url` | string | Imagem OG para SEO |
| `published_at` | timestamp | Data de publicação |
| `created_at` | timestamp | Data de criação |
| `updated_at` | timestamp | Última atualização |

---

## Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `LandingPages` | `src/pages/LandingPages.tsx` | Listagem no admin |
| `CreateLandingPageDialog` | `src/components/landing-pages/CreateLandingPageDialog.tsx` | Wizard de criação com IA |
| `LandingPagePreviewDialog` | `src/components/landing-pages/LandingPagePreviewDialog.tsx` | Preview inline |
| `ImportPageWithAIDialog` | `src/components/import/ImportPageWithAIDialog.tsx` | Importação de URL externa |
| `StorefrontLandingPage` | `src/pages/storefront/StorefrontLandingPage.tsx` | Renderização pública (Builder) |

---

## Hooks

| Hook | Função |
|------|--------|
| `useAILandingPageUrl` | Resolve URL pública da landing page IA |
| `usePageTemplates` | Cria templates para landing pages Builder |

---

## Fluxos de Criação

### 1. Criar com IA (wizard completo)
1. Usuário clica "Criar com IA" (botão principal com ícone Sparkles)
2. Preenche nome, slug, seleciona produtos, URL de referência, prompt
3. Sistema cria registro em `ai_landing_pages` (status: `generating`)
4. Edge function `ai-landing-page-generate` gera HTML via Gemini
5. Redireciona para `/landing-pages/:id`

### 2. Criar no Builder (Visual Builder)
1. Usuário clica "Criar no Builder"
2. Dialog solicita nome + slug (com preview da URL e validação)
3. Sistema cria `page_templates` dedicado + `store_pages` com `type: 'landing_page'`
4. Redireciona para `/pages/:pageId/builder` (VisualBuilder com blocos)
5. Usuário edita com drag-and-drop de blocos (igual Páginas Institucionais)

> **IMPORTANTE:** "Criar no Builder" usa `store_pages` + VisualBuilder. "Criar com IA" usa `ai_landing_pages` + editor HTML. São fluxos distintos.

### 3. Importar com IA
1. Usuário clica "Importar com IA"
2. Cola URL de página externa
3. Edge function `ai-import-page` (com `targetType: 'landing_page'`) scrape + converte
4. Sistema cria registro em `ai_landing_pages` com HTML gerado
5. Redireciona para `/landing-pages/:id`

---

## Edge Functions

| Function | Descrição |
|----------|-----------|
| `ai-landing-page-generate` | Gera HTML via Gemini (criação/refinamento) |
| `ai-import-page` | Importa página externa (com `targetType: 'landing_page'` salva em `ai_landing_pages`) |

---

## Regras de Negócio

### RN-LP-001: Dados de Produto do Banco
Todos os dados de produtos (fotos, nomes, descrições, preços) DEVEM vir do banco de dados do tenant. URLs de referência servem apenas como inspiração de layout.

### RN-LP-002: Preços em BRL (sem divisão por 100)
Os valores `price` e `cost_price` já são em BRL. **Proibida** a divisão por 100.

### RN-LP-003: Mídia Incorporada via URL Exata
Imagens e vídeos anexados via chat/upload DEVEM ser incorporados usando as URLs exatas do storage.

### RN-LP-004: SEO Bloqueado Até HTML Existir
O botão de geração de SEO por IA permanece bloqueado até que `generated_html` tenha conteúdo (apenas para landing pages IA).

### RN-LP-005: Resolução de URL Pública
Usa `useAILandingPageUrl` para resolver a URL pública correta de landing pages IA baseada no tenant (domínio customizado ou slug padrão).

### RN-LP-006: Separação de Modos
- **IA**: `ai_landing_pages` → `/landing-pages/:id` (editor HTML)
- **Builder**: `store_pages` (type: `landing_page`) → `/pages/:pageId/builder` (VisualBuilder)
- **PROIBIDO** criar em `ai_landing_pages` para fluxo Builder ou em `store_pages` para fluxo IA.

### RN-LP-007: Dialog "Criar no Builder" Espelha Páginas Institucionais
O dialog deve conter campos de Nome + Slug editável com preview da URL final e validação de formato. Idêntico ao dialog "Nova Página" de Páginas Institucionais.

---

## SEO

| Campo | Uso |
|-------|-----|
| `seo_title` | Tag `<title>` |
| `seo_description` | Meta description |
| `seo_image_url` | OG Image |
| `slug` | URL canônica |

---

## Publicação

### Landing Pages IA
1. Admin edita HTML no editor via prompts
2. Clica em "Publicar"
3. Sistema atualiza `status = 'published'`, `is_published = true`, `published_at = now()`
4. Página acessível via `/loja/:slug/ai-lp/:lpSlug`

### Landing Pages Builder
1. Admin edita blocos no VisualBuilder
2. Usa fluxo padrão Salvar → Publicar (igual Páginas Institucionais)
3. Página acessível via `/loja/:slug/lp/:pageSlug`
