# Páginas Institucionais — Regras e Especificações

> **Status:** PRONTO ✅

## Visão Geral

Módulo unificado de **Páginas** (`/pages`) que combina Páginas Institucionais, Landing Pages com IA e Landing Pages no Builder em uma **única listagem** (sem abas). Todas as páginas são criadas e gerenciadas com as mesmas ferramentas.

### Modos de Criação

O botão "Criar Página" oferece 4 opções:

| Opção | Descrição |
|-------|-----------|
| **Criar manualmente** | Insere nome e slug, redireciona para o Visual Builder (blocos nativos) |
| **Página de vendas** | Insere nome, slug e prompt curto. A IA monta a estrutura de blocos nativos automaticamente e abre no Builder para edição. Usa edge function `ai-page-architect` + `blockRegistry.createDefaultNode()`. Salva em `store_pages` (type=landing_page). |
| **Importar Página** | Importa página a partir de URL alvo — cria `ai_landing_pages` |
| **Páginas Essenciais IA** | Gera pacote de 8 páginas institucionais essenciais para e-commerce via IA (Quem Somos, Fale Conosco, FAQ, Como Comprar, Frete e Entrega, Trocas e Devoluções, Política de Privacidade, Termos de Uso). Usa edge function `ai-essential-pages` + dados de `tenants` e `store_settings`. Não sobrescreve páginas existentes. Salva em `store_pages` (type=institutional). |

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

## Motor de Geração IA v3.5.0

### Edge Function: `ai-landing-page-generate`

| Pilar | Descrição |
|-------|-----------|
| **1. Direção Criativa por Nicho** | Analisa `product_type`, `tags`, `description` e aplica direção visual (Dark Premium, Editorial, Neon-Tech, Orgânico, etc.) |
| **2. Copy Persuasivo PAS** | Headlines com PAS, power words, micro-copy de urgência, seção Antes vs Depois |
| **3. Composição Visual de Produto** | Gradient overlay no hero, 3D transforms, galeria assimétrica, badges sobrepostos |
| **4. Estrutura Comercial** | 9 seções ordenadas: Hero → Trust Bar → Transformação → Produto → Prova Social → Comparativo → Oferta → FAQ → CTA Final |
| **5. Efeitos Visuais Premium** | Glassmorphism, pulse CTA, fadeInUp, gradient text, divider waves |
| **6. Fallback Prompts (v3.5.0)** | 5 templates de alta conversão selecionados automaticamente quando o prompt do usuário é curto/incompleto |

### Dados Consumidos
- `products` (nome, preço, descrição, imagens, tags, tipo)
- `product_reviews` (prova social real)
- `ads_creative_assets` (tom de voz e headlines existentes)
- `store_settings` (nome, logo, cor primária)
- `files` — Drive do tenant (busca imagens por nome/slug do produto — v3.4.0; gera lifestyle via IA se nada encontrado)

### Modelo: `google/gemini-2.5-pro` via `ai-router`

### Geração de Criativos (v3.1.0)

O pipeline gera automaticamente uma **imagem hero criativa** antes de construir o HTML:

1. **Download** da imagem principal do produto (catálogo)
2. **Envio** ao `google/gemini-3-pro-image-preview` via Lovable Gateway com prompt de fotografia publicitária premium
3. **Fallback** para `google/gemini-2.5-flash-image` se o modelo primário falhar
4. **Upload** do criativo gerado ao bucket `store-assets` (pasta `lp-creatives/`)
5. **Injeção** da URL pública do criativo no prompt do Gemini Pro (HTML), com instrução para usar como imagem principal no Hero e destaque

Se a geração falhar em ambos os modelos, o sistema usa as imagens do catálogo normalmente (graceful degradation).

### Cores da Marca (v3.1.1)

O motor busca automaticamente as **cores da identidade visual** do tenant antes de gerar o HTML:

1. **Fonte**: `storefront_template_sets.published_content.themeSettings` (cores do tema publicado)
2. **Dados extraídos**: `primaryColor`, `secondaryColor`, `accentColor`, `buttonPrimaryBg`, `buttonPrimaryText`
3. **Injeção no prompt**: As cores são passadas como regras obrigatórias ao Gemini Pro, impedindo cores aleatórias
4. **Fallback**: Se não houver tema publicado, usa cores do `store_settings` (logo + cor primária)

