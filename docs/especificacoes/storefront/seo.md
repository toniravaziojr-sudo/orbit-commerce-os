# SEO — Fundação Técnica (Onda 1)

**Versão:** v1.0 (2026-07-01)
**Status:** Ativo em produção
**Escopo:** Loja pública (storefront) por tenant. Não altera Comando Central, checkout, builder, favicon nem lógica de anúncios.

---

## 1. Objetivo

Servir `robots.txt` e `sitemap.xml` por tenant, injetar `<meta name="robots">` server-side no HTML da loja e estabelecer `store_pages.no_index` como campo canônico de indexação. Base para futura Central de SEO (Onda 2+).

---

## 2. Fonte de verdade — indexação por página

Campo canônico único: **`public.store_pages.no_index`** (boolean).

- `no_index = false` (ou null) → página **indexável** (`index,follow`)
- `no_index = true` → página **não indexável** (`noindex,follow`)

Regras:
- Não existem campos paralelos de indexação (`seo_indexable`, etc.) — proibido criar.
- `ai_landing_pages` não participa desta onda (não serve páginas públicas em `/lp/:slug`).
- Landing pages públicas moram em `store_pages` com `type = 'landing_page'`.

### 2.1 Default para novas landing pages

Trigger `trg_store_pages_lp_default_noindex` (`BEFORE INSERT`) força `no_index = true` sempre que `type = 'landing_page'`.

Motivo: landing pages são páginas de campanha/oferta; devem entrar no ar sem competir com produtos/categorias por indexação orgânica. O lojista ativa "SEO orgânico" depois, via UI futura, mudando para `no_index = false`.

### 2.2 Landing pages existentes

Preservadas. **Nenhum backfill em massa.** Ao entrar em produção não havia LPs em `store_pages` (contagem oficial no relatório da Onda 1). Alterações futuras em massa exigem aprovação explícita.

### 2.3 UI futura

Campo será exposto como toggle **"Ativar SEO orgânico nesta landing page"**.
- Ativado → `no_index = false`
- Desativado → `no_index = true`

Não faz parte da Onda 1.

---

## 3. `/robots.txt` por tenant

**Edge Function:** `storefront-robots`
**Rota pública:** `/robots.txt` (via Worker Cloudflare — ver §6)
**Cache:** `public, max-age=3600, s-maxage=3600` (1h)

Comportamento:
- Host resolvido para tenant conhecido → libera `/`, bloqueia rotas SPA-only/sensíveis e anuncia `Sitemap:` no domínio canônico do tenant.
- Host desconhecido → `Disallow: /` (segurança).

Rotas bloqueadas (padrão):
```
/carrinho, /cart, /checkout, /obrigado, /rastreio,
/conta, /minha-conta, /busca, /search, /api/
```

---

## 4. `/sitemap.xml` por tenant

**Edge Function:** `storefront-sitemap`
**Rota pública:** `/sitemap.xml` (via Worker Cloudflare — ver §6)
**Cache:** `public, max-age=900, s-maxage=900` (15 min)
**Hard cap:** 45.000 URLs por tenant.

Conteúdo:
1. Home (`/`)
2. Categorias ativas (`categories.is_active = true`) → `/categoria/:slug`
3. Produtos ativos (`status='active'` e `deleted_at IS NULL`) → `/produto/:slug`
4. `store_pages` publicadas com `no_index != true`:
   - `type='institutional'` → `/page/:slug`
   - `type='landing_page'` → `/lp/:slug`
5. Blog: `/blog` (se houver posts) + `/blog/:slug` para cada post `status='published'`.

Campos:
- `<loc>` obrigatório
- `<lastmod>` sempre que houver `updated_at`/`published_at`
- `<changefreq>` e `<priority>` **omitidos** (Google ignora).

Domínio de todas as URLs: `resolved.canonical_origin` (domínio primário do tenant).

---

## 5. `<meta name="robots">` server-side

Injetado pelo `storefront-html` em todas as páginas por ele renderizadas.

| Rota                                  | Meta robots       |
|---------------------------------------|-------------------|
| home, product, category, blog, blog_post | `index,follow`    |
| page (`store_pages`) com `no_index=true` | `noindex,follow`  |
| page com `no_index=false`             | `index,follow`    |
| Rotas SPA-only (`cart`, `checkout`, `conta`, `rastreio`, `busca`) | Não passam por `storefront-html` (retorna 204 → SPA responde). SPA já bloqueia essas rotas via meta client-side. |

Landing pages (`/lp/:slug`) hoje caem no fluxo SPA e não são renderizadas por `storefront-html`. A meta robots delas é entregue via SPA/Helmet — quando o pipeline Edge das LPs for consolidado (onda futura), passará a respeitar `no_index` server-side pelo mesmo caminho.

