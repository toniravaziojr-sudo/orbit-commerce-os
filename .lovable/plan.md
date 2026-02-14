

# Hub Google Centralizado — Plano Refinado (com ajustes do review)

## Resumo

Criar aba **"Google"** em `/integrations` com OAuth centralizado, Scope Packs incrementais e descoberta de ativos. Migrar YouTube existente para dentro do Hub. Incorpora todos os ajustes sugeridos no review.

---

## Decisoes Arquiteturais (ajustes incorporados)

### 1. Uma conexao por tenant (Opcao A)

- **1 registro** em `google_connections` por tenant (nao por usuario)
- O admin que conecta e o "dono da conexao" (`connected_by`)
- Todos os usuarios do tenant usam essa conexao
- Evita conflitos de multiplos admins conectando contas diferentes
- Mesmo modelo usado na Meta (`marketplace_connections` com 1 row por tenant+marketplace)

### 2. OAuth incremental com refresh_token como ativo real

- Sempre `access_type=offline` + `prompt=consent` na primeira conexao
- `include_granted_scopes=true` para consentimento incremental
- Quando ativar novo pack: re-OAuth pedindo escopos adicionais
- `refresh_token` e o campo critico (nunca perde-lo)
- `access_token` renovado automaticamente via `google-token-refresh`

### 3. Credencial de plataforma vs tenant

| Credencial | Tipo | Onde fica |
|------------|------|-----------|
| `GOOGLE_CLIENT_ID` | Plataforma | Secrets (ja existe) |
| `GOOGLE_CLIENT_SECRET` | Plataforma | Secrets (ja existe) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Plataforma | `platform_credentials` |
| `login_customer_id` (MCC) | Plataforma (opcional) | `platform_credentials` |
| OAuth tokens | Tenant | `google_connections` |

### 4. Cache hibrido (todos os modulos)

- Tabelas locais para dados historicos (campanhas, metricas, produtos)
- Fallback via API em tempo real quando cache esta stale
- Evita rate limiting e garante consultas rapidas
- Mesmo padrao do `meta_ad_campaigns` / `meta_ad_insights`

### 5. Feature flag por pack

- Cada pack funciona isolado
- UI mostra todos os packs, mas com cadeado/badge nos que dependem de aprovacao de escopos sensiveis (ex: `business`)
- Sistema funciona sem packs nao aprovados

---

## Banco de Dados

### Tabela `google_connections` (nova)

```text
google_connections
  id              UUID PK
  tenant_id       UUID FK tenants (UNIQUE - 1 por tenant)
  connected_by    UUID (user_id do admin que conectou)
  google_user_id  TEXT
  google_email    TEXT
  display_name    TEXT
  avatar_url      TEXT
  access_token    TEXT (criptografado)
  refresh_token   TEXT (criptografado - ATIVO REAL)
  token_expires_at TIMESTAMPTZ
  scope_packs     TEXT[] (packs habilitados)
  granted_scopes  TEXT[] (escopos OAuth concedidos)
  is_active       BOOLEAN DEFAULT true
  connection_status TEXT DEFAULT 'connected'
  last_error      TEXT
  last_sync_at    TIMESTAMPTZ
  assets          JSONB (ativos descobertos por pack)
  metadata        JSONB (dados extras)
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

### Tabela `google_oauth_states` (nova)

```text
google_oauth_states
  id            UUID PK
  tenant_id     UUID FK tenants
  user_id       UUID
  state         TEXT UNIQUE
  scope_packs   TEXT[]
  return_path   TEXT
  expires_at    TIMESTAMPTZ DEFAULT now() + 10min
  created_at    TIMESTAMPTZ
