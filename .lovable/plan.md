

# Hub Centralizado Meta — Plano de Implementação

## Status das Fases

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Scope Packs + OAuth Incremental + Descoberta de Ativos | ✅ Concluída |
| 2 | Atendimento Unificado (Messenger + IG DM + Comentários) | ✅ Concluída |
| 3 | Gestor de Tráfego IA (Ads Manager) | ⬜ Pendente |
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

## Fase 2 — Atendimento Unificado (Próxima)

### Objetivo
Adicionar Messenger, Instagram DM e comentários FB/IG como canais no inbox de Atendimento.

### Edge Functions necessárias
| Function | Descrição |
|---|---|
| `meta-messenger-webhook` | Recebe mensagens do Messenger |
| `meta-instagram-dm-webhook` | Recebe DMs do Instagram |
| `meta-comments-webhook` | Recebe comentários (FB + IG) |

### Alterações necessárias
- `support-send-message` — Roteamento para Messenger e Instagram DM
- `src/pages/Support.tsx` — Filtro por canal
- `src/hooks/useConversations.ts` — Novos `channel_type`
- Nova tabela `meta_comment_threads`

---

## Fase 3 — Gestor de Tráfego IA (Ads Manager)

### Edge Functions
| Function | Descrição |
|---|---|
| `meta-ads-campaigns` | CRUD de campanhas |
| `meta-ads-insights` | Métricas |
| `meta-ads-audiences` | Públicos |
| `meta-ads-creatives` | Criativos |

### Novas tabelas
- `meta_ad_campaigns`
- `meta_ad_insights`

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
