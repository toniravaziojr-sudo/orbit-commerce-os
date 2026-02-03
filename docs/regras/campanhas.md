# Campanhas (Criador de Campanhas) — Regras e Especificações

> **Status:** 🟩 Atualizado  
> **Última atualização:** 2026-01-28

---

## Visão Geral

Sistema de planejamento e criação de campanhas de marketing com IA, dividido em quatro módulos:

1. **Campanhas** (`/campaigns`) - IA Estrategista para tráfego pago
2. **Mídias Sociais** (`/media`) - Calendário editorial para Facebook, Instagram e YouTube
3. **Campanhas Blog** (`/blog/campaigns`) - Calendário editorial para posts de blog (ver `docs/regras/blog.md`)
4. **YouTube** - Upload e agendamento de vídeos no canal (integrado ao módulo Mídias Sociais)

---

## Arquivos Principais

### Mídias Sociais (Facebook/Instagram/YouTube)

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/Campaigns.tsx` | IA Estrategista |
| `src/pages/Media.tsx` | Mídias Sociais (Facebook/Instagram/YouTube) |
| `src/hooks/useMediaCampaigns.ts` | Hook CRUD campanhas |
| `src/components/media/CampaignCalendar.tsx` | Calendário visual |
| `src/components/media/CampaignsList.tsx` | Lista de campanhas |
| `src/components/media/PublicationDialog.tsx` | Dialog de criação/edição |
| `supabase/functions/media-generate-suggestions/` | Geração IA |
| `supabase/functions/late-schedule-post/` | Agendamento Late (Meta) |
| `supabase/functions/youtube-upload/` | Upload para YouTube |

### Campanhas Blog

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/BlogCampaigns.tsx` | Lista de campanhas de blog |
| `src/pages/BlogCampaignDetail.tsx` | Detalhe com calendário |
| `supabase/functions/media-publish-blog/` | Publicação em blog_posts |

### YouTube Integration

| Arquivo | Propósito |
|---------|-----------|
| `src/hooks/useYouTubeConnection.ts` | Hook para OAuth e status |
| `src/components/integrations/YouTubeSettings.tsx` | UI de configuração |
| `supabase/functions/youtube-oauth-start/` | Início do OAuth |
| `supabase/functions/youtube-oauth-callback/` | Callback OAuth |
| `supabase/functions/youtube-upload/` | Upload de vídeos |

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
| `target_channel` | ENUM | `all`, `facebook`, `instagram`, `blog`, `youtube` |
| `auto_publish` | BOOLEAN | Publicação automática |

#### media_calendar_items

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `campaign_id` | UUID | FK campaign |
| `scheduled_date` | DATE | Data agendada |
| `scheduled_time` | TIME | Horário |
| `content_type` | ENUM | `image`, `video`, `carousel`, `story`, `reel`, `text` |
| `title` | TEXT | Título |
| `copy` | TEXT | Texto do post / Descrição do vídeo |
| `cta` | TEXT | Call-to-action |
| `hashtags` | TEXT[] | Hashtags / Tags do YouTube |
| `generation_prompt` | TEXT | Prompt para imagem ou notas/roteiro |
| `asset_url` | TEXT | URL do asset gerado ou vídeo |
| `status` | ENUM | `draft`, `suggested`, `approved`, `published` |
| `target_channel` | ENUM | Canal alvo (`youtube`, `blog`, etc.) |

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

### Criação de Campanha de Mídia (Redes Sociais)

```
1. Admin cria campanha com:
   - Nome, período, dias da semana
   - Prompt base (tema/tom)
   - Canal alvo (Instagram, Facebook, Blog, YouTube)
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
5. Gera assets (imagens) - apenas para redes sociais
   - media-generate-image
   - Status → "generating_asset" → "ready"
   ↓
6. Agenda publicação
   - late-schedule-post (Meta) OU youtube-upload (YouTube)
   - Status → "scheduled" → "published"
```

### Fluxo YouTube (Vídeos)

```
1. Campanha com target_channel = "youtube"
   ↓
2. Criar itens no calendário (tipo: vídeo)
   - Título, descrição, tags
   - Upload do arquivo de vídeo
   ↓
3. Aprovar item
   ↓
4. youtube-upload:
   - Verifica saldo de créditos (16+ por vídeo)
   - Reserva créditos
   - Upload resumable para YouTube
   - Consome créditos
   - Status → "published"
```

### Publicação via Late (Meta)

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

## Integração Late (Meta)

| Função | Propósito |
|--------|-----------|
| `late-auth-start` | Início OAuth |
| `late-auth-callback` | Callback OAuth |
| `late-schedule-post` | Agendar publicação |
| `late-auth-status` | Status da conexão |

---

## Integração YouTube

