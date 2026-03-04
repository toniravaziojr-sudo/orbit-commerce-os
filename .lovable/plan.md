

# V4.2 — Correção Arquitetural: Plano de Implementação

## Visão Geral

Implementação aprovada da V4.2 que muda o contrato de output da IA de "documento HTML completo" para "apenas seções de conteúdo", com o backend assumindo controle total do shell do documento.

---

## Fase 1: Hard Checks de Layout + Contrato Body-Only + Parser Enforcement

### 1.1 — Hard checks de layout (`engine-plan.ts`, após linha 438)

Adicionar 4 novos checks **antes** do cálculo de status final. Estes checks rodam sobre o HTML bruto da IA, antes do wrapping:

- `has_no_footer` — detecta `<footer[\s>]` (tag real, não class names)
- `has_no_document_shell` — detecta `<!DOCTYPE` ou `<html[\s>]` ou `<head[\s>]`
- `has_no_large_vh` — detecta `height:\s*(8\d|9\d|100)vh`
- `has_no_position_fixed` — detecta `position:\s*fixed`

Todos geram **warning** (nunca entram em `criticalFails`), com `needsReview: true`.

### 1.2 — Mudar formato de saída no prompt (`index.ts`, linhas 341-369)

Trocar o bloco de output de:
```
2. Bloco HTML completo:
<!DOCTYPE html><html>...
```
Para:
```
2. Bloco HTML — APENAS conteúdo das seções:
   - Comece na primeira <section> (Hero)
   - Termine no último CTA
   - NÃO inclua <!DOCTYPE>, <html>, <head>, <body>
   - Inclua um único bloco <style> com CSS específicos da LP
   - O sistema montará o documento completo
```

### 1.3 — `wrapInDocumentShell()` no backend (`index.ts`, ~linha 884)

Nova função que monta o documento completo ao redor do conteúdo da IA. O CSS utilities (linhas 432-466) **sai do prompt** e vai para esta função. O prompt mantém apenas a instrução de incluir `<style>` com CSS específico.

A função recebe o HTML das seções e produz o documento completo com: charset, viewport, fonts, CSS utilities, safety CSS mínimo, favicon, pixels, auto-resize script.

### 1.4 — Enforcement no parser (`index.ts`, linhas 498-533)

Após extrair o HTML no `parseStructuredResponse`, adicionar detecção de violação:
1. Detectar se contém `<!DOCTYPE` ou `<html[\s>]` ou `<head[\s>]`
2. Se sim → tentar extrair conteúdo de `<body>...</body>`
3. Se `<body>` não existir → remover tags shell conhecidas e usar miolo restante
4. Registrar `outputContractViolation` em parseError
5. **Refletir no status consolidado**: após `runHardChecks`, se houve `outputContractViolation`, garantir `hardCheckStatus >= 'warning'` e `needsReview: true`

### 1.5 — Metadata: `engineVersion: "v4.2"` (linhas 914, 939)

---

## Fase 2: Iframe com Skeleton + Pipeline Compartilhada

### 2.1 — Skeleton + opacity no iframe (`StorefrontAILandingPage.tsx`)

Substituir `height: 2000px` por:
- Container com `min-height: 400px` e skeleton visual (pulse)
- Iframe com `opacity: 0` + `transition: opacity 0.3s`
- Ao receber primeiro `postMessage` → `opacity: 1` com altura correta
- Timeout de 5s como fallback seguro

### 2.2 — Pipeline compartilhada (`src/lib/aiLandingPageShell.ts` — NOVO)

Novo arquivo que exporta:
- `buildDocumentShell(sectionHtml, options)` — monta documento
- `buildSafetyCss()` — CSS de segurança unificado
- `buildAutoResizeScript()` — script de auto-resize

Tanto `StorefrontAILandingPage.tsx` quanto `LandingPagePreviewDialog.tsx` importam e usam a mesma pipeline.

### 2.3 — Simplificar sanitizer (`sanitizeAILandingPageHtml.ts`)

Com contrato body-only:
- **Remover**: regex de `<footer>` (linhas 50-53)
- **Remover**: injeção de `overflow-x: hidden` no body (linhas 43-47)
- **Manter**: correção de `vh` heights e `animation-fill-mode` como defesa secundária

---

## Fase 3: Refinar Mobile + Animações

### 3.1 — Mobile grid seletivo (CSS utilities)
- Grids 3+ colunas → forçar 1fr
- Grids 2 colunas → manter 2col
- Remover catch-all `[style*="display: flex"][style*="align-items"] { flex-direction: column !important; }`

### 3.2 — Animation-delay: cap 0.5s → 1.5s (sanitizer linha 39)

### 3.3 — animation-fill-mode: manter `forwards` para animações sem `opacity: 0`

---

## Arquivos Afetados

| Arquivo | Fase |
|---------|------|
| `supabase/functions/_shared/marketing/engine-plan.ts` | 1 |
| `supabase/functions/ai-landing-page-generate/index.ts` | 1 |
| `src/lib/aiLandingPageShell.ts` (NOVO) | 2 |
| `src/pages/storefront/StorefrontAILandingPage.tsx` | 2 |
| `src/components/landing-pages/LandingPagePreviewDialog.tsx` | 2 |
| `src/lib/sanitizeAILandingPageHtml.ts` | 2-3 |
| `docs/regras/landing-pages.md` | 3 |

## Ordem de Execução

1. Hard checks de layout em `engine-plan.ts`
2. Contrato body-only no prompt + `wrapInDocumentShell` no backend
3. Parser com enforcement de violação de contrato
4. Iframe com skeleton + opacity transition
5. Pipeline compartilhada (`aiLandingPageShell.ts`)
6. Simplificar sanitizer
7. Refinar mobile + animações
8. Deploy edge function + atualizar documentação

