

## Plano Definitivo: Correção Header/Footer + Upgrade do Motor de Geração IA

---

### Problema 1: Header e Footer quebrados nas AI Landing Pages

**Causa raiz identificada:** `StorefrontHeader` e `StorefrontFooter` usam `useParams<{ tenantSlug }>()` para obter o slug do tenant. Nas AI Landing Pages acessadas via domínio customizado (ex: `loja.respeiteohomem.com.br/ai-lp/...`), **não existe `:tenantSlug` na URL** — o tenant é resolvido via hostname dentro do `StorefrontAILandingPage`. Resultado: header/footer recebem string vazia e não conseguem buscar dados.

**Solução:**

O `StorefrontAILandingPage` já resolve o tenant via hostname (`useTenantFromHostname`), mas não compartilha essa informação com os componentes filhos. A correção é:

1. **Envolver o header/footer com o `TenantSlugContext`** do `TenantStorefrontLayout` — injetar o `resolvedTenantSlug` no context para que `useTenantSlug()` funcione corretamente nos componentes filhos
2. **Garantir que `StorefrontHeader` e `StorefrontFooter` usem `useTenantSlug()`** (que já resolve param vs context) em vez de `useParams()` diretamente

Arquivos afetados:
- `src/pages/storefront/StorefrontAILandingPage.tsx` — wrapping com TenantSlugContext.Provider
- `src/components/storefront/StorefrontHeader.tsx` — trocar `useParams` por `useTenantSlug`
- `src/components/storefront/StorefrontFooter.tsx` — trocar `useParams` por `useTenantSlug`

---

### Problema 2: IA gera páginas "catálogo" sem criatividade visual

**Diagnóstico:** O prompt atual (v2.0.0) é detalhado em regras CSS mas **fraco em direção criativa e comercial**. Ele diz "use Inter e Sora, padding 80-120px, cards com border-radius 16px" — instruções mecânicas que resultam em layouts previsíveis e genéricos. Faltam:

- **Direção artística** — a IA não recebe referências visuais de páginas de alta conversão
- **Copy persuasivo** — o prompt não instrui sobre técnicas de copywriting (AIDA, PAS, storytelling)
- **Inteligência de design adaptativa** — não diferencia nicho (cosmético, tech, moda, alimentos)
- **Imagens como hero visual** — o prompt trata imagens como "coloque no src", mas não instrui sobre composições (imagem full-bleed, sobreposição com gradiente, mockups contextuais)

**Solução: Reescrita completa do system prompt (v3.0.0)**

O novo prompt será estruturado em 5 pilares:

#### Pilar 1 — Direção Criativa por Nicho
Em vez de um design genérico, a IA analisará o `product_type`, `tags` e `description` do produto para identificar o nicho e aplicar uma direção visual correspondente:
- **Saúde/Beleza masculina** → Dark premium, gold accents, autoridade médica
- **Moda/Acessórios** → Editorial, whitespace generoso, lifestyle imagery
- **Tech/Eletrônicos** → Gradientes neon, glassmorphism, specs visuais
- **Alimentos/Bebidas** → Tons quentes, fotografia sensorial, texturas orgânicas

#### Pilar 2 — Copy Persuasivo Estruturado
Instruções explícitas de copywriting no prompt:
- Hero: Técnica PAS (Problem → Agitation → Solution) ou gancho de curiosidade
- Headlines com números específicos e power words
- Micro-copy de urgência nos CTAs ("Últimas unidades", "Oferta por tempo limitado")
- Seção "Antes vs Depois" ou "Com vs Sem" para criar contraste emocional

#### Pilar 3 — Composição Visual de Produto
Em vez de simplesmente "coloque a imagem no src":
- Hero com imagem do produto em composição com gradiente (overlay de 30-60% sobre a imagem como background)
- Mockup contextual: produto flutuando com sombra, ângulo 3D via CSS transform
- Grid de galeria assimétrico (imagem grande + 2 pequenas ao lado)
- Imagens com tratamento visual (border, glow da cor primária, badge sobreposto)

#### Pilar 4 — Estrutura Comercial Otimizada
Nova estrutura de seções focada em conversão:
1. **Hero de impacto** — headline PAS + imagem hero composicional + CTA primário + trust indicators inline
2. **Transformação visual** — antes/depois ou problema/solução com layout split
3. **Produto em destaque** — foto grande + benefícios em lista + preço com âncora (de/por) + CTA
4. **Prova social dinâmica** — reviews reais com foto, rating, destaque de frases-chave
5. **Comparativo de valor** — "Por que [produto] vs alternativas" em tabela visual
6. **Oferta irresistível** — card de preço com urgência, garantia, selos, CTA pulsante
7. **FAQ estratégico** — objeções comuns transformadas em perguntas

#### Pilar 5 — Efeitos Visuais Premium
Instruções de CSS avançado:
- Gradientes multicamada (mesh gradient backgrounds)
- Glassmorphism em cards de destaque
- Micro-animações (floating product, pulse CTA, count-up stats)
- Parallax sutil em seções de background
- Efeitos de texto (gradient text para headlines)

**Arquivo afetado:** `supabase/functions/ai-landing-page-generate/index.ts`

---

### Problema Bônus: iframe height não se ajusta ao conteúdo

O iframe da AI LP usa `minHeight: '80vh'` fixo — isso pode cortar ou deixar espaço vazio. Será adicionado um `postMessage` de auto-resize do iframe.

**Arquivos afetados:**
- `src/pages/storefront/StorefrontAILandingPage.tsx` — listener de resize + script injetado no HTML

---

### Resumo de entregas

| # | Entrega | Arquivos |
|---|---------|----------|
| 1 | Fix header/footer em AI LPs (TenantSlugContext) | StorefrontAILandingPage, StorefrontHeader, StorefrontFooter |
| 2 | Prompt v3.0.0 — Motor criativo completo | ai-landing-page-generate/index.ts |
| 3 | Auto-resize do iframe | StorefrontAILandingPage |

