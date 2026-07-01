# Auditoria Completa de SEO — Comando Central (2026-07-01)

> Documento de estado atual do SEO da plataforma, destinado a análise externa (ChatGPT).
> Escopo: **storefront público multi-tenant** (loja virtual do lojista) + **painel administrativo**
> (ferramentas de edição de SEO usadas pelo lojista). O SEO do app SaaS em si
> (`app.comandocentral.com.br`) está fora do escopo primário — o produto vende SEO **da loja do cliente**.

---

## 1. Contexto arquitetural relevante

| Camada | Papel no SEO |
|---|---|
| **Storefront Edge (`storefront-html` Edge Function)** | Renderiza **HTML server-side** para toda rota pública da loja. Aqui nasce todo o `<head>` que Google/Bing indexam. Fonte de verdade de SEO da vitrine. |
| **Worker Cloudflare multi-tenant** | Roteia domínio custom / subdomínio da plataforma → `storefront-html`. Faz cache. Serve `favicon` por tenant. |
| **SPA React (Vite)** | Hidrata em cima do HTML do Edge. `StorefrontHead.tsx` reaplica `title`/`description`/`favicon` client-side apenas em transições SPA. `react-helmet-async` **NÃO** é usado. |
| **Painel Admin (React SPA)** | Formulários que gravam `seo_title`, `seo_description` em `products`, `categories`, `store_pages`, `landing_pages`, `blog_posts`, `store_settings`. |
| **Cache de pré-render** | Tabela `storefront_prerendered_pages` guarda snapshots HTML. Invalidação por `stale` flag ao mudar block-compiler ou conteúdo. |

**Observação crítica:** todo SEO relevante para crawlers é produzido no Edge, **não** no bundle JS.
O SPA só cuida de UX em navegação após hidratação.

---

## 2. Head HTML gerado pelo Edge (`storefront-html`)

Bloco `<head>` produzido por rota pública (linhas 1043–1080 de `supabase/functions/storefront-html/index.ts`):

```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title}</title>
<meta name="description" content="${opts.description}">
<link rel="canonical" href="${opts.canonicalUrl}">

<!-- Favicon multi-size (Worker → storefront-favicon) -->
<link rel="icon" ...>          <!-- 16/32/48/180 -->
<link rel="apple-touch-icon" ...>
<link rel="manifest" href="/site.webmanifest">

<link rel="dns-prefetch" href="https://wsrv.nl">
<link rel="dns-prefetch" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="https://fonts.gstatic.com">

<!-- Open Graph -->
<meta property="og:title" content="${opts.title}">
<meta property="og:description" content="${opts.description}">
<meta property="og:type" content="website">   <!-- SEMPRE "website" — não muda para product/article -->
<meta property="og:url"   content="${opts.canonicalUrl}">
${opts.ogImage ? `<meta property="og:image" content="${opts.ogImage}">` : ''}

<!-- Preload de fontes e LCP -->
${opts.fontPreloadTags}
${opts.googleFontsLink}
${opts.lcpPreloadTag}
```

### 2.1 O que está PRESENTE ✅
- `<title>` e `<meta name="description">` únicos por rota, com fallback:
  produto → `seo_title || "${name} | ${storeName}"`; idem categoria/página/post.
- `<link rel="canonical">` calculado como `https://${hostname}${path}` (self-reference correta).
- Open Graph mínimo (`title`, `description`, `type`, `url`, `image` opcional).
- Favicon multi-tamanho.
- Preloads de fonte e imagem LCP (perf → Core Web Vitals).
- JSON-LD `Product`, `BreadcrumbList` (em `product-details.ts`, `category-page-layout.ts`),
  `BlogPosting`/`Article` (em `blocks/blog.ts`). Injetados dentro do `bodyHtml` pelo block-compiler.

### 2.2 O que está AUSENTE / INCOMPLETO ❌

