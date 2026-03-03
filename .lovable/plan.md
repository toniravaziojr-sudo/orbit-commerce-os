

## Plano Consolidado: Upgrade Completo do Gerador de Landing Pages com IA

**Status: ✅ IMPLEMENTADO**

---

### Frente 1: Reescrever o System Prompt com Design System + Contexto do Negócio ✅

**Arquivo:** `supabase/functions/ai-landing-page-generate/index.ts` (v2.0.0)

- Modelo trocado para `google/gemini-2.5-pro`
- Busca `product_reviews` e `ads_creative_assets` para contexto do negócio
- Prompt reescrito com Design System completo (tipografia, cores, layout, animações, responsividade, estrutura obrigatória)

### Frente 2: Toggle Header/Footer nas Landing Pages IA ✅

- Migration: `show_header` e `show_footer` em `ai_landing_pages`
- Editor: switches na aba Config
- StorefrontAILandingPage: renderiza header/footer condicionalmente com CartProvider/DiscountProvider

### Frente 3: Builder Header/Footer Toggles

Já existente via `usePageOverrides` + `HeaderFooterPropsEditor`. Verificado.