| Função | Propósito |
|--------|-----------|
| `youtube-oauth-start` | Início OAuth com Google |
| `youtube-oauth-callback` | Callback OAuth e salvamento de tokens |
| `youtube-upload` | Upload de vídeo com metadados |

### Consumo de Créditos (YouTube)

| Operação | Créditos | Descrição |
|----------|----------|-----------|
| Upload base | 16 | Custo mínimo por vídeo |
| +Thumbnail | 1 | Upload de thumbnail customizada |
| +1GB de vídeo | 1 | Overhead por tamanho |

### Tabelas YouTube

| Tabela | Propósito |
|--------|-----------|
| `youtube_connections` | Tokens OAuth por tenant |
| `youtube_uploads` | Fila de uploads assíncronos |
| `youtube_oauth_states` | Estados OAuth temporários |

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

## Geração de Vídeos IA (v2.0)

O módulo de Mídias inclui geração de vídeos com pipeline de alta fidelidade:

### Tabelas

| Tabela | Propósito |
|--------|-----------|
| `media_category_profiles` | Perfis de nicho com pesos de QA |
| `media_preset_components` | Componentes modulares (cena, luz, câmera, narrativa) |
| `media_video_presets` | Presets compostos para geração |
| `media_video_jobs` | Jobs de geração com pipeline de 6 estágios |
| `media_video_candidates` | Candidatos gerados com scores de QA |

### Pipeline de 6 Estágios

```
1. PREPROCESS → Preparar cutout/mask do produto
2. REWRITE → Converter prompt em shot_plan estruturado
3. GENERATE_CANDIDATES → Gerar N variações
4. QA_SELECT → Avaliar com IA vision (similarity + OCR + quality)
5. RETRY → Tentativa extra com fidelidade rígida (se QA falhar)
6. FALLBACK → Composição do produto sobre cenário gerado
```

### Pesos de QA por Nicho

| Nicho | Similaridade | OCR Rótulo | Qualidade | Estabilidade |
|-------|--------------|------------|-----------|--------------|
| Foco no Produto | 45% | 30% | 25% | 0% |
| Lifestyle | 35% | 25% | 30% | 10% |
| Storytelling | 30% | 20% | 35% | 15% |

### Arquivos

| Arquivo | Propósito |
|---------|-----------|
| `supabase/functions/media-video-generate/` | Edge Function do pipeline |
| `src/hooks/useMediaVideoCreatives.ts` | Hooks React |
| `src/components/media/MediaVideoJobsList.tsx` | Lista de jobs com progresso |

---

## Separação de Fluxos: Blog vs. Mídias vs. YouTube

O `PublicationDialog` recebe a prop `campaignType` para diferenciar o fluxo:

| `campaignType` | Comportamento |
|----------------|---------------|
| `"blog"` | Vai direto para formulário de artigo (título + conteúdo) |
| `"social"` | Exibe seleção de tipo (Feed/Stories) → seleção de canais (Instagram/Facebook) → detalhes |
| `"youtube"` | Vai direto para formulário de vídeo (título + descrição + tags) |

### Regras de Isolamento

| ✅ Correto | ❌ Proibido |
|-----------|-------------|
| Blog mostra apenas formulário de artigo | Blog mostrar opções Feed/Stories/YouTube |
| Mídias mostra apenas Feed/Stories | Mídias mostrar opção de Blog ou YouTube |
| YouTube mostra apenas formulário de vídeo | YouTube mostrar opções de outras plataformas |
| Cada módulo usa sua Edge Function | Misturar `late-schedule-post` com `youtube-upload` |

### Implementação

```tsx
// CampaignCalendar.tsx
<PublicationDialog
  campaignType={
    campaign?.target_channel === "blog" ? "blog" : 
    campaign?.target_channel === "youtube" ? "youtube" : 
    "social"
  }
  ...
/>
```

---

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Publicar sem revisão | Fluxo: suggested → approved → published |
| Gerar asset sem prompt | Sempre ter generation_prompt |
| Ignorar canal alvo | Respeitar target_channel da campanha |
| Misturar fluxos Blog/Mídias/YouTube | Usar `campaignType` para separar |
| Upload YouTube sem verificar créditos | Sempre verificar saldo antes |
| Usar fal.ai para vídeos | Usar pipeline OpenAI/Sora com QA |

---

## Checklist

- [x] Criar campanha com período
- [x] Gerar sugestões com IA
- [x] Calendário visual funciona
- [x] Edição inline de items
- [x] Fluxo separado Blog vs Mídias vs YouTube
- [x] Integração YouTube (OAuth + Upload)
- [x] Geração de vídeos IA (v2.0 pipeline)
- [ ] Geração de imagens
- [ ] Conexão com Late
- [ ] Publicação automática