| Item | Situação | Impacto |
|---|---|---|
| **`robots.txt` da loja** | O worker **não serve** `/robots.txt` por tenant. Só existe `/public/robots.txt` do app SaaS. | Crawler não recebe `Sitemap:` nem regras específicas da loja. |
| **`sitemap.xml` da loja** | **Não existe geração** para storefront. Nenhum arquivo, nenhuma edge function. | Google descobre páginas só por links internos. Descoberta lenta para catálogos grandes. |
| **`<meta name="robots">`** | Não emitido. Só existe controle client-side em `src/lib/seo.ts` (não usado no Edge). | Não é possível marcar página específica como `noindex` no HTML servido (ex: busca interna, filtros). |
| **`og:type` dinâmico** | Sempre `"website"`. Deveria ser `"product"` em PDP, `"article"` em post. | Rich previews em redes sociais menos precisos. |
| **`og:image` dimensões** | Sem `og:image:width`/`height`/`alt`. | Facebook/LinkedIn às vezes rejeitam preview. |
| **Twitter Cards** | **Ausentes** (`twitter:card`, `twitter:image`, etc). | Preview quebrado no X/Twitter. |
| **JSON-LD `Organization`/`WebSite`** sitewide | Não emitido pelo Edge no home. | Perde `sitelinks searchbox` e knowledge panel. |
| **JSON-LD `Offer` de produto** | Presente, mas sem `aggregateRating` mesmo com `avg_rating`/`review_count` no schema. | Rich snippet de estrelas indisponível. |
| **JSON-LD `FAQPage`** | Não gerado, mesmo em páginas institucionais com FAQ. | Perde SERP feature. |
| **`hreflang`** | Não emitido (só PT-BR hoje). Aceitável. | — |
| **`<html lang>`** | Fixo em `pt-BR`. ✅ correto para o público-alvo. | — |
| **Breadcrumbs visuais** | Presentes em PDP/categoria; JSON-LD `BreadcrumbList` gerado. ✅ | — |
| **Alt text obrigatório em imagens** | Não há validação. Storefront renderiza `alt=""` quando o cadastro não preencheu. | Acessibilidade + SEO de imagens fraco. |
| **Cabeçalho `X-Robots-Tag` no Edge** | Não configurado. | — (mitigável via meta). |
| **Lazy loading** | `loading="lazy"` presente em blocos de listagem, ausente em alguns hero blocks. | Perf mista. |
| **Compressão de imagens** | Feita via `wsrv.nl` transform (`?w=&h=&q=`). ✅ | — |
| **Core Web Vitals** | Não há telemetria (`web-vitals` lib não instalada). | Sem visibilidade real de LCP/CLS/INP por página. |
| **Structured data validation** | Sem CI/lint automático (schema.org validator). | Regressões silenciosas. |
| **Redirect 301 legados** | Não há tabela de `redirects` por tenant. | Se lojista renomeia slug, URL antiga vira 404 (perde link juice). |

---

## 3. Fluxo de dados SEO (fonte de verdade por entidade)

| Entidade | Campos no DB | Tela de edição | Botão IA |
|---|---|---|---|
| **Produto** (`products`) | `seo_title` (max 70), `seo_description` (max 160), `name`, `short_description`, `slug`, `tags`, `avg_rating`, `review_count` | `ProductForm.tsx` → aba "SEO" | ✅ `GenerateSeoButton` |
| **Categoria** (`categories`) | `seo_title`, `seo_description`, `slug`, `banner_desktop_url` | `CategoryForm.tsx` | ✅ |
| **Página institucional** (`store_pages`) | `seo_title` **+** `meta_title` (legado — Pages.tsx grava nos dois), `seo_description` **+** `meta_description` | `Pages.tsx` | ✅ |
| **Landing Page** (`landing_pages`) | `seo_title`, `seo_description`, `slug` | `LandingPageEditor.tsx` | ✅ |
| **Post de blog** (`blog_posts`) | `seo_title`, `seo_description`, `slug`, `cover_image_url`, `excerpt`, `author_name`, `published_at` | `Blog.tsx` (dialog) | ✅ |
| **Loja (defaults)** (`store_settings`) | `seo_title`, `seo_description`, `store_description`, `logo_url`, `favicon_url`, `store_name`, `contact_*`, `social_*`, `business_legal_name`, `business_cnpj` | `StorefrontSettings.tsx` / `StorefrontConfigTab.tsx` | ❌ (não tem) |
| **Página do builder** (blocos livres) | `page_settings.seo_title/seo_description` | `PageSettingsContent.tsx` (drawer do builder) | ✅ |

### 3.1 Dívida técnica identificada
- **Duplicidade `seo_title` vs `meta_title`** em `store_pages`: existem AMBOS os campos e o código escreve nos dois para compat. → risco de divergência silenciosa.
- **Sem SEO defaults na tela `/storefront`**: lojista não tem UI clara para definir título/descrição padrão da loja (só existe no schema `store_settings`, mas não aparece como campo destacado em `StorefrontSettings.tsx`).
- **Sem contador de qualidade** (ex: “título ideal 50–60 caracteres, o seu tem 82”). Só há `maxLength`.
- **Sem preview de SERP** ("como o Google vai mostrar sua página").

