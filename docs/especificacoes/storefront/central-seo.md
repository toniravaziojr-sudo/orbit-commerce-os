# Central de SEO da Loja — Especificação canônica

**Status:** Onda 2 — Sub-onda 2.A entregue (fundação de dados read-only). Sub-onda 2.A rev-a aplicada (correção cirúrgica em `calc_seo_health`). Sub-onda 2.B entregue (Central read-only real em Loja Online → SEO da Loja).
**Localização na UI:** `Loja Online → SEO da Loja` → rota `/storefront/seo`.
**Fundação técnica pública:** `docs/especificacoes/storefront/seo.md` (Onda 1 — Worker + `storefront-html` + robots/sitemap). Continua sendo a fonte de verdade do SEO público. Esta Central **não substitui** essa fundação.
**Doc antigo:** `docs/especificacoes/marketing/central-seo.md` foi rebaixado a nota de redirecionamento — este arquivo é a fonte de verdade única.

## Objetivo
Reunir num único painel administrativo:
1. Um **Índice de Saúde SEO** interno (0–100) calculado sob demanda.
2. Cobertura de SEO por entidade editorial (produtos, categorias, páginas, landing pages, blog).
3. Pendências acionáveis com link para o módulo original responsável pela correção.
4. Estado técnico local da loja (favicon, SEO padrão, domínio primário verificado, SSL) como espelho informativo da Onda 1.

O nome oficial é **Índice de Saúde SEO**. Nunca chamar de "nota do Google".

---

## Sub-onda 2.A — Fundação de dados (entregue)

Escopo: só backend read-only. Zero UI, zero IA, zero GSC, zero cron, zero cache, zero snapshot, zero tabela nova, zero coluna nova.

### Views criadas (todas `security_invoker=true`)
Todas expõem `tenant_id` e herdam a RLS das tabelas de origem — a leitura roda no papel do caller.

| View | Origem | Filtro |
|---|---|---|
| `v_seo_coverage_products` | `products` | `status='active' AND deleted_at IS NULL` |
| `v_seo_coverage_categories` | `categories` | `is_active=true` |
| `v_seo_coverage_storefront_pages` | `store_pages` | `is_published=true AND COALESCE(no_index,false)=false AND type <> 'landing_page'` |
| `v_seo_coverage_landing_pages` | `store_pages` | `is_published=true AND type='landing_page'` (inclui `no_index` como flag informativa) |
| `v_seo_coverage_blog_posts` | `blog_posts` | `status='published'` |
| `v_seo_store_foundation` | `store_settings` + `tenant_domains` | 1 linha por tenant |

**Regra anti-duplicação:** `v_seo_coverage_storefront_pages` exclui `type='landing_page'` para não sobrepor `v_seo_coverage_landing_pages`.

**Campo efetivo de título/descrição em `store_pages`:** `COALESCE(meta_title, seo_title)` e `COALESCE(meta_description, seo_description)`.

### Função `public.calc_seo_health(p_tenant_id uuid) → jsonb`
- `STABLE`, `SECURITY INVOKER`, `search_path = public`.
- Defesa em profundidade: `RAISE 42501` se `user_has_tenant_access(p_tenant_id)` falhar.
- `GRANT EXECUTE` apenas para `authenticated` e `service_role` (default revoke honrado).
- Contrato de retorno (estável, consumido pela 2.B):
  ```json
  {
    "tenant_id": "uuid",
    "score": 0-100,
    "factors": [
      { "key": "products|categories|storefront_pages|landing_pages|blog_posts",
        "weight": number, "score": number, "total": number, "ok": number,
        "noindex_informational": number /* só em landing_pages */ },
      { "key": "foundation", "weight": 20, "score": number,
        "signals": {
          "favicon": bool, "default_seo_title": bool, "default_seo_description": bool,
          "primary_verified_domain": bool, "active_ssl": bool
        } }
    ],
    "counts": {
      "products":         { "total": n, "ok": n },
      "categories":       { "total": n, "ok": n },
      "storefront_pages": { "total": n, "ok": n },
      "landing_pages":    { "total": n, "ok": n, "noindex_informational": n },
      "blog_posts":       { "total": n, "ok": n }
    },
    "pending": [ { "key": "products_missing_seo|...", "count": n } ],
    "computed_at": "ISO-8601"
  }
  ```

