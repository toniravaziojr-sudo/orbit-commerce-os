# Páginas Institucionais — Regras e Especificações

> **Status:** EM DESENVOLVIMENTO 🟧

## Visão Geral

Páginas estáticas customizáveis para conteúdo institucional da loja (Sobre, Contato, Políticas, etc.).

---

## Rota

- **Admin:** `/pages`
- **Storefront:** `/loja/:slug/pagina/:pageSlug`

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
| `content` | json | Conteúdo em blocos (editor) |
| `seo_title` | string | Título para SEO |
| `seo_description` | string | Descrição para SEO |
| `is_published` | boolean | Página publicada |
| `created_at` | timestamp | Data de criação |
| `updated_at` | timestamp | Última atualização |

---

## Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `Pages` | `src/pages/Pages.tsx` | Listagem no admin |
| `PageEditor` | `src/components/pages/PageEditor.tsx` | Editor de conteúdo |
| `StorefrontPage` | `src/pages/storefront/StorefrontPage.tsx` | Renderização pública |

---

## Hooks

| Hook | Função |
|------|--------|
| `useStorePages` | CRUD de páginas |
| `usePublicPage` | Busca página pública por slug |

---

## Tipos de Conteúdo Suportados

| Tipo | Descrição |
|------|-----------|
| `text` | Bloco de texto rico |
| `image` | Imagem com alt text |
| `video` | Embed de vídeo |
| `html` | HTML customizado |
| `accordion` | FAQ/Accordion |

---

## Integração com Menus

Páginas podem ser linkadas nos menus do header/footer usando:
- `item_type: 'page'`
- `ref_id: page.id`

---

## Regras de Exibição

| Contexto | Comportamento |
|----------|---------------|
| `is_published = true` | Visível no storefront |
| `is_published = false` | Apenas no admin |

---

## SEO

| Campo | Uso |
|-------|-----|
| `seo_title` | Tag `<title>` |
| `seo_description` | Meta description |
| `slug` | URL canônica |

---

## Pendências

- [ ] Editor visual de blocos
- [ ] Preview antes de publicar
- [ ] Versionamento de conteúdo
- [ ] Templates pré-definidos (Sobre, Contato, etc.)
