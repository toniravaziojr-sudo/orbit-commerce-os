# Builder — Funções de IA (Preenchimento de Blocos + Geração de Estrutura)

> **STATUS:** ✅ Ready  
> **Camada:** Layer 3 — Especificações / Storefront  
> **Última atualização:** 2026-04-10

---

## Visão Geral

O Builder do sistema possui duas funcionalidades de IA:

1. **Preenchimento de Blocos com IA** (`aiFillable`) — Gera conteúdo textual (títulos, subtítulos, CTAs) para blocos individuais
2. **Geração de Estrutura de Página com IA** (`ai-page-architect`) — Cria a composição completa de blocos para uma página (Home Page ou Página de Venda)

Ambas são **funções de IA embutidas** no módulo Builder (não são agentes autônomos).

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/lib/builder/registry.ts` | Registro de blocos com propriedade `aiFillable` |
| `src/lib/builder/aiBlockCatalog.ts` | Catálogo de blocos disponíveis para a IA |
| `src/hooks/useAIBlockFill.ts` | Hook de preenchimento IA de blocos individuais |
| `supabase/functions/ai-block-fill/index.ts` | Edge Function de preenchimento de bloco |
| `supabase/functions/ai-page-architect/index.ts` | Edge Function de geração de estrutura de página |
| `src/components/builder/HomeStructureDialog.tsx` | Dialog de geração de estrutura da Home Page |
| `src/components/builder/VisualBuilder.tsx` | Builder visual (integra o HomeStructureDialog) |

---

## 1. Preenchimento de Blocos com IA (`aiFillable`)

### Como Funciona

Cada bloco no `registry.ts` pode ter uma propriedade `aiFillable` que lista quais campos textuais podem ser preenchidos automaticamente pela IA. Quando presente, o Builder exibe um botão "Preencher com IA" no painel de edição do bloco.

### Blocos com `aiFillable` (21 blocos)

| Bloco | Props preenchíveis | Tipo de conteúdo |
|-------|--------------------|------------------|
| **Banner** | title, subtitle, ctaText | Textos de destaque e CTA |
| **RichText** | content | Conteúdo editorial |
| **Button** | text | Texto do botão |
| **FAQ** | items (pergunta + resposta) | Perguntas frequentes |
| **Highlights** | title, subtitle, items | Destaques da loja |
| **SocialProof** | title, subtitle, items | Prova social |
| **ContentSection** | title, subtitle, content | Seção editorial |
| **StepsTimeline** | title, subtitle, steps | Passo-a-passo |
| **CountdownTimer** | title, subtitle | Textos de urgência |
| **StatsNumbers** | title, items | Números e estatísticas |
| **ContactForm** | title, subtitle | Textos do formulário |
| **Map** | title, subtitle | Textos da seção de mapa |
| **SocialFeed** | title, subtitle | Textos de feed social |
| **PricingTable** | title, subtitle, plans | Tabela de preços |
| **NewsletterUnified** | title, subtitle, buttonText | Textos de engajamento e CTA |
| **NewsletterPopup** | title, subtitle, buttonText, successMessage | Textos de conversão e feedback |
| **BannerProducts** | title, description, ctaText | Textos de oferta e CTA |
| **PersonalizedProducts** | title, subtitle | Títulos de seção |
| **LivePurchases** | title | Título de prova social |
| **LogosCarousel** | title, subtitle | Títulos de seção de parceiros |
| **ImageGallery** | title, subtitle | Títulos de galeria |

### Blocos Excluídos (sem `aiFillable`)

| Bloco | Motivo |
|-------|--------|
| **Image** | Apenas imagem e alt — sem conteúdo textual relevante |
| **Video** | Configuração técnica (URL, aspect ratio) |
| **VideoCarousel** | Apenas URLs de vídeos e configuração de layout |
| **EmbedSocialPost** | Apenas URL de embed |
| **QuizEmbed** | Referência a quiz existente (ID) |
| **UpsellSlot** | Sem propsSchema (gerenciado por Theme Settings) |
| **CustomCode** | Código HTML/CSS — não é conteúdo editorial |
| **CategoryShowcase** | Conteúdo dinâmico vindo do catálogo |
| **ProductShowcase** | Conteúdo dinâmico vindo do catálogo |

### Edge Function: `ai-block-fill`

Recebe o tipo do bloco e o contexto da loja, retorna os valores preenchidos para os campos `aiFillable`.

---

## 2. Geração de Estrutura de Página com IA (`ai-page-architect`)

### Contextos Suportados

| Contexto | Onde aparece | Descrição |
|----------|-------------|-----------|
| `store_page` | Páginas da Loja (venda) | Gera estrutura para páginas de venda |
| `home` | Builder da Home Page | Gera estrutura para a home page da loja |

### 7 Estruturas Pré-definidas para Home Page

| # | Segmento | Blocos |
|---|----------|--------|
| 1 | **Loja Geral** | Banner → Highlights → ProductShowcase (carrossel) → CategoryShowcase → SocialProof → NewsletterUnified |
| 2 | **Moda / Vestuário** | Banner → CategoryShowcase → ProductShowcase (grid) → ContentSection (editorial) → SocialFeed → NewsletterUnified |
| 3 | **Cosméticos / Beleza** | Banner → Highlights → ProductShowcase → StepsTimeline ("Como usar") → SocialProof → SocialFeed → NewsletterUnified |
| 4 | **Eletrônicos / Tech** | Banner → Highlights → ProductShowcase (carrossel) → BannerProducts → FAQ → StatsNumbers → NewsletterUnified |
| 5 | **Alimentos / Bebidas** | Banner → Highlights → ProductShowcase → ContentSection → SocialProof → ContactForm |
| 6 | **Serviços / Assinaturas** | Banner → PricingTable → Highlights → StepsTimeline → SocialProof → FAQ → ContactForm |
| 7 | **Promocional / Black Friday** | Banner → CountdownTimer → ProductShowcase → BannerProducts → StatsNumbers → SocialProof → NewsletterUnified |

### UI: HomeStructureDialog

Acessível via botão **"Criar Estrutura com IA"** na sidebar do Builder quando editando a Home Page. Oferece:

- **7 cards visuais** das estruturas pré-definidas (1 clique para aplicar)
- **Opção "Personalizado"** com campo de prompt livre (invoca `ai-page-architect` com `context: 'home'`)

### Edge Function: `ai-page-architect`

Recebe um prompt do usuário e o contexto (`home` ou `store_page`), retorna um array de blocos com tipo e props padrão. Quando `context: 'home'`, as 7 estruturas pré-definidas são injetadas como few-shot examples no prompt do modelo.

### Catálogo de Blocos Consolidado

A edge function usa nomes consolidados de blocos (ex: `ProductShowcase` em vez de `ProductGrid`/`ProductCarousel` legados). Um mapeamento interno converte nomes legados automaticamente:

| Nome Legado | Nome Consolidado |
|-------------|-----------------|
| `ProductGrid` | `ProductShowcase` |
| `ProductCarousel` | `ProductShowcase` |
| `CategoryGrid` | `CategoryShowcase` |
| `NewsletterSignup` | `NewsletterUnified` |
| `Newsletter` | `NewsletterUnified` |
| ... (19 aliases no total) | ... |

---

## Módulos Relacionados

| Módulo | Relação |
|--------|---------|
| Storefront / Builder | Integração direta — o Builder consome ambas as funções |
| CRM / Atendimento | Sem relação |
| Marketing / Tráfego | Sem relação |
| Produtos | O catálogo de produtos alimenta blocos `ProductShowcase` |

---

## Observações

- As funções de IA do Builder são **funções embutidas**, não agentes autônomos (Layer 2, § 9.1)
- O hook `useAIBlockFill.ts` detecta automaticamente novos blocos com `aiFillable` — não precisa de alteração quando novos blocos são adicionados
- As estruturas pré-definidas da Home Page podem ser expandidas no futuro sem alteração de código (basta atualizar as constantes no `HomeStructureDialog.tsx`)