---

## 4. Componente `GenerateSeoButton` (IA)

Arquivo: `src/components/seo/GenerateSeoButton.tsx` + edge `generate-seo`.

- **Modelo:** `google/gemini-2.5-flash` via Lovable AI Gateway.
- **Motor de créditos:** integrado (`withCreditMotor`).
- **Entradas aceitas:** `type` (product|category|blog|page), `name`, `description`, `content`, `excerpt`, `tags`, `imageUrl`, `price`, `storeName`.
- **Saída:** `{ seo_title, seo_description }`.
- **Regras do prompt:** título ≤ 60 chars, descrição ≤ 160 chars, keyword no início.
- **Tratamento de erro:** 429 (rate limit) e 402 (créditos esgotados) com toasts amigáveis.

**Pendências:**
- Não há **geração em lote** (usuário precisa clicar produto por produto).
- Não há registro de **histórico de sugestões** — não aprendemos com edições manuais (comparar com padrão `meli_product_attribute_memory` já usado em ML).
- Não há **auditoria** de quantos produtos têm SEO preenchido vs vazio no tenant.

---

## 5. Google Search Console (integração)

Arquivos: `supabase/functions/google-search-console/index.ts` + `useGoogleSearchConsole.ts` + `GoogleSearchConsoleTab.tsx`.

**Ações disponíveis (edge):** `sync`, `list`, `summary`, `sites`.

**Fluxo:**
1. Depende de conexão Google OAuth em `google_connections` com pack `search_console`.
2. Refresh token automático via `google-token-refresh`.
3. Retorna sites verificados + métricas (clicks, impressões, CTR, posição média).
4. UI: **aba em `/integrations`** (`GoogleSearchConsoleTab`), 249 linhas — mostra tabela e resumo.

**Ausências:**
- ❌ Não há **URL Inspection** (verificar indexação de página específica).
- ❌ Não há **submissão de sitemap** via API (`/sitemaps/{feedpath}`).
- ❌ Não há **verificação automática de domínio custom** (via meta-tag `google-site-verification`) — hoje é manual.
- ❌ Métricas não são cacheadas em tabela local → cada abertura chama API (custo + latência).
- ❌ Não há painel de "Saúde SEO" consumindo estes dados no `command-center`.

---

## 6. Módulo "Saúde de SEO" (planejado mas não implementado)

Referências:
- `src/config/module-status.ts` — não lista rota SEO.
- Backlog em `assuntos-em-andamento.md`: item **7 — Saúde de SEO por Tenant**.
- Descrição do backlog: “nota geral + fix rápido por IA, rollout em ondas”.

**Escopo previsto (não construído):**
- Score 0–100 por loja.
- Checklist automatizado (título/desc preenchidos, imagens com alt, sitemap presente, HTTPS, Core Web Vitals).
- Sugestões de fix com um clique (delegando a `GenerateSeoButton` em lote).
- Cron semanal para reprocessar.

---

## 7. Runtime Violations (relacionadas a SEO indireto)

Tabela `storefront_runtime_violations` + hook `useRuntimeViolations` + edges `report-runtime-violation`, `scan-content-urls`, `health-monitor-admin`.

Detecta violações que degradam SEO/UX na loja pública:
- `hardcoded_store_url` — link com URL fixa que vai quebrar em domínio custom.
- `app_domain_link` — link para `app.comandocentral.com.br` vazando na loja.
- `preview_in_public` — URL de preview Lovable indo pro público.
- `content_hardcoded_url` — conteúdo com URL fixa.

UI: `StorefrontHealthCard`, `SchedulerStatusCard`. Refetch a cada 60s. ✅ funcional.
**Falta:** integrar findings de SEO puro (título vazio, alt ausente, meta > 160 chars) no mesmo painel.

---

## 8. UI/UX de SEO no painel administrativo

### 8.1 Onde o lojista encontra SEO hoje

