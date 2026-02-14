# Blog — Regras e Especificações

> **Status:** PRONTO ✅

## Visão Geral

Sistema de blog integrado ao storefront para SEO e marketing de conteúdo. Utiliza o Visual Builder para edição visual de posts.

**Localização na Sidebar:** Submenu de **Marketing Básico** (não é seção independente).

**RBAC:** Rotas `/blog` e `/blog/campaigns` mapeiam para `module: 'marketing', submodule: 'blog'`.

---

## Rotas

| Rota | Descrição |
|------|-----------|
| **Admin:** `/blog` | Página unificada com abas (Posts + Campanhas IA) |
| **Admin:** `/blog?tab=posts` | Aba de posts manuais |
| **Admin:** `/blog?tab=campaigns` | Aba de campanhas IA |
| **Admin:** `/blog/:postId/editor` | Editor visual do post |
| **Admin:** `/blog/campaigns/:campaignId` | Detalhe da campanha com calendário |
| **Storefront:** `/loja/:slug/blog` | Listagem de posts |
| **Storefront:** `/loja/:slug/blog/:postSlug` | Post individual |

### Estrutura de Abas (página `/blog`)

A página Blog usa `Tabs` com duas abas:
- **Posts** (`?tab=posts`): Listagem e CRUD de posts manuais
- **Campanhas IA** (`?tab=campaigns`): Listagem e CRUD de campanhas de blog com IA

> **IMPORTANTE:** Não existe mais rota `/blog/campaigns` como página separada. O conteúdo foi integrado na aba "Campanhas IA" dentro de `/blog`.

---

## Tabela Principal

| Tabela | Descrição |
|--------|-----------|
| `blog_posts` | Armazena posts do blog por tenant |

### Colunas Principais

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | ID único |
| `tenant_id` | uuid | Tenant owner |
| `title` | string | Título do post |
| `slug` | string | URL amigável |
| `excerpt` | string | Resumo/chamada |
| `content` | json | Conteúdo em blocos (BlockNode) |
| `featured_image_url` | string | Imagem de destaque |
| `featured_image_alt` | string | Alt da imagem |
| `author_id` | uuid | Autor do post |
| `status` | string | `draft`, `published` |
| `published_at` | timestamp | Data de publicação |
| `tags` | string[] | Tags do post |
| `read_time_minutes` | number | Tempo estimado de leitura |
| `view_count` | number | Contador de views |
| `seo_title` | string | Título para SEO |
| `seo_description` | string | Descrição para SEO |
| `seo_image_url` | string | Imagem OG |

---

## Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `Blog` | `src/pages/Blog.tsx` | Página unificada com abas (Posts + Campanhas IA) |
| `BlogPostEditor` | `src/pages/BlogPostEditor.tsx` | Editor visual (VisualBuilder) |
| `BlogCampaignDetail` | `src/pages/BlogCampaignDetail.tsx` | Calendário de campanha |
| `StorefrontBlog` | `src/pages/storefront/StorefrontBlog.tsx` | Listagem pública |
| `StorefrontBlogPost` | `src/pages/storefront/StorefrontBlogPost.tsx` | Post público |

> **NOTA:** `BlogCampaigns.tsx` ainda existe mas NÃO é mais acessada via rota direta. O conteúdo foi integrado em `Blog.tsx` (aba Campanhas IA).

---

## Estrutura de Conteúdo (BlockNode)

Ao criar um post, ele é inicializado com dois blocos RichText separados:

```typescript
// createBlogPostTemplateWithTitle(title)
{
  id: 'root',
  type: 'Page',
  children: [
    {
      type: 'Section',
      props: { padding: 'lg' },
      children: [
        {
          type: 'Container',
          props: { maxWidth: 'md', centered: true },
          children: [
            {
              type: 'RichText',
              props: {
                content: '<h1>${title}</h1>'  // Bloco do título
              }
            },
            {
              type: 'RichText',
              props: {
                content: '<p>Escreva o conteúdo do seu post aqui...</p>'  // Bloco do conteúdo
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Importante

- O título do post é inserido como bloco `RichText` com `<h1>` dentro do conteúdo
- Isso permite edição visual completa do título junto com o conteúdo
- O campo `title` da tabela `blog_posts` é sincronizado separadamente para listagens

---

## Status de Posts

| Status | Descrição |
|--------|-----------|
| `draft` | Rascunho, não visível no storefront |
| `scheduled` | Agendado para publicação futura (via campanhas IA) |
| `published` | Publicado e visível no storefront |
| `archived` | Arquivado, não visível no storefront |

---

## Regras de Exibição

| Contexto | Comportamento |
|----------|---------------|
| `status = 'published'` + `published_at <= now()` | Visível no storefront |
| `status = 'draft'` | Apenas no admin |

---

## SEO

| Campo | Uso |
|-------|-----|
| `seo_title` | Tag `<title>` (fallback: `title`) |
| `seo_description` | Meta description (fallback: `excerpt`) |
| `seo_image_url` | OG Image (fallback: `featured_image_url`) |
| `slug` | URL canônica |

---

## Fluxo de Criação

1. Usuário acessa `/blog` (aba Posts)
2. Clica "Novo Post"
3. Preenche título, excerpt e SEO no dialog
4. Sistema cria `blog_posts` com `createBlogPostTemplateWithTitle(title)`
5. Redireciona para `/blog/:postId/editor`
6. Editor visual carrega com título no bloco H1 + bloco de conteúdo vazio
7. Usuário edita conteúdo visualmente
8. Pode salvar ou publicar

---

## Fluxo de Publicação

1. Admin edita post no builder
2. Altera status para "Publicado" e define `published_at`
3. Post fica visível no storefront

---

## Contador de Views

- `view_count` é incrementado via RPC `increment_blog_view_count(post_id)`
- Chamado automaticamente ao acessar post no storefront
- Fire-and-forget (não bloqueia renderização)

---

## Integração com Menus

Posts podem ser linkados nos menus usando:
- `item_type: 'external'`
- `url: /loja/:slug/blog/:postSlug`

Link para listagem do blog:
- `item_type: 'external'`
- `url: /loja/:slug/blog`

---

## Integração com Visual Builder

O `BlogPostEditor` usa o `VisualBuilder` com:
- `pageType: 'blog'`
- `pageId: postId`
- `pageTitle: post.title`
- `pageSlug: post.slug`
- `initialContent: post.content`

### Contexto do Builder

```typescript
const context: BlockRenderContext = {
  tenantSlug: currentTenant.slug,
  isPreview: false,
  settings: {
    store_name: storeSettings?.store_name,
    logo_url: storeSettings?.logo_url,
  },
  headerMenu: [...], // Menu items para preview
};
```

---

## Tipos de Blocos Disponíveis

| Bloco | Descrição |
|-------|-----------|
| `RichText` | Texto rico com formatação (H1-H6, bold, italic, links) |
| `Image` | Imagem com alt text e caption |
| `Video` | Embed de vídeo (YouTube, Vimeo) |
| `HTML` | HTML customizado |
| `Accordion` | FAQ/Accordion |
| `Container` | Container com max-width |
| `Section` | Seção com padding/background |

---

## Campanhas IA para Blog

O módulo de blog possui integração com o sistema de campanhas de IA para geração automática de posts, acessível via aba "Campanhas IA" em `/blog?tab=campaigns`.

### Arquivos

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/Blog.tsx` | Aba Campanhas IA (integrada) |
| `src/pages/BlogCampaignDetail.tsx` | Calendário + publicação |
| `src/components/media/CampaignCalendar.tsx` | Calendário visual (reutilizado) |
| `supabase/functions/media-publish-blog/` | Publica item em blog_posts |

### Fluxo

1. Admin acessa `/blog` > aba "Campanhas IA"
2. Cria campanha com `target_channel: "blog"`
3. Gera sugestões com IA
4. Revisa/aprova no calendário (`/blog/campaigns/:campaignId`)
5. Publica como post de blog

---

## Anti-Patterns (Proibido)

| ❌ Proibido | Motivo |
|-------------|--------|
| Criar rota `/blog/campaigns` como página separada | Campanhas estão integradas como aba em `/blog` |
| Usar módulo RBAC `blog` independente | Blog pertence a `module: 'marketing', submodule: 'blog'` |
| Criar seção "Blog" separada na sidebar | Blog é item dentro de "Marketing Básico" |

---

## Recursos Futuros (Planejados)

- [ ] Categorias de posts
- [ ] Comentários
- [ ] Posts relacionados
- [ ] Newsletter integration
- [ ] Schema markup (Article)
- [ ] RSS Feed
