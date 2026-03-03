

# Plano: Correção Total do Motor de AI Landing Pages (v3.10.0)

## Diagnóstico dos 5 Problemas

Após análise do HTML gerado (`t7`), do system prompt no edge function e do renderer `StorefrontAILandingPage.tsx`:

### 1. Logo não adapta cores ao design da página
**Causa**: O system prompt já tem regras de logo, mas a IA as ignora parcialmente. Na screenshot (image-188), a logo aparece com container branco na tabela comparativa, mas os textos da logo ("RESPEITE O HOMEM") ficam pouco legíveis. A instrução de "fundo adaptativo" é vaga e a IA não a aplica corretamente.

### 2. Header/Footer com bugs visuais em desktop
**Causa**: O `StorefrontAILandingPage.tsx` renderiza o Header/Footer nativos da loja FORA do iframe, enquanto o conteúdo da LP está DENTRO de um iframe com `srcDoc`. Isso cria dois contextos CSS isolados. O Header/Footer herdam o tema via `StorefrontThemeInjector`, mas não recebem os mesmos providers de dados que as páginas normais do storefront (ex: `usePublicStorefront` com menus, categorias, etc.). O Header depende de `TenantSlugContext` que está sendo passado, mas pode haver inconsistências com dados de menu/categorias.

### 3. Sem versão mobile dedicada — responsividade ruim
**Causa**: O system prompt define `@media (max-width: 768px)` com apenas `h1 { font-size: 2rem }` e `h2 { font-size: 1.5rem }`. Faltam regras para: padding lateral adequado (48px → 20px), empilhamento de colunas em grids complexos (tabela comparativa, hero split), imagens em full-width, CTAs em full-width, e tamanhos de fonte para body text. A tabela comparativa (4 colunas) é especialmente problemática no mobile.

### 4. Uso excessivo de emojis
**Causa**: O system prompt usa emojis extensivamente nas instruções de seções (🔥, 📊, 💡, 🏆, ⭐, 🆚, 💰, ❓, 🎯) e a IA replica isso no HTML gerado. Também instrui a usar "✅", "❌", "🛡️", "🚚", "⭐", "🔒" nos textos de copy.

### 5. Imagens geradas mal ambientadas
**Causa**: Os prompts de geração de hero creative e lifestyle usam instruções genéricas ("background profissional premium", "iluminação de estúdio dramática"). Não consideram o nicho específico do produto nem fornecem contexto visual suficiente sobre a ambientação desejada. O prompt de lifestyle pede "produto EM USO" mas não especifica cenário concreto para o nicho.

---

## Parte 1: Correção do System Prompt — Responsividade Mobile (Issue 3)

**Arquivo**: `supabase/functions/ai-landing-page-generate/index.ts`

Substituir o bloco de CSS responsivo no system prompt (linhas ~898-904) por regras mobile muito mais completas:

```css
/* MOBILE-FIRST — Regras obrigatórias para < 768px */
@media (max-width: 768px) {
  h1 { font-size: 1.75rem !important; line-height: 1.2 !important; }
  h2 { font-size: 1.4rem !important; }
  h3 { font-size: 1.15rem !important; }
  .section { padding: 48px 0 !important; }
  .container { padding: 0 20px !important; }
  
  /* Forçar empilhamento de todas as grids */
  .hero-grid, .spotlight-grid, .transformation-grid,
  [style*="grid-template-columns"], [class*="grid"] {
    grid-template-columns: 1fr !important;
  }
  
  /* Tabelas comparativas: scroll horizontal */
  .comparison-table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .comparison-table { min-width: 600px; }
  
  /* CTAs full-width */
  .cta-button { width: 100% !important; text-align: center !important; padding: 16px 24px !important; font-size: 16px !important; }
  
  /* Imagens */
  img { max-width: 100% !important; height: auto !important; }
  
  /* Preço */
  .price-new { font-size: 2.2rem !important; }
}
```

Adicionar instrução explícita no prompt:

> **RESPONSIVIDADE MOBILE — REGRA CRÍTICA**: O HTML DEVE funcionar perfeitamente em telas de 375px. TODAS as grids com 2+ colunas DEVEM empilhar em 1 coluna no mobile. Tabelas comparativas DEVEM ter wrapper com `overflow-x: auto`. CTAs DEVEM ser `width: 100%` no mobile. NUNCA use `vw` para font-size. TESTE MENTAL: visualize a página em um iPhone 13 Mini — nada deve transbordar.

---

## Parte 2: Redução de Emojis (Issue 4)