---

## 6. Worker Cloudflare — versão completa (substituir integralmente)

O Worker `shops-router` já foi atualizado para **v2.2.1** com a interceptação de `/robots.txt` e `/sitemap.xml` embutida no fluxo padrão (antes de favicon e antes do roteamento SPA/HTML). A v2.2.1 força o `Content-Type` correto por rota (`application/xml` para sitemap, `text/plain` para robots), porque o Supabase Gateway reescreve o header original.

**Como aplicar em produção:**

1. Abra o arquivo **`docs/cloudflare-worker-template.js`** (raiz do repositório).
2. Copie **todo o conteúdo** do arquivo.
3. No Cloudflare Dashboard → Workers & Pages → `shops-router` → **Edit code**.
4. Selecione tudo (Ctrl+A) e cole substituindo integralmente.
5. **Save and Deploy**.

**Variáveis obrigatórias no Worker** (já existentes, apenas confira):
- `ORIGIN_HOST` = `orbit-commerce-os.lovable.app`
- `SUPABASE_URL` = URL do backend
- `SUPABASE_ANON_KEY` = anon key do backend

**Rotas do Worker** (já configuradas, apenas confira):
- `*.shops.comandocentral.com.br/*`
- `shops.comandocentral.com.br/*`
- `app.comandocentral.com.br/integrations/*`
- Domínios customizados de tenants (via Custom Hostnames)

**O que muda para o usuário final:**
- `https://<dominio-do-tenant>/robots.txt` → passa a devolver o robots do tenant (cache 1h).
- `https://<dominio-do-tenant>/sitemap.xml` → passa a devolver o sitemap do tenant (cache 15min).
- `https://app.comandocentral.com.br/robots.txt` e `/sitemap.xml` → **não são interceptados** (comportamento atual preservado).

**Validação pós-deploy:**
```
curl -sI https://<dominio-do-tenant>/robots.txt   | grep -Ei 'HTTP|content-type|x-cc-cache'
curl -sI https://<dominio-do-tenant>/sitemap.xml  | grep -Ei 'HTTP|content-type|x-cc-cache'
curl -s  https://<dominio-do-tenant>/_debug       | grep -E 'seoIntercepted|strategy'
```
Esperado: `HTTP/2 200`, `content-type: text/plain` (robots) ou `application/xml` (sitemap), `x-cc-cache: MISS` na primeira chamada e `HIT` nas seguintes. O `/_debug` deve listar `seoIntercepted` com as duas rotas e `strategy` terminando em `_seo_v1`.

**Rollback:** basta redeployar a versão anterior do Worker (v2.1.0). As edge functions `storefront-robots` e `storefront-sitemap` continuam no ar; apenas deixam de ter rota pública.

---

## 7. Restrições em vigor (Onda 1)

Não implementado nesta onda:
- Painel Central de SEO na UI.
- Submissão automática de sitemap ao Google Search Console.
- URL Inspection API.
- Cron para reindexação, verificação de indexação ou backfill.
- IA aplicada a SEO.
- Alteração de páginas existentes (LPs, institucionais, produtos, categorias).

Regras de parada:
Interromper e consultar o produto antes de qualquer alteração em massa em LPs existentes, mudança de UI/UX, uso de GSC/cron/IA ou risco de deindexação.

---

## 8. Não-regressão

- Storefront edge/SPA, checkout, favicon, cache do Cloudflare, prerender e rotas públicas atuais permanecem inalterados.
- `store_pages` mantém coluna `no_index` já existente; trigger só age em `INSERT` de `type='landing_page'`.
- Sitemap/robots ficam no ar mesmo antes do Worker ser atualizado, servidos pelas edge functions — só ganham a rota pública `/robots.txt` e `/sitemap.xml` após o snippet ser aplicado no Worker.

---

## 9. Contagem oficial na entrada da Onda 1

| Métrica                                                          | Valor |
|------------------------------------------------------------------|-------|
| Landing pages existentes em `store_pages` (`type='landing_page'`) | 0     |
| ...com `no_index=false` (indexáveis)                              | 0     |
| ...com `no_index=true` (não indexáveis)                           | 0     |
| ...publicadas que entrariam no sitemap                            | 0     |

Zero risco de deindexação por regressão nesta ativação.

---

## 10. Próximas ondas (referência)

- Onda 2: Central de SEO na UI (revisão de títulos/descrições, toggle "SEO orgânico" nas LPs, alertas de páginas sem meta).
- Onda 3: Integração com Google Search Console (submissão de sitemap, URL Inspection).
- Onda 4: IA aplicada (sugestões de meta title/description, revisão em lote).
