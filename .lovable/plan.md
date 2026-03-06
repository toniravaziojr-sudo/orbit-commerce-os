

# Plano Final de Otimizacao de Performance do Storefront v3.0

## Diagnostico Confirmado

Cascata atual para dominio customizado (ex: respeiteohomem.com.br):

```text
index.html ("Comando Central" + favicon plataforma = flickering)
  → JS Bundle (~200KB gz)
    → resolve-domain (Edge Function #1, ~300-500ms)
      → storefront-bootstrap (Edge Function #2, ~400-800ms)
        → Footer: 5 queries extras (tenant x4, settings, categories, menus footer_1+footer_2, pages)
        → Header: 2 queries extras (pages, globalLayout)
        → Paginas internas: globalLayout sem bootstrap
          → RENDER FINAL (~5s)
```

Dados faltantes no bootstrap confirmados:
- `store_pages` (id, slug, type) — Header e Footer buscam separadamente
- `footer_2` menu + items — Bootstrap so traz footer/footer_1
- Cada query do Footer faz lookup de tenant por slug (4 lookups redundantes)

---

## 7 Fases de Execucao

### FASE 1 — Expandir bootstrap + eliminar queries duplicadas (Footer/Header)
**Economia: ~1.5-2.5s | Risco: Medio**

**1a. Edge Function `storefront-bootstrap`:**
- Adicionar Q9: `store_pages` (id, slug, type, is_published=true)
- Adicionar Q10: `footer_2` menu + items (hoje so busca footer/footer_1)
- Retornar: `pages: [...]`, `footer_2_menu: { menu, items }`

**1b. `StorefrontFooterContent.tsx`:**
- Adicionar props opcionais: `bootstrapStoreSettings`, `bootstrapCategories`, `bootstrapFooterMenus`, `bootstrapPages`
- Quando props presentes: usar direto, pular queries
- Manter queries como fallback apenas para `isEditing=true`

**1c. `StorefrontFooter.tsx`:**
- Consumir dados de `usePublicStorefront` e passar via props

**1d. `StorefrontHeader.tsx` / `HeaderBlock`:**
- Passar `bootstrapPages` e `bootstrapGlobalLayout` via props
- Manter fetch proprio apenas quando `isEditing=true`

**Criterio de aceite:** Footer e Header geram ZERO queries de rede quando bootstrap disponivel.

---

### FASE 2 — Propagacao completa do bootstrap para TODAS as paginas
**Economia: ~200-600ms | Risco: Medio**

Paginas que NAO passam `bootstrapGlobalLayout` ao `PublicTemplateRenderer`:
- `StorefrontBlog.tsx`, `StorefrontBlogPost.tsx`, `StorefrontTracking.tsx`
- `StorefrontThankYou.tsx`, `StorefrontLandingPage.tsx`, `StorefrontPage.tsx`
- `StorefrontCheckout.tsx` (usa `usePublicGlobalLayout` sem bootstrap)

**Acao:** Em cada pagina, extrair `globalLayout` e `pageOverrides` do `usePublicStorefront` e passar como props.

**Criterio de aceite:** `usePublicGlobalLayout` nunca dispara query de rede quando bootstrap disponivel.

---

### FASE 3 — Unificar resolve-domain + storefront-bootstrap
**Economia: ~300-500ms | Risco: Medio-Alto**

**Abordagem (sem duplicar logica):** Extrair a logica de resolucao de dominio para uma funcao utilitaria compartilhada (`_shared/resolveTenant.ts`) e reutiliza-la em ambas edge functions. `storefront-bootstrap` aceita `hostname` como parametro alternativo e chama essa funcao internamente.

**Arquivos:**
- `supabase/functions/_shared/resolveTenant.ts` — Funcao pura de resolucao (extraida de resolve-domain)
- `supabase/functions/storefront-bootstrap/index.ts` — Aceitar `hostname`, chamar `resolveTenant()`
- `supabase/functions/resolve-domain/index.ts` — Importar de `_shared/resolveTenant.ts`
- `src/components/storefront/TenantStorefrontLayout.tsx` — Chamar bootstrap com hostname direto, eliminar `useTenantFromHostname`
- `src/hooks/useStorefrontBootstrap.ts` — Adicionar variante por hostname

**Criterio de aceite:** Para dominio customizado, apenas 1 Edge Function call antes do render.

**Rollout:** Validar em dominio custom + subdominio + preview antes de remover fallback.

---

### FASE 4 — Reducao de payload (remover produtos do bootstrap)
**Economia: ~100-300ms payload | Risco: Baixo**

Remover `include_products: true` da chamada em `usePublicStorefront`. Blocos de produto fazem fetch proprio.

**Criterio de aceite:** Payload do bootstrap reduz ~30-50%.

---