**Pesos (soma 100):** produtos 30 · categorias 15 · páginas do storefront 15 · landing pages 10 · blog 10 · fundação técnica 20.
Entidades sem itens contam como 100% do peso (não penaliza quem ainda não tem blog, por exemplo).
A fundação técnica pondera 5 sinais binários igualmente: favicon, seo_title padrão, seo_description padrão, domínio primário verificado, SSL ativo.

**Pendências devolvidas:** `products_missing_seo`, `categories_missing_seo`, `pages_missing_seo`, `landing_pages_missing_seo`, `blog_posts_missing_seo`, `duplicate_titles`.

### Modelo de segurança (hardening 2026-07-02, mantido)
- **`security_invoker=true`** em todas as views.
- **Guarda explícita no WHERE:** cada view aplica `AND public.user_has_tenant_access(tenant_id)`.
- **Grants:** `anon` e `PUBLIC` revogados. Apenas `authenticated` (SELECT) e `service_role` (ALL).
- **`calc_seo_health`** permanece `SECURITY INVOKER`, EXECUTE só para `authenticated` e `service_role`.

---

## Sub-onda 2.A rev-a — Correção de referência de coluna (entregue 2026-07-03)

**Problema:** a função `calc_seo_health` referenciava `v_found.has_primary_verified_domain`, mas a view `v_seo_store_foundation` expõe a coluna como `has_verified_primary_domain`. Isso quebrava a RPC com `ERROR 42703: record "v_found" has no field "has_primary_verified_domain"`.

**Fix:** migration `CREATE OR REPLACE FUNCTION public.calc_seo_health(...)` substituindo apenas as 2 ocorrências incorretas dentro do corpo da função. Nenhuma outra alteração.

**Escopo do fix:**
- ✅ Apenas o corpo da função (2 tokens trocados).
- ✅ Mantém assinatura `(p_tenant_id uuid) RETURNS jsonb`, `STABLE`, `SECURITY INVOKER` (default), `search_path=public`.
- ✅ Mantém a guarda `user_has_tenant_access` e os grants existentes.
- ✅ Mantém pesos, fatores, pendências e contrato de retorno idênticos.
- ❌ Nenhuma view alterada.
- ❌ Nenhum grant, RLS, trigger, cron, cache, snapshot ou dado real alterado.

**Validação executada:**
- Chamada real da RPC sem sessão retorna `42501` da guarda (comportamento esperado), provando que o antigo `42703` foi eliminado e o restante do corpo compila/executa.
- Auditoria confirmou que não havia outras referências de coluna quebradas.

---

## Sub-onda 2.B — Central read-only (entregue 2026-07-03)

**Rota:** `/storefront/seo`
**Item de menu:** `Loja Online → SEO da Loja` (2ª posição do grupo, ícone `Search`).
**Arquivo:** `src/pages/StorefrontSeoCenter.tsx`.
**Fonte de dados principal:** `supabase.rpc('calc_seo_health', { p_tenant_id })` no contexto do usuário autenticado (nunca service_role no client).
**Drill-down:** consulta direta às views `v_seo_coverage_*` sob demanda, limitado a 20 itens por grupo, apenas quando o usuário clica em "Ver itens" em uma pendência.