```

### Migracao YouTube

- Copiar dados de `youtube_connections` para `google_connections` com `scope_packs = ['youtube']`
- Manter `youtube_connections` como view ou tabela legada (nao deletar)
- `youtube_uploads` continua referenciando por `connection_id` (atualizar FK para `google_connections`)

---

## Scope Packs

| Pack | Label | Escopos OAuth | Modulo | Sensibilidade |
|------|-------|---------------|--------|---------------|
| `youtube` | YouTube | `youtube.upload`, `youtube`, `youtube.force-ssl`, `youtube.readonly`, `yt-analytics.readonly` | Midias `/media` | Sensivel |
| `ads` | Google Ads | `adwords` | Trafego `/ads` | Sensivel + Dev Token |
| `merchant` | Merchant Center | `content` | Catalogos `/products` | Normal |
| `analytics` | Analytics GA4 | `analytics.readonly` | Relatorios `/analytics` | Normal |
| `search_console` | Search Console | `webmasters.readonly` | SEO `/seo` | Normal |
| `business` | Meu Negocio | `business.manage` | CRM `/reviews` | Sensivel (review chato) |
| `tag_manager` | Tag Manager | `tagmanager.edit.containers`, `tagmanager.readonly` | Utilidades `/integrations` | Normal |

---

## Fases de Implementacao

### Fase 1: Hub Base (OAuth + DB + UI)

**Banco:**
- Criar `google_connections` e `google_oauth_states`
- RLS: `user_has_tenant_access(tenant_id)`
- Constraint UNIQUE em `(tenant_id)` para garantir 1 conexao por tenant

**Edge Functions:**
- `google-oauth-start`: Recebe `tenant_id` + `scopePacks[]`, gera URL OAuth com escopos correspondentes, salva state
- `google-oauth-callback`: Troca code por tokens (sempre captura `refresh_token`), descobre ativos por pack, upsert em `google_connections`
- `google-token-refresh`: Renova `access_token` usando `refresh_token`, atualiza `token_expires_at`

**Frontend:**
- `src/hooks/useGoogleConnection.ts` — Hook espelhando `useMetaConnection`
- `src/components/integrations/GoogleUnifiedSettings.tsx` — UI com grid de packs, status, ativos descobertos
- Aba "Google" em `Integrations.tsx`

**Descoberta de ativos (callback):**
- YouTube: listar canais
- Ads: listar contas (se `GOOGLE_ADS_DEVELOPER_TOKEN` existir)
- Merchant: listar contas (tolerar "sem merchant")
- Analytics: listar propriedades GA4
- Search Console: listar sites verificados
- Business: listar localizacoes (tolerar falha se escopo nao aprovado)
- Tag Manager: listar contas/containers

### Fase 2: Migracao YouTube

- Edge functions `youtube-oauth-callback` e `youtube-upload` passam a ler/escrever em `google_connections`
- `useYouTubeConnection` le de `google_connections` filtrado por `'youtube' = ANY(scope_packs)`
- `YouTubeSettings` vira um card dentro do Hub Google (nao mais aba separada)
- Retrocompatibilidade: se `youtube_connections` tiver dados e `google_connections` nao, migrar automaticamente

### Fase 3: Google Merchant Center

- Edge function `google-merchant-sync` (Content API for Shopping)
- Edge function `google-merchant-status`
- Tabela `google_merchant_products` (cache status de sincronizacao)
- Destino: modulo Catalogos/Produtos

### Fase 4: Google Ads Manager

- Edge functions: `google-ads-campaigns`, `google-ads-insights`, `google-ads-audiences`
- Tabelas: `google_ad_campaigns`, `google_ad_insights` (cache hibrido)
- Requer `GOOGLE_ADS_DEVELOPER_TOKEN` em `platform_credentials`
- Suporte a `login_customer_id` (MCC) se aplicavel
- Destino: Gestor de Trafego IA

### Fase 5: Google Analytics (GA4)

- Edge functions: `google-analytics-report`, `google-analytics-realtime`
- Destino: Relatorios e atribuicao de vendas

### Fase 6: Search Console

- Edge functions: `google-search-console-performance`, `google-search-console-indexing`
- Integra com IA de SEO (blog, paginas institucionais)

### Fase 7: Google Meu Negocio

- Edge functions: `google-business-reviews`, `google-business-posts`
- Feature flag: funciona sem esse pack se escopo nao aprovado
- Destino: CRM/Avaliacoes

### Fase 8: Google Tag Manager

- Edge functions: `google-tag-manager-containers`, `google-tag-manager-scripts`
- UI para gerenciar scripts customizados
- Destino: Utilidades em `/integrations`

---

## Arquivos Criados/Modificados

### Novos (Fase 1):
- `src/hooks/useGoogleConnection.ts`
- `src/components/integrations/GoogleUnifiedSettings.tsx`
- `supabase/functions/google-oauth-start/index.ts`
- `supabase/functions/google-oauth-callback/index.ts`
- `supabase/functions/google-token-refresh/index.ts`

### Modificados (Fase 1-2):
- `src/pages/Integrations.tsx` — Nova aba "Google"
- `src/hooks/useYouTubeConnection.ts` — Migrar para `google_connections`
- `supabase/functions/youtube-oauth-callback/index.ts` — Gravar em `google_connections`
- `supabase/functions/youtube-upload/index.ts` — Ler de `google_connections`
- `docs/regras/integracoes.md` — Documentar Hub Google

---

## O que voce (integrador) precisa fazer

1. **Google Cloud Console** (mesmo projeto existente):
   - Ativar APIs: Ads, Content (Merchant), Analytics Data, Search Console, Business Profile, Tag Manager
   - Adicionar redirect URI do callback: `{SUPABASE_URL}/functions/v1/google-oauth-callback`
   - Atualizar OAuth Consent Screen com todos os escopos

2. **Google Ads Developer Token**:
   - Solicitar em Google Ads > Ferramentas > API Center
   - Nivel Basic para comecar
   - Salvar como `GOOGLE_ADS_DEVELOPER_TOKEN` em `platform_credentials`

3. **Verificacao OAuth**:
   - Submeter app para verificacao de escopos sensiveis
   - YouTube, Ads e Business Profile sao sensiveis
   - Analytics e Search Console sao normais

4. **O cliente final**: So clica "Conectar" e autoriza. Identico a Meta.

---

## Ordem de execucao

Fase 1 (Hub Base) -> Fase 2 (Migrar YouTube) -> Fases 3-8 (independentes entre si)

Vamos comecar pela Fase 1?

