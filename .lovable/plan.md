

## Plano: Geração de Páginas com IA via Blocos Nativos (Parte 1 — Arquiteto de Estrutura)

### Minha Opinião sobre a Sugestão do ChatGPT

A ideia das 3 camadas (Manifesto + Receitas + Prompt Router) é **conceitualmente correta**, mas na prática é **overengineered** para o nosso caso. Aqui vai o porquê e o que eu faria diferente:

1. **Manifesto de Blocos com metadados extras (role, strengths, limitations, ai_safe)** — Desnecessário. O `registry.ts` já TEM tudo que a IA precisa: `type`, `label`, `category`, `propsSchema`. Criar uma segunda camada de metadados é duplicação que vai ficar desatualizada. Em vez disso, passamos um **resumo compacto do registry** direto no prompt da IA.

2. **Receitas estruturais rígidas** — Parcialmente útil, mas rígido demais. Se criarmos 20 receitas fixas, a IA vira um "seletor de templates" glorificado. O valor está em dar **exemplos** (few-shot) e **regras de composição**, não receitas fechadas.

3. **Prompt Router com confidence score** — Overcomplexo. A IA moderna (Gemini Flash) já faz essa classificação naturalmente se instruída corretamente.

### Minha Abordagem: Mais Simples, Mais Prática

Em vez de 3 camadas separadas, faço **1 edge function** com um prompt bem construído que contém:

- **Catálogo compacto** dos blocos disponíveis (extraído automaticamente do registry — type, label, category, para que serve)
- **Regras de composição** (máximo X blocos, sempre começar com Header, terminar com Footer, etc.)
- **3-5 exemplos de estruturas boas** (few-shot learning — vale mais que 20 receitas)
- A IA recebe o prompt do usuário e retorna um **array de block types ordenado**

O sistema então usa `blockRegistry.createDefaultNode()` para instanciar cada bloco. Pronto.

### Implementação Técnica

#### Arquivo 1: `src/lib/builder/aiBlockCatalog.ts` (novo)
Função que extrai do registry um resumo compacto dos blocos utilizáveis pela IA:

```text
Entrada: blockRegistry.getAll()
Saída: string formatada tipo:
  "Banner (media) — Banner único ou carrossel de imagens com CTA
   ProductGrid (ecommerce) — Vitrine de produtos em grade
   FAQ (content) — Perguntas e respostas em acordeão
   ..."
```

Filtra blocos que **não fazem sentido** para geração automática (Page, Header, Footer, CategoryPageLayout, ProductDetails, Cart, Checkout, ThankYou, AccountHub, OrdersList, OrderDetail, TrackingLookup, BlogListing — blocos de sistema).

Inclui **regras de composição embutidas**:
- Toda página tem Header no topo e Footer no final (injetados automaticamente, não pela IA)
- Máximo 8-12 blocos de conteúdo
- Não repetir o mesmo tipo consecutivamente
- Landing pages devem ter impacto visual no topo (Banner)

Inclui **3-5 exemplos few-shot** de estruturas completas:
```text
Exemplo: "Landing de produto direto"
→ Banner, InfoHighlights, ContentColumns, Testimonials, FAQ, Button

Exemplo: "Home institucional"
→ Banner, FeaturedCategories, ProductCarousel, TextBanners, Newsletter

Exemplo: "Página de contato"
→ Banner, ContactForm, Map, FAQ
```

#### Arquivo 2: `supabase/functions/ai-page-architect/index.ts` (nova edge function)
- Recebe: `{ prompt: string, pageName: string, tenantId: string }`
- Monta o system prompt com o catálogo + regras + exemplos
- Usa **tool calling** (structured output) para extrair: `{ blocks: [{ type: string, reason: string }] }`
- Retorna o array de tipos de blocos ordenado
- Modelo: `google/gemini-3-flash-preview` (rápido, barato, suficiente para esta tarefa)

#### Arquivo 3: Modificar `src/pages/LandingPages.tsx`
- O botão "Criar com IA" abre um **dialog simplificado** (não o wizard de 5 etapas atual)
- Campos: Nome + Slug + Prompt curto (textarea)
- Ao confirmar: chama a edge function → recebe array de tipos → monta `BlockNode[]` via `createDefaultNode()` → salva em `store_pages` com `type: 'landing_page'` → navega para o builder

#### Arquivo 4: Modificar ou criar novo dialog
- Reutilizar a infraestrutura de `handleCreateBuilderPage` que já existe em `LandingPages.tsx` (cria store_page + template + redireciona para builder)
- A diferença é que em vez de página em branco, injeta os blocos gerados pela IA como `content`

### Fluxo do Usuário

```text
1. Clica "Criar com IA"
2. Digita: Nome="Black Friday 2026", Prompt="Página promocional com contagem regressiva, produtos em destaque e prova social"
3. Sistema chama edge function → IA retorna: [Banner, CountdownTimer, ProductCarousel, Testimonials, StatsNumbers, Newsletter, Button]
4. Sistema monta BlockNode[] com createDefaultNode() para cada tipo
5. Envolve tudo em Page > [Header, ...blocos, Footer]
6. Salva em store_pages, abre no builder
7. Usuário vê a página montada e pode editar/reorganizar blocos
```

### O que Reutilizamos do Sistema Atual

- `handleCreateBuilderPage()` — lógica de criação de store_page + template
- `createDefaultNode()` — instanciação de blocos
- `blockRegistry` — catálogo de blocos
- `getBlankTemplate()` — estrutura base (Header + Footer)
- Infraestrutura de edge functions + AI Gateway
- Validação de slug (`validateSlug`, `generateSlug`)

### O que NÃO Reutilizamos

- `CreateLandingPageDialog` (wizard de 5 etapas com briefing/reference/products) — complexo demais para o novo fluxo. Mantemos intacto para quem quer usar o gerador de HTML com IA
- `ai-landing-page-generate` edge function — gera HTML puro, não blocos nativos
- `ai-landing-page-enhance-images` — específico do pipeline HTML

### Estimativa
- ~3-4 mensagens para implementar completamente
- Nenhuma mudança no builder existente
- Nenhuma migration de banco necessária (usa `store_pages.content` que já existe)