### Proteção de Logo (v3.2.0)

O prompt inclui regras explícitas para **nunca alterar visualmente** a logo do lojista:

| Regra | Descrição |
|-------|-----------|
| **Sem filtros CSS** | Proibido `opacity`, `brightness`, `grayscale`, `invert`, `mix-blend-mode`, `backdrop-filter` na logo |
| **Render simples** | Logo via `<img>` com `style="display:block; max-width:200px; height:auto;"` sem outros estilos |
| **Container adaptativo** | Em comparativos: `min-width:180px`, container branco APENAS se logo tem elementos escuros sobre fundo dark |
| **Fundo adaptativo** | Se LP dark + logo clara transparente → sem container. Se LP dark + logo escura transparente → container branco |
| **Teste mental** | Se as cores originais não são visíveis, a regra foi violada |

### Disciplina de Imagens (v3.2.0)

| Área da LP | Imagens permitidas |
|------------|-------------------|
| **Hero / Produto em Destaque** | Criativo gerado OU imagem principal com overlay |
| **Grid de ofertas / Kits** | Imagens de catálogo (exceção única) |
| **Seções de texto (FAQ, CTA, Transformação)** | Apenas CSS, ícones, emojis, badges — **sem `<img>` de produto** |

### HTML Limpo (v3.2.0)

O prompt exige HTML sem tags visíveis ao usuário (ex: `</section>` aparecendo como texto). Todas as tags devem ser corretamente fechadas e aninhadas.

### Preview no Editor Admin (v3.2.0)

O editor (`LandingPageEditor.tsx`) detecta se `generated_html` já é um documento completo (`<!DOCTYPE html>`) e, se sim, usa-o diretamente no iframe sem re-embrulhar em outro `<html>`. Isso elimina o bug de double-wrapping que causava tags HTML visíveis na página.

### Renderização Pública (anti-tela-preta) — v3.8.1

O CSS de segurança (`#lp-safety`) é injetado no `<head>` do iframe em **3 pontos de renderização**:
- `StorefrontAILandingPage.tsx` (página pública)
- `LandingPageEditor.tsx` (editor admin)
- `LandingPagePreviewDialog.tsx` (modal de preview)

#### Regras do Safety CSS (v3.8.1)

```css
/* Mata TODAS as animações CSS — previne opacity:0 de keyframes malformados */
*, *::before, *::after {
  animation: none !important;
}
/* Força visibilidade universal — cobre inline styles e classes como .animate-section */
* {
  opacity: 1 !important;
  visibility: visible !important;
}
```

**Por que `animation: none` e não apenas `animation-fill-mode: none`?**
- O Gemini frequentemente gera keyframes com CSS malformado (ex: `translateY(0)` sem `transform:`)
- `animation-fill-mode: none` no seletor `*` tem especificidade 0-0-0, que perde para classes como `.animate-section` (0-1-0) mesmo com `!important` quando o shorthand `animation` redefine o fill-mode
- `animation: none !important` mata a animação inteira, eliminando o problema na raiz
- `opacity: 1 !important` no `*` garante visibilidade mesmo com inline styles `opacity: 0`

**NÃO usar `transform: none !important`** — isso quebra efeitos visuais intencionais (gradient text, composição de produto, overlays).

### Fallback Prompts Inteligentes (v3.5.0)

Quando o usuário fornece um prompt curto ou incompleto (< 80 chars, < 3 frases, ou sem palavras-chave de direção criativa), o motor seleciona automaticamente um dos 5 templates de alta conversão:

| ID | Nome | Nichos Ideais |
|----|------|---------------|
| `dark-authority` | Autoridade Premium (Dark Mode) | Saúde, beleza, masculino, suplementos, cosméticos |
| `editorial-clean` | Editorial Clean (Moda & Lifestyle) | Moda, acessórios, joias, decoração, perfumes |
| `tech-futurista` | Tech Futurista (Gadgets & Eletrônicos) | Tech, gadgets, eletrônicos, software, apps |
| `organico-sensorial` | Orgânico Sensorial (Alimentos & Naturais) | Alimentos, bebidas, orgânicos, naturais, fit |
| `urgencia-conversao` | Máxima Conversão (Universal) | Qualquer nicho — fallback padrão |

