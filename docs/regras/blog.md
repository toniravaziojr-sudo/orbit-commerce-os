# Blog — Regras e Especificações

> **Status:** EM DESENVOLVIMENTO 🟧

## Visão Geral

Sistema de blog integrado ao storefront para SEO e marketing de conteúdo.

---

## Rotas

| Rota | Descrição |
|------|-----------|
| **Admin:** `/blog` | Gerenciamento de posts |
| **Storefront:** `/loja/:slug/blog` | Listagem de posts |
| **Storefront:** `/loja/:slug/blog/:postSlug` | Post individual |

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
| `content` | json | Conteúdo em blocos |
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
| `Blog` | `src/pages/Blog.tsx` | Listagem no admin |
| `BlogPostEditor` | `src/components/blog/BlogPostEditor.tsx` | Editor de posts |
| `StorefrontBlog` | `src/pages/storefront/StorefrontBlog.tsx` | Listagem pública |
| `StorefrontBlogPost` | `src/pages/storefront/StorefrontBlogPost.tsx` | Post público |

---

## Status de Posts

| Status | Descrição |
|--------|-----------|
| `draft` | Rascunho, não visível |
| `published` | Publicado e visível |

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

## Recursos Planejados

- [ ] Editor visual rico
- [ ] Categorias de posts
- [ ] Comentários
- [ ] Posts relacionados
- [ ] Newsletter integration
- [ ] Schema markup (Article)
- [ ] RSS Feed
- [ ] Agendamento de publicação

---

## Integração com Menus

Posts podem ser linkados nos menus usando:
- `item_type: 'external'`
- `url: /loja/:slug/blog/:postSlug`

Ou criar link para o blog:
- `item_type: 'external'`
- `url: /loja/:slug/blog`