**Arquivo**: `supabase/functions/ai-landing-page-generate/index.ts`

Adicionar regra explícita no system prompt:

> **EMOJIS — USO MÍNIMO**: Emojis devem ser usados com MODERAÇÃO. Máximo de 5-8 emojis em TODA a landing page. Use emojis APENAS para: checkmarks (✓ ou ✅ — máx 2 contextos), badges de urgência (1-2 no máx). NÃO use emojis em headlines, subtítulos ou CTAs. Prefira ícones CSS/SVG, texto estilizado com CSS e badges visuais com background-color ao invés de emojis. A página deve ter aparência PROFISSIONAL e limpa, não de post de Instagram.

Remover os emojis das instruções de seções no prompt (🔥, 📊, 💡, etc.) — substituir por numeração simples.

---

## Parte 3: Logo Adaptativa (Issue 1)

**Arquivo**: `supabase/functions/ai-landing-page-generate/index.ts`

Refinar a regra de logo no system prompt. Atualmente a instrução de "fundo adaptativo" depende de um "teste mental" que a IA não executa corretamente. Substituir por regra concreta:

> **LOGO — REGRA SIMPLIFICADA**: Ao usar a logo em qualquer seção (comparativo, marca, etc.), SEMPRE envolva em container branco com padding: `<div style="background:#fff; padding:12px 16px; border-radius:8px; display:inline-block;"><img src="LOGO_URL" style="max-width:180px; height:auto; display:block;" alt="Logo NOME_LOJA"></div>`. Isso garante legibilidade universal em qualquer fundo. NÃO aplique filter, opacity, mix-blend-mode ou qualquer efeito CSS na logo.

---

## Parte 4: Qualidade das Imagens Geradas (Issue 5)

**Arquivo**: `supabase/functions/ai-landing-page-generate/index.ts`

Melhorar o prompt de geração de imagens (funções `generateHeroCreative` e lifestyle). Atualmente o prompt é genérico. Mudanças:

1. **Hero creative**: Adicionar contexto de nicho ao prompt. Usar `firstProduct.product_type` e `firstProduct.tags` para gerar instruções de cenário específicas:
   - Cosméticos/saúde: "bancada de banheiro premium com iluminação natural, toalhas brancas, superfície de mármore"
   - Tech: "mesa de escritório moderna e clean, iluminação LED azul sutil"
   - Alimentos: "mesa de madeira rústica, ingredientes naturais ao redor"
   - Default: "superfície minimalista com gradiente de luz suave"

2. **Lifestyle**: Adicionar cenários concretos por nicho em vez de "contexto real" genérico.

3. **Ambas**: Adicionar instrução: "A imagem deve ter coerência visual com uma landing page dark/premium. Evite backgrounds muito claros ou cores que destoem do layout escuro."

---

## Parte 5: Header/Footer Nativos em LP (Issue 2)

**Arquivo**: `src/pages/storefront/StorefrontAILandingPage.tsx`

O problema é que o Header/Footer renderizam fora do iframe mas podem ter dados incompletos. Verificar e corrigir:

1. Garantir que o `StorefrontHeader` e `StorefrontFooter` recebem todos os dados necessários. Atualmente dependem de `TenantSlugContext` e dos hooks internos de auto-fetch (conforme memory `header-data-architecture-self-sufficiency`), o que deveria funcionar.

2. O bug visual pode ser causado pelo CSS do tema da loja não estar carregando completamente. O `StorefrontThemeInjector` injeta as variáveis CSS, mas pode haver um timing issue. Investigar se o header está renderizando antes do ThemeInjector aplicar as variáveis.

3. Possível fix: mover `StorefrontThemeInjector` para ANTES do header no DOM, e adicionar `key={resolvedTenantSlug}` para forçar re-render quando o slug muda.

4. Para bugs de imagens/botões no desktop: pode ser conflito CSS entre o estilo global do app e o tema do storefront. Verificar se algum estilo base do admin está vazando para o contexto da LP.

---

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-landing-page-generate/index.ts` | Melhorar CSS responsivo, reduzir emojis, refinar logo, melhorar prompts de imagem |
| `src/pages/storefront/StorefrontAILandingPage.tsx` | Fix timing do ThemeInjector + investigar bugs de header/footer |

---

## Ordem de Implementação

1. Atualizar system prompt (responsividade + emojis + logo) no edge function
2. Melhorar prompts de geração de imagem (hero + lifestyle) com contexto de nicho
3. Fix do renderer StorefrontAILandingPage (header/footer)
4. Deploy edge function
5. Gerar página de teste para validar

