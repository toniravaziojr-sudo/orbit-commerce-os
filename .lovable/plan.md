

# Fase 1 — Scope Packs + OAuth Incremental + Descoberta de Ativos

## Objetivo

Desbloquear todos os pacotes de permissoes na tela Integracoes > Meta, implementar consentimento incremental (re-auth para novos packs sem quebrar tokens existentes), e descobrir/exibir todos os ativos conectados (Pages, IG, WhatsApp, Ad Accounts, Catalogos, Threads).

Uma vez conectado aqui, as funcionalidades ficam automaticamente disponiveis nos modulos correspondentes (Atendimento, Calendario de Conteudo, Gestor de Trafego, etc).

---

## O Que Muda

### 1. Tipo `MetaScopePack` (useMetaConnection.ts)

Adicionar dois novos packs ao tipo:

```text
ANTES: "atendimento" | "publicacao" | "ads" | "leads" | "catalogo" | "whatsapp"
DEPOIS: "atendimento" | "publicacao" | "ads" | "leads" | "catalogo" | "whatsapp" | "threads" | "live_video"
```

Adicionar novos campos ao `MetaAssets`:
- `catalogs: Array<{ id: string; name: string }>`
- `threads_profile: { id: string; username: string } | null`

### 2. UI de Scope Packs (MetaUnifiedSettings.tsx)

**Desbloquear packs existentes** — mudar `available: true` para:
- `atendimento` (Messenger + Instagram DM + Comentarios)
- `ads` (Campanhas e metricas)
- `leads` (Lead Ads)
- `catalogo` (Catalogo de Produtos)

**Adicionar novos packs:**
- `threads` — Publicacao e gestao no Threads
- `live_video` — Transmissoes ao vivo (Lives)

**Consentimento incremental:** Quando ja conectado, mostrar botao "Adicionar permissoes" que dispara re-auth pedindo APENAS os novos scopes selecionados (uniao dos atuais + novos).

**Ativos conectados:** Adicionar cards para:
- Catalogos (icone ShoppingBag)
- Threads (icone AtSign ou similar)

### 3. MetaConnectionSettings.tsx

Atualizar o `SCOPE_PACK_INFO` para incluir os mesmos novos packs (`threads`, `live_video`). Sincronizar com MetaUnifiedSettings.

### 4. Edge Function `meta-oauth-start`

Atualizar `SCOPE_PACKS` com os novos mapeamentos:

```text
atendimento:
  pages_messaging
  instagram_manage_messages (ou instagram_business_manage_messages)
  pages_manage_engagement
  pages_read_user_content
  pages_read_engagement

ads:
  ads_management
  ads_read
  pages_manage_ads
  leads_retrieval

catalogo:
  catalog_management

threads:
  threads_content_publish
  threads_manage_replies
  threads_manage_insights
  threads_basic
  threads_read_replies

live_video:
  publish_video
  pages_manage_posts (necessario para criar live na pagina)
```

Manter a logica existente de uniao de escopos (Set) — isso garante que re-auth inclui escopos anteriores + novos.

### 5. Edge Function `meta-oauth-callback`

Expandir `discoverMetaAssets` para:

1. **Catalogos** (quando pack `catalogo` ativo):
   - `GET /{version}/me/businesses` -> para cada business: `GET /{business_id}/owned_product_catalogs?fields=id,name`
   - Salvar em `assets.catalogs`

2. **Threads** (quando pack `threads` ativo):
   - `GET /{version}/me/threads?fields=id,username` (Threads API)
   - Salvar em `assets.threads_profile`

3. **Merge de scope_packs:** Na hora do upsert em `marketplace_connections`, fazer uniao dos packs anteriores com os novos (nao substituir), preservando o consentimento incremental.

---

## Logica de Consentimento Incremental

```text
1. Tenant conecta com packs ["publicacao", "whatsapp"]
2. Token salvo com scope_packs: ["publicacao", "whatsapp"]
3. Tenant quer adicionar "ads"
4. UI mostra botao "Adicionar permissoes"
5. meta-oauth-start recebe scopePacks: ["publicacao", "whatsapp", "ads"]
   (uniao dos atuais + novos)
6. Meta pede autorizacao APENAS dos novos escopos
7. meta-oauth-callback faz merge: scope_packs finais = ["publicacao", "whatsapp", "ads"]
8. Novo token substitui o anterior (com todos os escopos)
```

---

## Arquivos Afetados

| Arquivo | Tipo de Alteracao |
|---------|-------------------|
| `src/hooks/useMetaConnection.ts` | Adicionar tipos `threads`, `live_video` + campos `catalogs`, `threads_profile` ao MetaAssets |
| `src/components/integrations/MetaUnifiedSettings.tsx` | Desbloquear packs + adicionar novos + botao re-auth + cards de ativos |
| `src/components/integrations/MetaConnectionSettings.tsx` | Sincronizar SCOPE_PACK_INFO com novos packs |
| `supabase/functions/meta-oauth-start/index.ts` | Adicionar mapeamento de escopos para novos packs |
| `supabase/functions/meta-oauth-callback/index.ts` | Expandir discoverMetaAssets + merge de scope_packs |

---

## Criterios de Aceite

1. Todos os 8 packs aparecem na UI e podem ser selecionados
2. Cada pack pede somente seus escopos especificos
3. Re-auth (adicionar novo pack) nao quebra token/packs existentes
4. Assets conectados aparecem na UI: Pages, IG, WhatsApp, Ad Accounts, Catalogos, Threads
5. Multi-tenant seguro: tokens server-side, logs com tenant_id
6. WhatsApp existente continua funcionando sem alteracoes

