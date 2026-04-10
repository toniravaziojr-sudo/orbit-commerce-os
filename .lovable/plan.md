

# Plano: Preenchimento IA dos Blocos Faltantes + Geração de Estrutura da Home Page

---

## Parte 1 — Mapeamento dos Blocos

### Blocos que JÁ possuem preenchimento por IA (14 blocos)
Banner, RichText, Button, FAQ, Highlights, SocialProof, ContentSection, StepsTimeline, CountdownTimer, StatsNumbers, ContactForm, Map, SocialFeed, PricingTable

### Blocos que DEVEM receber `aiFillable` (7 blocos)
| Bloco | Props a preencher com IA | Justificativa |
|---|---|---|
| **NewsletterUnified** | title, subtitle, buttonText | Textos de engajamento e CTA |
| **NewsletterPopup** | title, subtitle, buttonText, successMessage | Textos de conversão e feedback |
| **BannerProducts** | title, description, ctaText | Textos de oferta e CTA |
| **PersonalizedProducts** | title, subtitle | Títulos de seção |
| **LivePurchases** | title | Título de prova social |
| **LogosCarousel** | title, subtitle | Títulos de seção de parceiros |
| **ImageGallery** | title, subtitle | Títulos de galeria |

### Blocos onde IA NÃO faz sentido (8 blocos — excluídos)
| Bloco | Motivo |
|---|---|
| **Image** | Só tem imagem e alt — sem conteúdo textual relevante |
| **Video** | Configuração técnica (URL, aspect ratio) |
| **VideoCarousel** | Apenas URLs de vídeos e configuração de layout |
| **EmbedSocialPost** | Apenas URL de embed |
| **QuizEmbed** | Referência a quiz existente (ID) |
| **UpsellSlot** | Sem propsSchema (gerenciado por Theme Settings) |
| **CustomCode** | Código HTML/CSS — não é conteúdo editorial |
| **CategoryShowcase / ProductShowcase** | Conteúdo dinâmico vindo do catálogo |

---

## Parte 2 — Geração de Estrutura da Home Page com IA

Hoje a função "Criar com IA" existe apenas em **Páginas da Loja** (store_pages). Precisamos trazer essa mesma funcionalidade para o **Builder da Home Page**, oferecendo templates pré-definidos e geração por prompt livre.

### 7 Estruturas Pré-definidas para Home Page

1. **Loja Geral** — Banner, Highlights, ProductShowcase (carrossel), CategoryShowcase, SocialProof, Newsletter
2. **Moda / Vestuário** — Banner, CategoryShowcase, ProductShowcase (grid), ContentSection (editorial), SocialFeed, Newsletter
3. **Cosméticos / Beleza** — Banner, Highlights, ProductShowcase, StepsTimeline ("Como usar"), SocialProof, SocialFeed, Newsletter
4. **Eletrônicos / Tech** — Banner, Highlights, ProductShowcase (carrossel), BannerProducts, FAQ, StatsNumbers, Newsletter
5. **Alimentos / Bebidas** — Banner, Highlights, ProductShowcase, ContentSection, SocialProof, ContactForm
6. **Serviços / Assinaturas** — Banner, PricingTable, Highlights, StepsTimeline, SocialProof, FAQ, ContactForm
7. **Promocional / Black Friday** — Banner, CountdownTimer, ProductShowcase, BannerProducts, StatsNumbers, SocialProof, Newsletter

### Implementação

**UI no Builder da Home**: Quando o template da home estiver vazio (ou via ação no toolbar), exibir um diálogo com:
- Cards visuais das 7 estruturas pré-definidas (1 clique para aplicar)
- Opção "Personalizado" com campo de prompt livre (usa a edge function `ai-page-architect`)

**Edge Function**: Atualizar o `ai-page-architect` para:
- Usar os nomes de blocos consolidados (ProductShowcase em vez de ProductGrid/ProductCarousel legados)
- Aceitar um parâmetro `context: 'home'` para adaptar as regras de composição
- Incluir as 7 estruturas como few-shot examples no prompt

---

## Etapas de Implementação

1. **Adicionar `aiFillable` nos 7 blocos faltantes** no `registry.ts`
2. **Atualizar o `ai-page-architect`**: Sincronizar catálogo de blocos com nomes consolidados, adicionar contexto `home`, incluir as 7 estruturas como exemplos
3. **Criar componente `HomeStructureDialog`**: UI com cards das 7 estruturas + opção de prompt livre
4. **Integrar o diálogo no Builder da Home**: Botão no toolbar ou tela de boas-vindas quando a home está vazia
5. **Testar fluxo end-to-end**: Preenchimento IA dos novos blocos + geração de estrutura da home

---

## Detalhes Técnicos

- Arquivo principal de registro: `src/lib/builder/registry.ts` (adição de `aiFillable` em 7 blocos)
- Edge function: `supabase/functions/ai-page-architect/index.ts` (atualização do catálogo e adição do contexto home)
- Novo componente: `src/components/builder/HomeStructureDialog.tsx`
- Integração: `src/components/builder/VisualBuilder.tsx` (condicional `isHomePage`)
- Hook existente: `src/hooks/useAIBlockFill.ts` (sem alteração — já funciona automaticamente com novos `aiFillable`)

