# Memory: features/ai/creative-sourcing-fallback-priority-v5-2
Updated: now

O pipeline de geração de criativos (v2.0.0 do ads-autopilot-creative) implementa um sistema **DRIVE-FIRST** para garantir reaproveitamento máximo de ativos existentes:

### Pipeline de Prioridade (v2.0.0 — DRIVE-FIRST)
1. **Busca no Drive** (pasta "Gestor de Tráfego IA") → filtra por `product_id` no metadata, prioriza `is_winner: true` e maior `scores.overall`
2. **Se encontrar** → Reutiliza diretamente, marca asset como `ready` com `image_status: 'reused_drive'`, retorna `reused: true`. **Zero custo de IA.**
3. **Se NÃO encontrar** → Chama `creative-image-generate` para gerar novos criativos via IA
4. **Fallback no creative-image-generate**: Se IA falhar → busca Drive novamente → fallback para imagem do catálogo

### Metadados de Rastreamento
- `image_status: 'reused_drive'` — Criativo reutilizado do Drive (sem geração)
- `image_status: 'fallback_drive'` — Criativo do Drive usado após falha de IA
- `image_status: 'fallback_catalog'` — Imagem do catálogo (último recurso)
- `image_status: 'completed'` — Gerado via IA com sucesso

### Arquivos Relacionados
- `supabase/functions/ads-autopilot-creative/index.ts` — v2.0.0 (Drive-first search)
- `supabase/functions/creative-image-generate/index.ts` — v5.2.0 (Drive fallback after AI failure)

### Checklist Anti-Regressão
- [ ] `ads-autopilot-creative` busca no Drive ANTES de chamar `creative-image-generate`
- [ ] Criativos do Drive são marcados com `reused: true` e `image_status: 'reused_drive'`
- [ ] `creative-image-generate` mantém fallback Drive para quando IA falha
- [ ] Fallback para catálogo funciona quando Drive e provedores falham
