# Páginas Institucionais — Regras e Especificações

> **Status:** PRONTO ✅

## Visão Geral

Módulo unificado de **Páginas** (`/pages`) que combina Páginas Institucionais, Landing Pages com IA e Landing Pages no Builder em uma **única listagem** (sem abas). Todas as páginas são criadas e gerenciadas com as mesmas ferramentas.

### Modos de Criação

O botão "Criar Página" oferece 3 opções via dropdown:

| Opção | Descrição |
|-------|-----------|
| **No Builder** | Insere nome e slug, redireciona para o Visual Builder (blocos nativos) |
| **Com IA** | Geração completa com IA (chat para ajustar, etc.) — cria `ai_landing_pages` |
| **Importar com IA** | Importa página a partir de URL alvo — cria `ai_landing_pages` |

### Fontes de Dados Unificadas

A listagem mescla 3 fontes em uma tabela única ordenada por `created_at`:

| Fonte | Tabela | Badge |
|-------|--------|-------|
| Institucional | `store_pages` (type != landing_page) | — |
| Landing (Builder) | `store_pages` (type = landing_page) | `Landing` |
| Landing (IA) | `ai_landing_pages` | `IA` |

## Rotas

| Rota | Descrição |
|------|-----------|
| **Admin:** `/pages` | Listagem e gerenciamento de páginas |
| **Admin:** `/pages/:pageId/builder` | Editor visual da página |
| **Storefront:** `/loja/:slug/pagina/:pageSlug` | Página pública |

---

## Tabela Principal

| Tabela | Descrição |
|--------|-----------|
| `store_pages` | Armazena páginas institucionais por tenant |

### Colunas Principais

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | ID único |
| `tenant_id` | uuid | Tenant owner |
| `title` | string | Título da página |
| `slug` | string | URL amigável |
| `type` | string | Tipo: `institutional`, `landing_page`, `custom` |
| `status` | string | `draft`, `published` |
| `content` | json | Conteúdo em blocos (BlockNode) |
| `individual_content` | string | Conteúdo HTML individual |
| `template_id` | uuid | Template associado |
| `is_published` | boolean | Página publicada |
| `show_in_menu` | boolean | Exibir nos menus |
| `menu_label` | string | Label customizado para menu |
| `menu_order` | number | Ordem no menu |
| `seo_title` | string | Título para SEO |
| `seo_description` | string | Descrição para SEO |
| `created_at` | timestamp | Data de criação |
| `updated_at` | timestamp | Última atualização |

---

## Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `Pages` | `src/pages/Pages.tsx` | Listagem no admin |
| `PageBuilder` | `src/pages/PageBuilder.tsx` | Editor visual |
| `StorefrontPage` | `src/pages/storefront/StorefrontPage.tsx` | Renderização pública |

---

## Hooks

| Hook | Função |
|------|--------|
| `useStorePages` | CRUD de páginas (create, update, delete) |
| `usePageBuilder` | Gerenciamento de versões (draft/publish) |
| `usePublicPageTemplate` | Busca página pública por slug |

---

## Estrutura de Conteúdo (BlockNode)

Ao criar uma página, ela é inicializada com a estrutura padrão:

```typescript
// defaultInstitutionalTemplate
{
  id: 'root',
  type: 'Page',
  children: [
    {
      type: 'Header',  // Header do template
    },
    {
      type: 'Section',
      children: []     // Seção vazia para edição
    },
    {
      type: 'Footer',  // Footer do template
    }
  ]
}
```

---

## Tipos de Blocos Suportados

| Bloco | Descrição |
|-------|-----------|
| `RichText` | Texto rico com formatação |
| `Image` | Imagem com alt text |
| `Video` | Embed de vídeo |
| `HTML` | HTML customizado |
| `Accordion` | FAQ/Accordion |
| `Container` | Container com max-width |
| `Section` | Seção com padding |

---

## Integração com Menus

Páginas podem ser linkadas nos menus do header/footer:
- `item_type: 'page'`
- `ref_id: page.id`

A resolução de URL usa `buildMenuUrl()` para gerar `/loja/:slug/pagina/:pageSlug`.

---

## Integração com Templates

| Tabela | Relação |
|--------|---------|
| `page_templates` | Template de layout associado à página |
| `store_page_versions` | Versionamento de conteúdo (draft/published/archived) |

Cada página pode ter um template dedicado criado automaticamente ao criar a página.

---

## Regras de Exibição

| Contexto | Comportamento |
|----------|---------------|
| `is_published = true` | Visível no storefront |
| `is_published = false` | Apenas no admin (rascunho) |
| `status = 'published'` | Conteúdo publicado ativo |
| `status = 'draft'` | Conteúdo em edição |

---

## SEO

| Campo | Uso |
|-------|-----|
| `seo_title` | Tag `<title>` (fallback: `title`) |
| `seo_description` | Meta description |
| `slug` | URL canônica |

---

## Fluxo de Criação

### Via Builder (padrão)
1. Usuário clica "Criar Página" → "No Builder"
2. Preenche título (slug gerado automaticamente)
3. Sistema cria `store_pages` + `page_templates` associado
4. Redireciona para `/pages/:pageId/builder`
5. Editor visual carrega com estrutura padrão (Header + Section vazia + Footer)
6. Usuário adiciona blocos e edita conteúdo
7. Pode salvar rascunho ou publicar