| Tela | Caminho | Campo SEO |
|---|---|---|
| Produto | `/products` → editar → aba "SEO" | seo_title, seo_description, botão IA |
| Categoria | `/categories` → editar | idem |
| Página institucional | `/pages` → editar (dialog) | idem |
| Landing Page | `/landing-pages` → editor | idem |
| Post de blog | `/blog` → editar | idem |
| Página do builder | `/storefront` (builder) → drawer da página | idem |
| Configurações gerais da loja | `/storefront` (StorefrontSettings) | store_name, store_description (não há aba SEO dedicada) |
| Google Search Console | `/integrations` → aba GSC | métricas read-only |

### 8.2 Problemas de UX identificados
1. **Fragmentação:** SEO está espalhado em 7+ telas sem um hub único.
2. **Sem visão de cobertura:** lojista não vê “X% dos seus produtos estão sem SEO”.
3. **Sem preview real** (mockup de resultado do Google).
4. **Contadores existem** (`X/60 caracteres`) mas sem semáforo verde/amarelo/vermelho por qualidade.
5. **Botão IA existe mas não é sugerido proativamente** — nada avisa “este produto não tem SEO, quer gerar?”.
6. **Sidebar não tem entrada "SEO"** — usuário precisa saber onde procurar.
7. **GSC fica escondido dentro de Integrações** — deveria ter dashboard próprio.
8. **Nenhum aviso quando o tenant não tem domínio custom** (impacta indexação — subdomínio da plataforma não constrói autoridade da marca do lojista).

---

## 9. Robots / Sitemap — situação atual

### `public/robots.txt` (do app SaaS `app.comandocentral.com.br`)
```
User-agent: Googlebot / Bingbot / Twitterbot / facebookexternalhit
Allow: /
User-agent: *
Allow: /
```
Sem `Sitemap:` declarado.

### Storefront (loja do cliente)
- **Nada.** Nem `robots.txt`, nem `sitemap.xml`.
- Consequência: para catálogos com >100 produtos, o Google demora semanas para descobrir tudo via crawling de links internos.

---

## 10. Performance e Core Web Vitals

**Pontos positivos:**
- Skeleton inline no `index.html` elimina flash em branco.
- Edge HTML rendering → LCP baixo em first paint.
- `wsrv.nl` para transformação/compressão de imagens.
- `dns-prefetch` para fontes e transform CDN.
- `manualChunks` agressivo é **proibido** (memória `onda-6-performance-defaults`), então bundle não fragmenta em excesso.

**Pontos fracos:**
- Sem coleta de métricas reais (`web-vitals`).
- Fontes Google carregadas via `<link>` bloqueante em vez de `font-display: swap` explícito em todos os casos.
- Sem `<link rel="preconnect">` (só `dns-prefetch`) — preconnect é mais forte.
- Blocos podem emitir `<img>` sem `width`/`height` → CLS.

---

## 11. Governança e documentação

- **Não existe** `docs/especificacoes/storefront/seo.md` ou equivalente.
- SEO aparece disperso em:
  - `docs/especificacoes/storefront/loja-virtual.md` (menciona)
  - `docs/especificacoes/storefront/pagina-produto.md` (menciona)
  - Este documento (`seo-auditoria-2026-07.md`) é a **primeira consolidação**.
- Este é o item **7** do backlog em `assuntos-em-andamento.md`.

---

## 12. Resumo executivo — o que está pronto vs o que falta

### ✅ Pronto e funcional
- Edge HTML por rota com `<title>`, `<meta description>`, `<canonical>`, OG básico.
- Campos SEO por produto/categoria/página/LP/post/builder.
- Botão IA de geração de título/descrição (Gemini via motor de créditos).
- JSON-LD `Product` / `BreadcrumbList` / `BlogPosting` em blocos.
- Favicon multi-tamanho por tenant.
- Integração Google Search Console read-only (sites, métricas).
- Health monitor de URLs vazando (`storefront_runtime_violations`).

### ⚠️ Parcial (existe mas incompleto)
- Open Graph: falta `og:type` dinâmico, Twitter Cards, dimensões de imagem.
- JSON-LD: falta `Organization`, `WebSite` sitewide, `AggregateRating`, `FAQPage`.
- UI SEO: fragmentada, sem hub, sem preview de SERP, sem semáforo de qualidade.
- GSC: sem URL Inspection, sem submissão de sitemap, sem cache local.

