

# Hub Centralizado Meta — Plano de Implementação

## Status das Fases

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Scope Packs + OAuth Incremental + Descoberta de Ativos | ✅ Concluída |
| 2 | Atendimento Unificado (Messenger + IG DM + Comentários) | ✅ Concluída |
| 3 | Gestor de Tráfego IA (Ads Manager) | ✅ Concluída |
| 4 | Lead Ads (Captura de Leads) | ⬜ Pendente |
| 5 | Catálogo de Produtos | ⬜ Pendente |
| 6 | Threads (Publicação) | ⬜ Pendente |
| 7 | oEmbed (Bloco no Builder) | ⬜ Pendente |
| 8 | Lives (Novo Módulo) | ⬜ Pendente |
| 9 | Page Insights | ⬜ Pendente |

---

## Fase 1 — ✅ Concluída (2026-02-14)

### O que foi implementado

1. **Tipos atualizados** — `MetaScopePack` com 8 packs: `atendimento`, `publicacao`, `ads`, `leads`, `catalogo`, `whatsapp`, `threads`, `live_video`
2. **MetaAssets expandido** — Adicionados `catalogs[]` e `threads_profile`
3. **UI completa** — Todos os 8 packs desbloqueados em MetaUnifiedSettings e MetaConnectionSettings
4. **Consentimento incremental** — Componente `IncrementalConsentSection` para adicionar packs sem perder token
5. **Edge Function `meta-oauth-start`** — Mapeamento completo de escopos por pack
6. **Edge Function `meta-oauth-callback`** — Descoberta de catálogos e Threads + merge de scope_packs

### Arquivos alterados
- `src/hooks/useMetaConnection.ts`
- `src/components/integrations/MetaUnifiedSettings.tsx`
- `src/components/integrations/MetaConnectionSettings.tsx`
- `supabase/functions/meta-oauth-start/index.ts`
- `supabase/functions/meta-oauth-callback/index.ts`

---

## Fase 2 — ✅ Concluída (2026-02-14)

### O que foi implementado

1. **`meta-page-webhook`** — Webhook unificado para Messenger + comentários do Facebook
2. **`meta-instagram-webhook`** — Webhook unificado para Instagram DM + comentários do IG
3. **`meta-send-message`** — Envio de mensagens via Graph API (Messenger + IG DM)
4. **`support-send-message`** atualizado — Roteamento para canais `facebook_messenger` e `instagram_dm`
5. **Documentação** — `docs/regras/crm.md` atualizado com status dos canais

### Arquivos criados/alterados
- `supabase/functions/meta-page-webhook/index.ts` (novo)
- `supabase/functions/meta-instagram-webhook/index.ts` (novo)
- `supabase/functions/meta-send-message/index.ts` (novo)
- `supabase/functions/support-send-message/index.ts` (atualizado)
- `supabase/config.toml` (atualizado)
- `docs/regras/crm.md` (atualizado)

---

## Fase 3 — ✅ Concluída (2026-02-14)

### O que foi implementado

1. **Tabelas** — `meta_ad_campaigns`, `meta_ad_insights`, `meta_ad_audiences`, `meta_ad_creatives` com RLS tenant-scoped
2. **Edge Functions** — `meta-ads-campaigns` (CRUD + sync), `meta-ads-insights` (sync + summary), `meta-ads-audiences` (sync + list), `meta-ads-creatives` (sync + list)
3. **Hook** — `useMetaAds` com queries, mutations e syncAll
4. **UI** — Página `/ads` (AdsManager) com dashboard de métricas, tabelas de campanhas/insights, cards de públicos/criativos
5. **Armazenamento híbrido** — Cache local com sync sob demanda via Graph API

### Arquivos criados/alterados
- `supabase/functions/meta-ads-campaigns/index.ts` (novo)
- `supabase/functions/meta-ads-insights/index.ts` (novo)
- `supabase/functions/meta-ads-audiences/index.ts` (novo)
- `supabase/functions/meta-ads-creatives/index.ts` (novo)
- `src/hooks/useMetaAds.ts` (novo)
- `src/pages/AdsManager.tsx` (novo)
- `src/App.tsx` (rota /ads adicionada)

---

## Fase 4 — Lead Ads

### Edge Functions
| Function | Descrição |
|---|---|
| `meta-leads-webhook` | Recebe leads via webhook |

### Fluxo
Lead → `customers` + tag automática + notificação

---

## Fase 5 — Catálogo

### Edge Functions
| Function | Descrição |
|---|---|
| `meta-catalog-sync` | Push produtos para Meta |
| `meta-catalog-create` | Criar catálogo |

### Nova tabela
- `meta_catalog_items`

---

## Fase 6 — Threads

### Edge Functions
| Function | Descrição |
|---|---|
| `meta-threads-publish` | Publicar no Threads |
| `meta-threads-insights` | Métricas de posts |

---

## Fase 7 — oEmbed

### Edge Function
| Function | Descrição |
|---|---|
| `meta-oembed` | HTML de incorporação por URL |

### Frontend
- Novo bloco `EmbedSocialPost` no Builder

---

## Fase 8 — Lives

### Edge Functions
| Function | Descrição |
|---|---|
| `meta-live-create` | Criar transmissão |
| `meta-live-manage` | Gerenciar live |

### Frontend
- `src/pages/Lives.tsx` — Nova página em Marketing Avançado
- Rota: `/lives`

### Nova tabela
- `meta_live_streams`

---

## Fase 9 — Page Insights

### Edge Function
| Function | Descrição |
|---|---|
| `meta-page-insights` | Insights das páginas |

### Frontend
- Aba de métricas em `/media`