### Via IA (geração) — Motor v3.0.0
1. Usuário clica "Criar Página" → "Com IA"
2. Diálogo de criação de landing page com chat IA
3. Sistema cria `ai_landing_pages` com HTML/CSS gerado
4. Motor v3.0.0 analisa nicho do produto (tags, tipo, descrição) e aplica direção criativa adaptativa
5. Gera copy persuasivo com técnica PAS (Problem → Agitation → Solution)
6. Estrutura de 9 seções otimizadas para conversão (Hero → Trust Bar → Transformação → Produto → Prova Social → Comparativo → Oferta → FAQ → CTA Final)
7. Composição visual de produto (gradient overlay, 3D transforms, galeria assimétrica)
8. Modelo: `google/gemini-2.5-pro` via ai-router

### Via IA (importação)
1. Usuário clica "Criar Página" → "Importar com IA"
2. Insere URL da página alvo
3. Sistema importa e recria via IA em `ai_landing_pages`

---

## Fluxo de Publicação

1. Admin edita conteúdo no builder
2. Clica em "Publicar"
3. Sistema atualiza `status = 'published'` e `is_published = true`
4. Página fica visível no storefront

---

## Preview Mode

- Usuários autenticados podem acessar `/loja/:slug/pagina/:pageSlug?preview=1`
- Mostra conteúdo mesmo se não publicado
- Usado para revisar antes de publicar

---

## AI Landing Pages — Renderização Pública

### Componente: `StorefrontAILandingPage`

| Arquivo | Função |
|---------|--------|
| `src/pages/storefront/StorefrontAILandingPage.tsx` | Renderiza AI LPs via iframe com injeção de pixels |

### Resolução de Tenant
- Resolve tenant via URL param (`/store/:tenantSlug/ai-lp/:lpSlug`), subdomínio da plataforma ou domínio customizado
- Usa `TenantSlugContext.Provider` para compartilhar `tenantSlug` com componentes filhos (Header/Footer)

### Header e Footer Condicionais
- Controlados pelas flags `show_header` e `show_footer` em `ai_landing_pages`
- Quando ativos, envolvidos em `CartProvider` + `DiscountProvider` + `TenantSlugContext.Provider`
- `StorefrontHeader` e `StorefrontFooter` usam `useTenantSlug()` (que resolve param OU context)

### Auto-resize do Iframe
- Script injetado no HTML gerado envia `postMessage` com altura do conteúdo
- Componente pai escuta e ajusta `iframeHeight` dinamicamente
- Elimina barras de rolagem e cortes de conteúdo

### Injeção de Pixels de Marketing
- Meta Pixel, Google Analytics/Ads e TikTok Pixel são injetados automaticamente no `<head>` do iframe
- Configuração lida de `marketing_integrations` via `usePublicMarketingConfig`

### Favicon e SEO
- Favicon do lojista (`favicon_url`) injetado no documento pai e no iframe
- `document.title` definido com `seo_title` ou `name` da landing page

---

## Motor de Geração IA v3.0.0

### Edge Function: `ai-landing-page-generate`

| Pilar | Descrição |
|-------|-----------|
| **1. Direção Criativa por Nicho** | Analisa `product_type`, `tags`, `description` e aplica direção visual (Dark Premium, Editorial, Neon-Tech, Orgânico, etc.) |
| **2. Copy Persuasivo PAS** | Headlines com PAS, power words, micro-copy de urgência, seção Antes vs Depois |
| **3. Composição Visual de Produto** | Gradient overlay no hero, 3D transforms, galeria assimétrica, badges sobrepostos |
| **4. Estrutura Comercial** | 9 seções ordenadas: Hero → Trust Bar → Transformação → Produto → Prova Social → Comparativo → Oferta → FAQ → CTA Final |
| **5. Efeitos Visuais Premium** | Glassmorphism, pulse CTA, fadeInUp, gradient text, divider waves |

### Dados Consumidos
- `products` (nome, preço, descrição, imagens, tags, tipo)
- `product_reviews` (prova social real)
- `ads_creative_assets` (tom de voz e headlines existentes)
- `store_settings` (nome, logo, cor primária)

### Modelo: `google/gemini-2.5-pro` via `ai-router`

---

## Prompt Ideal para Geração de Landing Page

### Estrutura Recomendada do Prompt do Usuário

O prompt inserido pelo lojista no campo "Descreva sua Landing Page" deve seguir esta estrutura para máxima qualidade:

```
Crie uma landing page de alta conversão para [PRODUTO PRINCIPAL - 1 UNIDADE].

DIREÇÃO CRIATIVA:
- Estilo visual: [Dark premium / Editorial clean / Neon-tech / Orgânico]
- Tom: [Autoridade + urgência / Elegante + aspiracional / Técnico + confiável]

HERO:
- Headline usando técnica PAS (problema → agitação → solução)
- Sub-headline com benefício principal
- CTA primário pulsante
- Trust bar com selos de confiança

ESTRUTURA DE SEÇÕES (nesta ordem):
1. Hero de impacto
2. Seção "O Problema" — dor do cliente com empatia
3. Seção "A Transformação" — antes vs depois
4. Produto em destaque — foto + benefícios + preço com âncora
5. Prova social — depoimentos reais
6. Comparativo — produto vs alternativas
7. Oferta irresistível — preço, garantia, selos, CTA
8. FAQ estratégico — objeções em perguntas
9. CTA final com urgência

REGRAS:
- Foque na UNIDADE individual, não em kits
- Use APENAS imagens reais do produto
- Mobile-first
- Varie o texto dos CTAs
```

### Dicas para Melhor Resultado

| Dica | Por quê |
|------|---------|
| Especificar 1 produto (não kit) | IA tende a priorizar kits se não instruída |
| Descrever o tom desejado | Evita páginas genéricas sem personalidade |
| Mencionar técnica PAS | Ativa copy persuasivo no motor v3.0.0 |
| Pedir imagens reais | Evita URLs fictícias ou imagens de catálogo |
| Listar seções na ordem | Garante estrutura comercial otimizada |
