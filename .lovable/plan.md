
# Plano de Correção — 4 Problemas nas AI Landing Pages

## Problema 1: Header "Categoria em Destaque" bugada

**Análise:** No screenshot, o badge de "Featured Promos" (lado esquerdo da barra de navegação secundária) aparece como um retângulo vermelho cortado/sem texto legível. O componente `StorefrontHeaderContent.tsx` renderiza o badge usando `featuredPromosBgColor` e `featuredPromosTextColor`, mas dentro do contexto de AI LP (que está FORA do `TenantStorefrontLayout`), as container queries CSS (`sf-header-desktop` / `sf-header-mobile`) podem não estar inicializadas corretamente.

**Correção:**
- Investigar se o CSS de container queries do header está disponível no contexto da AI LP (o `StorefrontThemeInjector` injeta essas regras? Ou dependem do layout global?)
- Garantir que a barra secundária com featured promos tenha `overflow: visible` e dimensões adequadas
- Se necessário, injetar o CSS de container queries no wrapper da AI LP

---

## Problema 2: Footer não responsivo + Toggle não funciona

**Análise (responsividade):** O `StorefrontFooter` usa container queries (`.sf-footer-mobile` / `.sf-footer-desktop` com breakpoint 768px). Dentro da AI LP, o footer é renderizado fora do iframe, como React component. Se o container pai não tem `container-type: inline-size`, as container queries não funcionam e o footer fica sempre no layout mobile (empilhado verticalmente).

**Correção (responsividade):**
- No `StorefrontAILandingPage.tsx`, envolver o `<StorefrontFooter />` (e `<StorefrontHeader />`) em um container com `container-type: inline-size` para que as container queries funcionem corretamente

**Análise (toggle):** O DB confirma `show_footer: false`, mas o usuário reporta que o footer continua aparecendo. A mutação de save funciona (linha 244 do editor), mas o problema pode ser:
1. O `staleTime: 5 minutos` na query pública causa cache
2. O usuário precisa hard-refresh a página publicada
3. Possível issue: o componente `StorefrontAILandingPage` lê da query que pode estar cacheada no browser

**Correção (toggle):**
- Reduzir `staleTime` da query `ai-landing-page-public` para 30 segundos (ou 0) para garantir freshness
- Verificar se o `select` da query realmente inclui `show_header, show_footer` (já confirmado que sim)
- Adicionar `refetchOnWindowFocus: true` na query pública para re-validar ao voltar para a aba

---

## Problema 3: Hero Banner — uso "burro" de imagens

**Análise:** O system prompt do `ai-landing-page-generate` SEMPRE instrui hero com `min-height: 90vh` + imagem de fundo com gradient overlay. Isso resulta em um padrão repetitivo e nem sempre adequado.

**Correção no prompt (edge function):**
- Remover a instrução fixa de `min-height: 90vh` no Hero (esse valor é sanitizado pelo client de qualquer forma)
- Variar os templates de Hero nos fallback prompts. Dos 5 templates existentes (`dark-authority`, `editorial-clean`, `tech-futurista`, `organico-sensorial`, `urgencia-conversao`):
  - Apenas `dark-authority` e `urgencia-conversao` usam hero fullscreen com background-image overlay
  - `editorial-clean` → layout split (texto esquerda, produto direita)
  - `tech-futurista` → hero com produto centralizado em container
  - `organico-sensorial` → hero clean com produto em foto lifestyle
- No system prompt principal, trocar de "Imagem do produto como background com gradient overlay" para oferecer 3 opções de layout de hero, deixando a IA escolher com base no nicho:
  1. **Split layout**: Texto à esquerda, produto à direita (melhor para produtos com embalagem visível)
  2. **Background composicional**: Imagem lifestyle/criativa como fundo com overlay (apenas para nichos dark/premium)
  3. **Hero clean**: Fundo sólido/gradiente com produto flutuante centralizado e copy ao lado

---

## Problema 4: Logo não se adapta ao design da página

**Análise:** No screenshot do comparativo (imagem 183), a logo aparece minúscula dentro de um container branco, quase ilegível. O prompt instrui `max-width: 160px` fixo e container branco obrigatório. Para logos com fundo transparente sobre temas dark, isso funciona, mas o tamanho é muito pequeno para tabelas comparativas.

**Correção no prompt:**
- Aumentar `max-width` da logo para `200px` no prompt
- Instruir que em tabelas comparativas, a logo deve ocupar pelo menos `180px` de largura
- Adicionar regra: "Se o fundo da LP é escuro e a logo tem fundo transparente com texto claro, NÃO precisa de container branco — use a logo diretamente"
- Adicionar regra: "Se a logo tem texto escuro em fundo transparente E a LP é dark, use o container branco mas com `min-width: 180px` para garantir legibilidade"

---

## Resumo de Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/storefront/StorefrontAILandingPage.tsx` | Container com `container-type: inline-size` para header/footer; reduzir `staleTime` |
| `supabase/functions/ai-landing-page-generate/index.ts` | Prompt: variar hero layouts, melhorar regras de logo, remover min-height 90vh fixo |
| `supabase/functions/_shared/marketing/fallback-prompts.ts` | Atualizar templates para diversificar heroes |
| `docs/regras/paginas-institucionais.md` | Documentar correção do scroll + novos padrões de hero |

---

## Documentação Necessária

Atualizar `docs/regras/paginas-institucionais.md`:
- Registrar fix v3.8.2 do scroll (sanitizeAILandingPageHtml)
- Registrar container queries fix para header/footer em AI LPs
- Registrar diversificação de hero layouts (v3.9.0)
- Registrar novas regras de logo adaptativa
