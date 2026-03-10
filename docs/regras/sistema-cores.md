# Sistema de Cores — Regras e Especificações

> **Status:** ✅ Produção (v2.0 — Fases 1, 2 e 3 concluídas e validadas)

## Fonte Única de Verdade

| Item | Localização |
|------|-------------|
| Tipagem canônica | `ThemeColors` em `src/hooks/useThemeSettings.ts` |
| Defaults | `DEFAULT_THEME_COLORS` em `src/hooks/useThemeSettings.ts` |
| Pipeline CSS | `src/lib/storefront-theme-utils.ts` |
| Edge counterpart | `supabase/functions/_shared/theme-tokens.ts` |

> **[REMOVIDO]** `src/contexts/ThemeContext.tsx` — tipo `ThemeColors` legado, `useStorefrontTheme()`, `getThemeCssVariables()`, `ThemeProvider`. Deletado na Fase 1 (zero consumidores).

---

## Propriedades do Tema (20 tokens)

| Grupo | Propriedade | CSS Variable |
|-------|-------------|--------------|
| Botão Primário | `buttonPrimaryBg` | `--theme-button-primary-bg` |
| | `buttonPrimaryText` | `--theme-button-primary-text` |
| | `buttonPrimaryHover` | `--theme-button-primary-hover` |
| Botão Secundário | `buttonSecondaryBg` | `--theme-button-secondary-bg` |
| | `buttonSecondaryText` | `--theme-button-secondary-text` |
| | `buttonSecondaryHover` | `--theme-button-secondary-hover` |
| WhatsApp | `whatsappColor` | `--theme-whatsapp-color` |
| | `whatsappHover` | `--theme-whatsapp-hover` |
| Textos | `textPrimary` | `--theme-text-primary` |
| | `textSecondary` | `--theme-text-secondary` |
| Preço | `priceColor` | `--theme-price-color` |
| Accent | `accentColor` | `--theme-accent-color` |
| Tags | `successBg/Text` | `--theme-success-bg/text` |
| | `warningBg/Text` | `--theme-warning-bg/text` |
| | `dangerBg/Text` | `--theme-danger-bg/text` |
| | `highlightBg/Text` | `--theme-highlight-bg/text` |

---

## Pipeline de Injeção (3 camadas)

```
┌─────────────────────────────────────────────────────────┐
│  1. GLOBAL — Tema da Loja                               │
│  Gerado por: generateColorCssVars() + generateButton*   │
│  Injetado via:                                          │
│    Builder → useBuilderThemeInjector.ts                  │
│    SPA     → StorefrontThemeInjector.tsx                 │
│    Edge    → storefront-html (inline <style>)           │
├─────────────────────────────────────────────────────────┤
│  2. ZONA — Header / Footer / NoticeBar                  │
│  Configs próprias (footerBgColor, headerBg, etc.)       │
│  Aplicadas via inline style nos componentes de zona     │
│  Override autorizado — não é sistema paralelo           │
├─────────────────────────────────────────────────────────┤
│  3. CONTEXTO/PÁGINA — Carrinho / Checkout               │
│  pageSettings.cart.buttonPrimaryBg, etc.                │
│  Injetado via PageColorsInjector.tsx                    │
│  Sobrescreve vars globais quando preenchido             │
└─────────────────────────────────────────────────────────┘
```

---

## Hierarquia de Precedência (Fase 2 — sem !important)

| Nível | Escopo | Mecanismo | Especificidade |
|-------|--------|-----------|---------------|
| 1 (base) | Tema Global | CSS vars + regras em `.storefront-container` | 0,2,0+ |
| 2 | Zona Estrutural | Inline styles em Header/Footer/NoticeBar | — (inline) |
| 3 | Página/Contexto | CSS vars redefinidas em `.sf-page-cart` / `.sf-page-checkout` | 0,3,0+ |
| 4 | Estado | `:hover`, `:active`, `:disabled` nos seletores | +pseudo |

### Classes de Página

O container principal recebe automaticamente a classe `sf-page-{type}`:
- `.sf-page-cart` — via `PublicTemplateRenderer` (pageType="cart")
- `.sf-page-checkout` — via `StorefrontCheckout.tsx` (hardcoded)
- `.sf-page-home`, `.sf-page-category`, `.sf-page-product`, etc.

Isso permite que overrides de página vençam regras globais **por especificidade natural**, sem `!important`.

---

## Padrões de Consumo (Contrato)

### ✅ Permitido
- Classes semânticas: `.sf-btn-primary`, `.sf-btn-secondary`, `.sf-btn-outline-primary`, `.sf-btn-outline-secondary`
- Classes de cor: `.sf-price-color`, `.sf-accent-icon`, `.sf-accent-bg`, `.sf-accent-text`, `.sf-accent-border`
- Classes de tag: `.sf-tag-success`, `.sf-tag-warning`, `.sf-tag-danger`, `.sf-tag-highlight`
- Classes de flag: `.sf-checkout-flag`, `.sf-flag-text`
- CSS vars com fallback: `style={{ color: 'var(--theme-accent-color, #22c55e)' }}`
- Inline styles para overrides de zona: `style={{ backgroundColor: footerBgColor }}`

### ❌ Proibido
- Tailwind arbitrary hex: `bg-[#1a1a1a]`, `text-[#fff]`
- Hex hardcoded sem var(): `style={{ color: '#22c55e' }}`
- Criar CSS vars fora do pipeline central
- Usar `!important` como solução estrutural (Fase 2)
- Importar de `ThemeContext.tsx` (deletado)

---

## Overrides Autorizados por Zona

| Zona | Fonte da Config | Escopo |
|------|----------------|--------|
| Header | `headerConfig` (published_content) | Inline no componente |
| NoticeBar | `noticeBarConfig` | Inline no componente |
| Footer | `footerConfig` | Inline no componente |
| Carrinho | `pageSettings.cart` | `PageColorsInjector` |
| Checkout | `pageSettings.checkout` | `PageColorsInjector` |

Zonas que **não** possuem override: páginas de produto, categoria, blog, institucionais — usam tema global.

---

## Pendências

- [x] ~~Fase 1: Remover tipo legado ThemeContext.tsx~~
- [x] ~~Fase 2: Remover dependência de `!important` em `storefront-theme-utils.ts`, `usePageColors.ts` e `theme-tokens.ts`~~
- [x] ~~Fase 2: Implementar hierarquia CSS por especificidade controlada via `.sf-page-*`~~
- [x] ~~Fase 3: Reorganizar UI admin em grupos visuais (Accordion: Cores Globais / Botões e Estados / Tags e Badges)~~
