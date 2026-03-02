# Landing Pages IA — Regras e Especificações

> **Status:** PRONTO ✅

## Visão Geral

Landing Pages de IA são páginas HTML standalone de alta conversão, geradas e editadas via IA (Gemini). **Módulo separado** das Páginas Institucionais (`store_pages`) — utilizam a tabela `ai_landing_pages` e o editor próprio `/landing-pages/:id`.

---

## ⚠️ Separação Obrigatória: Landing Pages IA vs Páginas Institucionais

| Característica | Landing Pages IA | Páginas Institucionais |
|---|---|---|
| **Tabela** | `ai_landing_pages` | `store_pages` |
| **Conteúdo** | HTML (`generated_html`) | BlockNode JSON (`content`) |
| **Editor** | `/landing-pages/:id` | `/pages/:pageId/builder` |
| **Listagem** | `/landing-pages` | `/pages` |
| **Rota pública** | `/loja/:slug/ai-lp/:lpSlug` | `/loja/:slug/pagina/:pageSlug` |
| **Geração** | IA (Gemini) ou importação | Manual no Visual Builder |
| **Criação manual** | Cria entrada em `ai_landing_pages` com `generated_html: ''` e redireciona para `/landing-pages/:id` | Cria entrada em `store_pages` com BlockNode padrão |

**PROIBIDO:** Redirecionar ações de Landing Pages para `/pages` ou vice-versa. São módulos independentes.

---

## Rotas

| Rota | Descrição |
|------|-----------|
| **Admin:** `/landing-pages` | Listagem de todas as landing pages |
| **Admin:** `/landing-pages/:id` | Editor da landing page (HTML + IA) |
| **Storefront:** `/loja/:slug/ai-lp/:lpSlug` | Landing page pública |

---

## Tabela Principal

| Tabela | Descrição |
|--------|-----------|
| `ai_landing_pages` | Landing pages por tenant |
| `ai_landing_page_versions` | Histórico de versões (HTML + prompt) |

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

---

## Hooks

| Hook | Função |
|------|--------|
| `useAILandingPageUrl` | Resolve URL pública da landing page |

---

## Fluxos de Criação

### 1. Criar com IA (wizard completo)
1. Usuário clica "Criar com IA" (botão principal com ícone Sparkles)
2. Preenche nome, slug, seleciona produtos, URL de referência, prompt
3. Sistema cria registro em `ai_landing_pages` (status: `generating`)
4. Edge function `ai-landing-page-generate` gera HTML via Gemini
5. Redireciona para `/landing-pages/:id`

### 2. Criar no Builder (em branco)
1. Usuário clica "Criar no Builder"
2. Dialog solicita nome da página
3. Sistema cria registro em `ai_landing_pages` (status: `draft`, `generated_html: ''`)
4. Redireciona para `/landing-pages/:id` (editor HTML da landing page)
5. Usuário edita manualmente no editor

> **IMPORTANTE:** Todas as Landing Pages (IA ou Builder) usam EXCLUSIVAMENTE a tabela `ai_landing_pages`. Nunca usar `store_pages` para landing pages.

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
O botão de geração de SEO por IA permanece bloqueado até que `generated_html` tenha conteúdo.

### RN-LP-005: Resolução de URL Pública
Usa `useAILandingPageUrl` para resolver a URL pública correta baseada no tenant (domínio customizado ou slug padrão).

### RN-LP-006: Independência do Módulo de Páginas
Landing Pages IA e Páginas Institucionais são módulos **completamente independentes**. Nunca redirecionar entre eles. Cada um tem sua tabela, editor e rotas próprias.

---

## SEO

| Campo | Uso |
|-------|-----|
| `seo_title` | Tag `<title>` |
| `seo_description` | Meta description |
| `seo_image_url` | OG Image |
| `slug` | URL canônica via `/ai-lp/:slug` |

---

## Publicação

1. Admin edita HTML no editor
2. Clica em "Publicar"
3. Sistema atualiza `status = 'published'`, `is_published = true`, `published_at = now()`
4. Página acessível via URL pública
