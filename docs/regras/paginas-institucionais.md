# Páginas Institucionais — Regras e Especificações

> **Status:** PRONTO ✅

## Visão Geral

Páginas estáticas customizáveis para conteúdo institucional da loja (Sobre, Contato, Políticas, etc.). Utiliza o Visual Builder para edição visual de blocos.

---

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

1. Usuário clica "Nova Página" no admin
2. Preenche título (slug gerado automaticamente)
3. Sistema cria `store_pages` + `page_templates` associado
4. Redireciona para `/pages/:pageId/builder`
5. Editor visual carrega com estrutura padrão (Header + Section vazia + Footer)
6. Usuário adiciona blocos e edita conteúdo
7. Pode salvar rascunho ou publicar

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