**Lógica de seleção:**
1. Analisa `product_type`, `tags`, `description` e `name` do produto
2. Calcula score de match com os nichos ideais de cada template
3. Se nenhum match é encontrado (score = 0), usa `urgencia-conversao`
4. O prompt original do usuário é **preservado** e o template é injetado como "direção criativa complementar"

**Arquivo:** `supabase/functions/_shared/marketing/fallback-prompts.ts`
**Metadata:** `generation_metadata.fallback_prompt_used` registra o ID do template usado (ou `null` se não usado)

### Anti-Alucinação de Produto (v3.6.0)

O motor v3.6.0 corrige o problema de a IA inventar nomes de produtos inexistentes. Mudanças:

| Regra | Descrição |
|-------|-----------|
| **Ordem de execução** | Dados do produto são buscados ANTES de qualquer geração de imagem ou construção de prompt |
| **Whitelist de nomes** | O system prompt inclui lista explícita de nomes permitidos: `ALLOWED_PRODUCT_NAMES: [...]` |
| **Proibição explícita** | Prompt instrui: "NUNCA invente nomes de marca/produto. Use APENAS os nomes da lista." |
| **Verificação pós-geração** | Pipeline valida que o HTML contém o nome correto do produto e pelo menos 1 URL de imagem válida |
| **Imagens obrigatórias** | Se `productImages` está vazio, o motor gera imagens via IA antes de chamar o LLM |

### Preview no Editor Admin (v5.3.0)

O `LandingPageEditor.tsx` suporta renderização dual:

| Motor | Renderização | Detalhes |
|-------|-------------|----------|
| **V5+ (Blocos)** | `BlockRenderer` nativo (React) | Lê `generated_blocks` (JSON). Renderiza diretamente como componentes React no editor, sem iframe. |
| **Legado (HTML)** | Iframe com `srcDoc` | Lê `generated_html`. Usa iframe com safety CSS e auto-resize script. |

**Prioridade:** `generated_blocks` > `generated_html`. Se ambos existirem, blocos têm prioridade.

O editor **NÃO renderiza** `StorefrontHeader`/`StorefrontFooter` como componentes React — isso causava conflitos de CSS com o painel admin.

| Item | Implementação |
|------|--------------|
| **Preview V5** | `BlockRenderer` direto com `isEditing=false` e `isPreview=true` |
| **Preview Legado** | Iframe-only com o HTML gerado pela IA |
| **Indicadores** | Banners informativos indicam onde header/footer aparecerão na versão pública |
| **Público** | `StorefrontAILandingPage.tsx` continua renderizando header/footer como React components no contexto correto |
| **Anti-Duplicação** | Edge function instrui a IA a NÃO incluir header/footer/navegação/copyright no HTML quando `show_header`/`show_footer` estão ativados |

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

---

## Changelog de Correções

### v3.8.2 — Sanitização de Scroll e Visibilidade

**Arquivo:** `src/lib/sanitizeAILandingPageHtml.ts`

| Correção | Descrição |
|----------|-----------|
| `min-height: XXvh → auto` | Remove `min-height` baseado em `vh` que causava scroll infinito no iframe auto-resize |
| `height: >=50vh → auto` | Remove `height` grande baseado em `vh` (preserva valores pequenos como `2vh`) |
| `animation-fill-mode: both/forwards` | Remove fill-mode que causava `opacity:0` stuck (tela preta) |
| `animation-delay` | Remove delays que mantinham elementos invisíveis |

### v3.9.0 — Container Queries, Hero Diversificado, Logo Adaptativa

**Arquivos:** `StorefrontAILandingPage.tsx`, `ai-landing-page-generate/index.ts`, `fallback-prompts.ts`

| Correção | Descrição |
|----------|-----------|
| Container queries fix | Header/Footer em AI LPs agora envoltos em `<div style="containerType: inline-size">` para container queries funcionarem |
| staleTime reduzido | Query pública de AI LP agora usa `staleTime: 30s` + `refetchOnWindowFocus: true` para toggle show_header/show_footer refletir rápido |
| Hero diversificado | 3 layouts de hero (Split, Clean, Background) — IA escolhe baseado no nicho. Apenas `dark-authority` e `urgencia-conversao` usam background composicional |
| Logo adaptativa | `max-width` aumentado para `200px`, `min-width: 180px` em comparativos, container branco condicional baseado no contraste fundo/logo |
| Removido `min-height: 90vh` | Instrução fixa removida do prompt principal e fallback prompts |