### ❌ Ausente
- `robots.txt` por tenant.
- `sitemap.xml` por tenant (gerado dinamicamente ou por cron).
- `<meta name="robots">` server-side no Edge.
- Verificação automática de domínio (meta-tag Google/Bing).
- Redirects 301 por tenant (tabela de aliases).
- Coleta de Core Web Vitals reais.
- Painel "Saúde SEO" (score + fix rápido).
- Auditoria de cobertura SEO por tenant (quantos produtos sem seo_title etc).
- Geração de SEO em lote via IA.
- Item de menu "SEO" na sidebar.

### 🐛 Dívida técnica
- `store_pages.seo_title` vs `meta_title` duplicados.
- `StorefrontHead.tsx` mexe em `document.title`/`meta` client-side em paralelo ao HTML do Edge — pode causar flash em transições SPA.
- `og:type` fixo em `"website"`.
- Sem invalidação de cache Cloudflare específica para mudança de SEO (só de conteúdo).

---

## 13. Arquivos-chave (para investigação profunda)

| Camada | Arquivo | Papel |
|---|---|---|
| Edge HTML | `supabase/functions/storefront-html/index.ts` | Head, canonical, OG, fallback SEO. |
| Block compiler | `supabase/functions/_shared/block-compiler/blocks/product-details.ts` | JSON-LD Product. |
| Block compiler | `supabase/functions/_shared/block-compiler/blocks/blog.ts` | JSON-LD BlogPosting. |
| Block compiler | `supabase/functions/_shared/block-compiler/blocks/category-page-layout.ts` | JSON-LD ItemList. |
| Edge IA | `supabase/functions/generate-seo/index.ts` | Geração de título/descrição. |
| Edge GSC | `supabase/functions/google-search-console/index.ts` | Proxy GSC. |
| SPA | `src/components/storefront/StorefrontHead.tsx` | Head client-side em SPA. |
| SPA | `src/components/seo/GenerateSeoButton.tsx` | Botão IA. |
| SPA | `src/lib/seo.ts` | Helper de resolução de SEO efetivo (usado apenas no fallback SPA). |
| SPA | `src/lib/canonicalUrls.ts` + `src/hooks/useCanonicalUrls.ts` | Cálculo de URLs canônicas para links internos. |
| Admin | `src/components/integrations/GoogleSearchConsoleTab.tsx` | UI GSC. |
| Admin | `src/hooks/useGoogleSearchConsole.ts` | React Query da GSC. |
| Admin | `src/pages/StorefrontSettings.tsx` | Config SEO defaults da loja. |
| Admin | `src/pages/Pages.tsx`, `Blog.tsx`, `LandingPageEditor.tsx`, `products/ProductForm.tsx`, `categories/CategoryForm.tsx` | Formulários com campos SEO. |
| Runtime | `src/hooks/useRuntimeViolations.ts` + `supabase/functions/report-runtime-violation/` | Detecção de URLs quebradas na loja. |
| Estático | `public/robots.txt` | Robots do app SaaS (não da loja do cliente). |

---

## 14. Recomendações prioritárias (para discussão)

**Onda 1 — Fundação de indexação (bloqueador de crescimento orgânico):**
1. Gerar `/robots.txt` por tenant no Edge Worker (com `Sitemap:` apontando pra próximo item).
2. Gerar `/sitemap.xml` por tenant no Edge (produtos + categorias + páginas + posts + LPs ativas).
3. Emitir `<meta name="robots">` no Edge, controlável por página (respeitar `noindex` de checkout/carrinho/busca).
4. Submeter sitemap ao GSC via API automaticamente após conectar domínio.

**Onda 2 — Rich Snippets:**
5. `og:type` dinâmico (`product`/`article`/`website`).
6. Twitter Cards completos.
7. JSON-LD `Organization`+`WebSite` sitewide no home.
8. JSON-LD `AggregateRating` em PDP (dados já existem).
9. JSON-LD `FAQPage` em páginas institucionais com FAQ.

**Onda 3 — UX e visibilidade:**
10. Módulo "Saúde SEO" no menu (score + checklist + preview SERP + fix em lote via IA).
11. URL Inspection GSC dentro do sistema.
12. Verificação automática de domínio custom via meta-tag.

**Onda 4 — Perf e qualidade:**
13. Coleta `web-vitals` real por página (armazenar em `storefront_web_vitals`).
14. Validador de structured data em CI.
15. Redirects 301 por tenant (tabela + Worker).

---

**Fim do documento.**
Data: 2026-07-01 · Autor: agente Lovable · Escopo revisado: código atual em `main`.
