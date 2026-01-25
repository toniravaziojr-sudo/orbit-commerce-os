# Campanhas (Criador de Campanhas) — Regras e Especificações

> **Status:** 🟧 Pending (não validado)  
> **Última atualização:** 2025-01-25

---

## Visão Geral

Sistema de planejamento e criação de campanhas de marketing com IA, dividido em três módulos:

1. **Campanhas** (`/campaigns`) - IA Estrategista para tráfego pago
2. **Mídias Sociais** (`/media`) - Calendário editorial para Facebook e Instagram
3. **Campanhas Blog** (`/blog/campaigns`) - Calendário editorial para posts de blog (ver `docs/regras/blog.md`)

---

## Arquivos Principais

### Mídias Sociais (Facebook/Instagram)

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/Campaigns.tsx` | IA Estrategista |
| `src/pages/Media.tsx` | Mídias Sociais (Facebook/Instagram) |
| `src/hooks/useMediaCampaigns.ts` | Hook CRUD campanhas |
| `src/components/media/CampaignCalendar.tsx` | Calendário visual |
| `src/components/media/CampaignsList.tsx` | Lista de campanhas |
| `supabase/functions/media-generate-suggestions/` | Geração IA |
| `supabase/functions/late-schedule-post/` | Agendamento Late |

### Campanhas Blog

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/BlogCampaigns.tsx` | Lista de campanhas de blog |
| `src/pages/BlogCampaignDetail.tsx` | Detalhe com calendário |
| `supabase/functions/media-publish-blog/` | Publicação em blog_posts |

---

## Módulo 1: Campanhas (IA Estrategista)

### Abas

| Aba | Propósito |
|-----|-----------|
| **Campanhas** | Estruturação de campanhas para Meta/Google/TikTok |
| **Personas** | Criação de personas com IA (dores, desejos, objeções) |
| **Ângulos** | Ângulos de copy (urgência, prova social, autoridade) |

### Status Atual
> Em construção - interface básica implementada, lógica de IA pendente.

---

## Módulo 2: Gestão de Mídias

### Tabelas

#### media_campaigns

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `name` | TEXT | Nome da campanha |
| `prompt` | TEXT | Prompt base para IA |
| `start_date` | DATE | Início |
| `end_date` | DATE | Fim |
| `days_of_week` | INT[] | Dias ativos (0-6) |
| `status` | ENUM | `draft`, `planning`, `generating`, `ready`, `active` |
| `target_channel` | ENUM | `facebook`, `instagram`, `blog` |
| `auto_publish` | BOOLEAN | Publicação automática |

#### media_calendar_items

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `campaign_id` | UUID | FK campaign |
| `scheduled_date` | DATE | Data agendada |
| `scheduled_time` | TIME | Horário |
| `content_type` | ENUM | `image`, `video`, `carousel`, `story`, `reel` |
| `title` | TEXT | Título |
| `copy` | TEXT | Texto do post |
| `cta` | TEXT | Call-to-action |
| `hashtags` | TEXT[] | Hashtags |
| `generation_prompt` | TEXT | Prompt para imagem |
| `asset_url` | TEXT | URL do asset gerado |
| `status` | ENUM | `draft`, `suggested`, `approved`, `published` |

### Enums

```sql
CREATE TYPE media_campaign_status AS ENUM (
  'draft', 'planning', 'generating', 'ready', 
  'active', 'paused', 'completed', 'archived'
);

CREATE TYPE media_item_status AS ENUM (
  'draft', 'suggested', 'review', 'approved',
  'generating_asset', 'scheduled', 'publishing',
  'published', 'failed', 'skipped'
);

CREATE TYPE media_content_type AS ENUM (
  'image', 'video', 'carousel', 'story', 'reel', 'text'
);
```

---

## Fluxos

### Criação de Campanha de Mídia

```
1. Admin cria campanha com:
   - Nome, período, dias da semana
   - Prompt base (tema/tom)
   - Canal alvo (Instagram, Facebook, Blog)
   ↓
2. Clica "Gerar Sugestões"
   ↓
3. media-generate-suggestions:
   - Usa IA para gerar calendar_items
   - Preenche title, copy, hashtags, generation_prompt
   - Status = "suggested"
   ↓
4. Admin revisa no calendário
   - Edita/aprova cada item
   - Status → "approved"
   ↓
5. Gera assets (imagens)
   - media-generate-image
   - Status → "generating_asset" → "ready"
   ↓
6. Agenda publicação
   - late-schedule-post (Late integration)
   - Status → "scheduled" → "published"
```

### Publicação via Late

```typescript
// late-schedule-post
POST /late-schedule-post
{
  "tenant_id": "...",
  "calendar_item_ids": ["..."],
  "publish_at": "2025-01-20T10:00:00Z"
}
```

---

## Integração Late

| Função | Propósito |
|--------|-----------|
| `late-auth-start` | Início OAuth |
| `late-auth-callback` | Callback OAuth |
| `late-schedule-post` | Agendar publicação |
| `late-auth-status` | Status da conexão |

---

## Calendário Visual

```tsx
<CampaignCalendar campaignId={id}>
  // Grid mensal
  // Cada dia mostra itens agendados
  // Drag-and-drop para reagendar
  // Click para editar
</CampaignCalendar>
```

---

## Geração de Assets

### Sem Produto (Lovable AI)
```
Cenários, lifestyle, conceitos
→ gemini-2.5-flash-image
```

### Com Produto (OpenAI)
```
Composição com imagem real do produto
→ dall-e-3
```

---

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Publicar sem revisão | Fluxo: suggested → approved → published |
| Gerar asset sem prompt | Sempre ter generation_prompt |
| Ignorar canal alvo | Respeitar target_channel da campanha |

---

## Checklist

- [ ] Criar campanha com período
- [ ] Gerar sugestões com IA
- [ ] Calendário visual funciona
- [ ] Edição inline de items
- [ ] Geração de imagens
- [ ] Conexão com Late
- [ ] Publicação automática