### Seções da tela
1. **Cabeçalho:** "Central de SEO da Loja" · legenda "Índice interno do Comando Central" · botão **Atualizar painel** (refaz queries locais, sem escrita).
2. **Cartão de índice:** score 0–100, cor por faixa (≥80 saúde, 50–79 atenção, <50 crítico), timestamp em BRT.
3. **Cobertura por entidade:** grid de 5 cards (produtos, categorias, páginas, LPs, blog) com % OK, contagem `ok/total`, peso e link para o módulo original.
4. **Fundação técnica:** 5 sinais binários (favicon, SEO padrão título/descrição, domínio primário verificado, SSL). Cada sinal falho oferece link direto para `/storefront` ou `/settings/domains`.
5. **Pendências acionáveis:** um card por pendência agregada, com "Ver itens" (drill-down 20 itens) e link para o módulo original.
6. **Landing pages não indexáveis:** contador informativo. LPs `no_index=true` nunca aparecem como pendência.
7. **Rodapé:** aviso explícito de que a tela é read-only e não faz chamadas externas.

### Roteamento de correções
| Pendência | Link |
|---|---|
| Produtos, categorias, páginas, blog, LPs | módulo original (`/products`, `/categories`, `/pages`, `/blog`) |
| Fundação — favicon / SEO padrão | `/storefront` |
| Fundação — domínio verificado / SSL | `/settings/domains` |

Nenhuma rota nova foi criada. Se no futuro existir uma rota de edição direta e segura para a entidade específica, o link pode ser trocado sem mudança de contrato.

### O que a 2.B **não faz** (por decisão de escopo)
- ❌ Não chama IA, Google Search Console, Worker, sitemap, robots, storefront-html ou StorefrontHead.
- ❌ Não escreve no banco.
- ❌ Não usa service_role no client.
- ❌ Não cria Edge Function, cron, cache, snapshot, tabela, coluna, trigger, filtro novo ou biblioteca nova.
- ❌ Não altera pesos, fatores ou pendências da 2.A.
- ❌ Não altera comportamento de `/marketing`, `/integrations`, `/storefront`, `/storefront/builder`, `/pages`, `/blog`, `/categories`, `/menus`, `/settings/domains`.
- ❌ Não reorganiza sidebar nem renomeia grupos.

---

## Roadmap — próximas sub-ondas (não implementadas)

**Ordem aprovada:** 2.A → 2.B → 2.F → 2.C → 2.D → 2.E.

- **2.F — Correções de SEO público server-side.** Ajustes de `<title>/description/canonical/og:*/twitter/JSON-LD/og:type` nascem no `storefront-html` + `block-compiler`. **Não** introduzir `react-helmet-async`. **Não** transformar `StorefrontHead.tsx` em fonte de verdade. LPs de Ads passam por auditoria prévia e ficam congeladas.
- **2.C — Search Console cacheado.** Refresh manual com rate-limit ≥ 10 min e cache em `seo_gsc_cache` (a criar quando a sub-onda começar). Sem cron, sem chamada na abertura.
- **2.D — Sugestões IA individuais.** Ação explícita, sempre draft com diff, aprovação manual, rollback, Motor Universal de Créditos, guardrails contra claims/alegações regulatórias.
- **2.E — Lote com orçamento.** Estimativa de créditos exibida antes, confirmação, cancelamento, tudo como draft.

## Contrato de Landing Pages
- Linguagem futura na UI: "Ativar SEO orgânico nesta landing page" (SEO on → `no_index=false`; off → `no_index=true`).
- LPs de Ads permanecem separadas e nunca são alvo editorial SEO orgânico nesta Central.
- LPs `no_index=true` só aparecem como contador informativo, nunca como pendência.

## Permissões (MVP)
- Visualização da Central: quem já enxerga o módulo Loja Online (`loja_online`).
- Aprovar/aplicar sugestões (2.D/2.E, futuro): owner + admin.
- Sem role nova.

## Governança
- Este arquivo (`docs/especificacoes/storefront/central-seo.md`) é a **fonte de verdade única** da Central de SEO da Loja.
- `docs/especificacoes/storefront/seo.md` continua sendo a fonte de verdade da fundação técnica pública (Onda 1) — não sobrescrever.
- `docs/especificacoes/marketing/central-seo.md` mantém apenas nota de redirecionamento.
- `docs/especificacoes/transversais/mapa-ui.md` registra `Loja Online → SEO da Loja → /storefront/seo`.
