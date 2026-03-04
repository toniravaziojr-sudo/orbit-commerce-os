

# Diagnóstico de Regressões V4.2 + Plano de Correção

## Problemas Identificados (confirmados por análise do código e dados)

### 1. Duplo wrapping do documento (BUG CRÍTICO)
O backend salva o HTML **já envolto em `<!DOCTYPE html>`** via `wrapInDocumentShell()` (index.ts L1021-1024). Depois, no render, `StorefrontAILandingPage.tsx` (L245-248) e `LandingPagePreviewDialog.tsx` chamam `buildDocumentShell()` novamente. Como o HTML salvo começa com `<!DOCTYPE`, o shell do `aiLandingPageShell.ts` detecta `isFullDocument` e injeta safety CSS + auto-resize **duplicados**. Resultado: scripts duplicados, potencial conflito CSS.

### 2. Header/footer da loja aparecendo (DADOS + CÓDIGO)
O registro do t10 tem `show_header: true` e `show_footer: true`. O componente (L266-267) respeita esses flags com `?? false` como fallback. Mas como a LP foi criada/gerada com esses valores `true`, a plataforma renderiza header + footer da loja **em volta** da LP. Combinado com footer-like content gerado pela IA, causa **footer duplicado** (visível nos prints).

### 3. Footer-like sections ainda geradas pela IA
O prompt proíbe `<footer>` como tag e "seção de copyright", mas a IA ainda gera seções com SAC, redes sociais, CNPJ, endereço, "Menu Footer" — conteúdo semântico de rodapé sem usar a tag `<footer>`. A proibição atual é insuficiente.

### 4. CSS grid catch-all destrói 2 colunas no mobile
Linha 569: `[style*="display: grid"][style*="grid-template-columns"] { grid-template-columns: 1fr !important; }` — esse catch-all **anula** as regras seletivas das linhas 562-568 que preservam 2 colunas. Todo grid vira 1 coluna no mobile. Era para ter sido removido na Fase 3.

### 5. Imagens quebradas (imgur.com)
A IA está usando URLs externas (imgur.com) que não são do catálogo/Drive. O prompt proíbe placeholder.com e unsplash.com, mas **não** proíbe imgur e outros hotlinks genéricos.

### 6. `.animate-section` com `both` causa invisibilidade
Linha 549: `.animate-section { animation: fadeInUp 0.8s ease-out both; }` — o CSS utilities do backend usa `animation-fill-mode: both`, que o safety CSS depois tenta corrigir para `none`. Conflito interno.

---

## Plano de Correção (cirúrgico — preserva arquitetura V4.2)

### Correção 1: Eliminar duplo wrapping
**Arquivo:** `supabase/functions/ai-landing-page-generate/index.ts` (L1019-1024)

O backend NÃO deve envelopar com `wrapInDocumentShell` no momento do save. Deve salvar **apenas o HTML body-only** (seções + style). O wrapping acontece **apenas no render** (client-side via `buildDocumentShell`).

Remover linhas 1019-1024 (chamada a `wrapInDocumentShell`). O `generatedHtml` salvo fica body-only.

### Correção 2: Default show_header/show_footer = false
**Arquivo:** `supabase/functions/ai-landing-page-generate/index.ts`

Na criação de novas LPs, o default já deveria ser `false`. Verificar se o front-end de criação está definindo `true` indevidamente. Independentemente, o componente de render já trata `?? false`.

**Ação adicional:** Atualizar o t10 no banco para `show_header: false, show_footer: false` para validação imediata.

### Correção 3: Proibição semântica de footer-like content
**Arquivo:** `supabase/functions/ai-landing-page-generate/index.ts` (bloco HEADER/FOOTER, L386-392)

Expandir a proibição para incluir conteúdo semântico de rodapé:
- NÃO gerar seções com dados de SAC/contato institucional
- NÃO gerar blocos de redes sociais
- NÃO gerar "Menu Footer" ou links institucionais
- NÃO gerar endereço/CNPJ como seção de fechamento
- A última seção DEVE ser um CTA de conversão, não informação institucional

### Correção 4: Remover CSS grid catch-all
**Arquivo:** `supabase/functions/ai-landing-page-generate/index.ts` (L569)

Remover a linha: `[style*="display: grid"][style*="grid-template-columns"] { grid-template-columns: 1fr !important; }`

As regras seletivas (L562-568) já cobrem grids de 3+ colunas. A catch-all destrói grids de 2 colunas legítimos.

### Correção 5: Proibir hotlinks externos no prompt + hard check
**Arquivo:** `supabase/functions/ai-landing-page-generate/index.ts` (bloco ANTI-PADRÕES, L307-327)

Adicionar proibição: `- NUNCA use imgur.com, postimg.cc, imgbb.com ou qualquer host externo de imagens`

**Arquivo:** `supabase/functions/_shared/marketing/engine-plan.ts` (hard checks)

Adicionar check `has_no_external_images`: detectar `imgur.com|postimg.cc|imgbb.com|cloudinary.com` no HTML. Warning + needsReview.

### Correção 6: Corrigir `.animate-section` fill-mode
**Arquivo:** `supabase/functions/ai-landing-page-generate/index.ts` (L549)

Trocar `.animate-section { animation: fadeInUp 0.8s ease-out both; }` para `.animate-section { animation: fadeInUp 0.8s ease-out forwards; }` — ou melhor, remover `both` inteiramente já que o safety CSS o anula.

### Correção 7: Atualizar `buildDocumentShell` para incluir CSS utilities
**Arquivo:** `src/lib/aiLandingPageShell.ts`

O shell client-side precisa injetar os CSS utilities (keyframes, container, grid rules mobile) quando o input é body-only. Atualmente só injeta safety CSS. Deve incluir as mesmas utilities do backend para que o render funcione corretamente com HTML body-only.

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-landing-page-generate/index.ts` | Remover wrapping no save; expandir proibição de footer semântico; proibir imgur; corrigir animate-section; remover grid catch-all |
| `supabase/functions/_shared/marketing/engine-plan.ts` | Novo hard check `has_no_external_images` |
| `src/lib/aiLandingPageShell.ts` | Adicionar CSS utilities ao shell body-only |

## O que NÃO muda
- Contrato body-only (mantido)
- Parser enforcement (mantido)
- Hard checks existentes (mantidos)
- Pipeline compartilhada (mantida)
- Skeleton + opacity transition (mantido)

## Ordem de execução
1. Remover duplo wrapping no backend (save body-only)
2. Adicionar CSS utilities ao `buildDocumentShell` client-side
3. Expandir proibição de footer semântico no prompt
4. Remover grid catch-all + corrigir animate-section
5. Adicionar proibição de hotlinks + hard check
6. Deploy edge function