### FASE 4B — Otimizacao de assets, imagens e LCP
**Economia: variavel (LCP mobile) | Risco: Baixo**

**Acao:**
- Garantir hero banner passa por `wsrv.nl` com WebP/resize correto (1920px desktop, 768px mobile)
- Garantir logo do header passa por transform (200px)
- Revisar `LcpPreloader` para confirmar que URLs preloaded sao as transformadas (nao raw)
- Adicionar `Cache-Control: public, max-age=31536000, immutable` nos response headers de assets estaticos (JS/CSS) via config
- Validar que imagens abaixo da dobra usam `loading="lazy"` e acima usam `fetchPriority="high"`

**Criterio de aceite:** Hero banner LCP usa URL transformada via wsrv.nl. Assets estaticos tem cache de longa duracao.

---

### FASE 5 — Limpar index.html (eliminar branding incorreto)
**Risco: Baixo | Impacto: Percepcao visual**

Remover do `index.html`:
- Title "Comando Central - Plataforma E-commerce"
- Meta description/author da plataforma
- Links de favicon (favicon.ico, favicon-16x16, favicon-32x32, apple-touch-icon, manifest)
- Tags OG e Twitter da plataforma
- Manter apenas: `<meta charset>`, `<meta viewport>`, `<meta name="theme-color">`, `<script>` do bundle
- Title vazio ou generico ("Carregando...")

**Criterio de aceite:** A aba do navegador NAO exibe "Comando Central" nem favicon da plataforma durante carregamento de loja de tenant. Rotas admin continuam injetando seus proprios metadados via React Helmet.

---

### FASE 6 — Auditoria de navegacao interna + bundle/code splitting
**Risco: Baixo | Economia: variavel**

**6a. Mapear queries por transicao de rota:**
- Home → Produto: quais queries re-executam?
- Produto → Categoria: idem
- Qualquer rota → Checkout: idem

**6b. Eliminar refetches redundantes:**
- Confirmar Header/Footer estao FORA do `<Outlet>` (no Layout, nao desmontam)
- Confirmar `staleTime` adequado em dados estruturais
- Confirmar providers globais nao causam rerender completo

**6c. Auditoria de bundle/code splitting:**
- Mapear tamanho dos chunks em home, produto, categoria, checkout
- Validar que rotas storefront estao separadas do admin (lazy loading)
- Verificar se ha importacoes do admin vazando para storefront
- Confirmar `React.lazy()` nas rotas de paginas do storefront

**6d. Prefetch:**
- Considerar prefetch de dados ao hover em links criticos (produto, categoria)

**Criterio de aceite:**
- Home → Produto: max 1-2 queries novas (produto + breadcrumb)
- Zero re-fetch de tenant/settings/menus entre paginas
- Chunks do storefront isolados do admin

---

## Metricas de Validacao (medir antes/depois de cada fase)

| Metrica | Como medir | Meta |
|---------|-----------|------|
| Edge/API calls na home (cold) | Network tab | 1 (apos Fase 3), 2 antes |
| Queries redundantes estruturais | Network tab | 0 |
| Lookups duplicados de tenant | Network tab | 0 |
| Queries Header/Footer fora bootstrap | Network tab | 0 |
| Tempo bootstrap (server) | `_meta.query_duration_ms` | < 500ms |
| Payload bootstrap (size) | Network tab | < 50KB gz |
| LCP mobile | PageSpeed/Lighthouse | < 3s |
| Tempo home → produto | Manual | < 1s |
| Branding incorreto na aba | Visual | Ausente |

---

## Criterios de Aceite Globais

1. Home nao dispara queries duplicadas de tenant
2. Header/Footer nao consultam dados que ja vieram no bootstrap
3. Primeira abertura: max 1 Edge Function call (apos Fase 3)
4. Navegacao interna: zero re-fetch de dados estruturais
5. Aba do navegador nao exibe "Comando Central" nem favicon da plataforma durante carregamento de tenant
6. Hero banner LCP usa imagem transformada (WebP, tamanho correto)
7. Nenhuma regressao no builder (modo edicao usa queries proprias)
8. Logica de resolucao de dominio compartilhada (sem duplicacao entre edge functions)
9. Chunks storefront isolados do admin

---

## Ordem de Execucao

1. **Fase 1** → maior impacto absoluto (elimina ~10 queries redundantes)
2. **Fase 2** → complementa Fase 1 (propagacao completa)
3. **Fase 3** → unifica chamadas (requer Fase 1+2 estaveis)
4. **Fase 4** → reduz payload
5. **Fase 4B** → otimiza assets/LCP
6. **Fase 5** → corrige branding visual
7. **Fase 6** → auditoria de navegacao + bundle

**Rollout:** Medir antes/depois a cada fase. Validar em dominio custom + subdominio + preview. Manter fallbacks durante transicao.

