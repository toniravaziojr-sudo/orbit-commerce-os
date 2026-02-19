

## Correcao Definitiva v5.12.8: Budget Guard com Reserva + Aprovacao Redesenhada

### Resumo do Problema

Dois bugs criticos identificados:

1. **Orcamento estoura**: O Budget Guard so soma campanhas ja publicadas na Meta. Propostas `pending_approval` nao sao contabilizadas, permitindo que 4 propostas simultaneas (ex: 2x R$300 + 2x R$75 = R$675) ultrapassem o limite de R$500/dia.

2. **Card de aprovacao tecnico**: A UI mostra "raciocinio", "confianca", "impacto esperado" e badges tecnicos. O `preview` (com `creative_url`, `headline`, `copy_text`, `targeting_summary`) ja existe no `action_data` mas nao e priorizado visualmente. Usuario nao tem base para aprovar.

---

### Plano de Implementacao (4 arquivos)

#### 1. Edge Function: `ads-autopilot-analyze/index.ts` (v5.12.8)

**1a. Budget Guard com Reserva** — Alterar `checkBudgetGuard` (linhas 354-389):
- Adicionar query para somar `action_data->>'daily_budget_cents'` de acoes `pending_approval` com `action_type = 'create_campaign'` e `channel = 'meta'` do mesmo `ad_account_id`
- Filtrar por TTL: ignorar propostas com `created_at < now() - 24h` (reserva expirada)
- Formula: `remaining = limit - active_meta - pending_reserved`
- Se `proposed > remaining`, rejeitar com mensagem clara incluindo breakdown (ativo/reservado/restante/limite)
- Retornar `budget_snapshot` com todos os valores para uso no preview

**1b. Deduplicacao por Funil** — Antes de inserir `pending_approval` (~linha 1971):
- Query: verificar se ja existe `pending_approval` para mesmo `(tenant_id, ad_account_id, funnel_stage)`
- Se existir: rejeitar com "Ja existe proposta pendente para este funil. Aprove ou rejeite a existente."
- Garante maximo 1 proposta pendente por funil por conta

**1c. Budget Snapshot no Preview** — Enriquecer `action_data.preview` (~linha 2031):
- Adicionar `budget_snapshot: { active_cents, pending_reserved_cents, remaining_cents, limit_cents }`
- Adicionar `product_price_display` formatado
- Adicionar `cta_type` de `args.cta`

#### 2. Edge Function: `ads-autopilot-execute-approved/index.ts` (v1.2.0)

**Revalidacao de Budget na Aprovacao**:
- Antes de invocar `ads-autopilot-analyze`, recalcular budget snapshot
- Excluir a propria acao do `pending_reserved` (ela esta saindo de reservado para ativo)
- Se `active + pending_reserved_excl_self + proposed > limit`, bloquear com erro legivel
- Retornar mensagem: "Aprovar esta campanha excederia o limite diario. Ajuste orcamento ou rejeite outra proposta."

#### 3. Frontend: `ActionApprovalCard.tsx` — Redesign completo

**Visivel por padrao:**
- Thumbnail do criativo (`preview.creative_url`) — skeleton se ausente
- Headline em destaque + copy (3-4 linhas) + CTA badge
- Produto (nome + preco)
- Chip de funil (Publico Frio / Remarketing / Teste)
- Publico resumido (`targeting_summary`)
- Barra de orcamento visual: Ativo (verde) | Reservado (amarelo) | Restante (cinza) | Limite
- Botoes: Aprovar / Ajustar / Rejeitar

**Oculto (Collapsible "Detalhes tecnicos"):**
- Confidence, reasoning, expected_impact
- Session ID, trigger type, tags internas, IDs, payloads

**Remover do layout principal:**
- Badge de confianca do header
- Bloco "Por que" (reasoning) como destaque — vai para detalhes
- "Impacto esperado" como destaque — vai para detalhes

#### 4. Frontend: `AdsPendingActionsTab.tsx` — Barra de orcamento global

- Adicionar no topo da lista um resumo de orcamento da conta:
  - "Ativo: R$X | Reservado: R$Y | Restante: R$Z | Limite: R$W/dia"
- Fonte: extrair `budget_snapshot` da primeira acao pendente (ja vem do backend)

---

### Detalhes Tecnicos

#### checkBudgetGuard atualizado (pseudo-codigo):

```text
async function checkBudgetGuard(supabase, tenantId, acctConfig, proposedBudgetCents, hasOverride):
  // 1. Campanhas ativas na Meta (como hoje)
  active_allocated = SUM(meta_ad_campaigns.daily_budget_cents WHERE [AI]% AND ACTIVE)
  
  // 2. NOVO: Propostas pendentes (excl. expiradas >24h)
  pending_reserved = SUM(ads_autopilot_actions.action_data->daily_budget_cents 
    WHERE status='pending_approval' AND action_type='create_campaign' 
    AND channel='meta' AND created_at > now()-24h)
  
  // 3. Calcular
  total = active_allocated + pending_reserved + proposedBudgetCents
  remaining = limit - active_allocated - pending_reserved
  
  // 4. Retornar snapshot
  return { allowed: total <= limit, budget_snapshot: { active_cents, pending_reserved_cents, remaining_cents, limit_cents } }
```

#### Layout do card redesenhado:

```text
+------------------------------------------+
| [THUMB]  Headline em negrito             |
|          Copy do anuncio (3 linhas)...   |
|          [CTA: Comprar Agora]            |
|                                          |
|  Produto: Nome — R$ 99,90               |
|  Funil: [Publico Frio]                  |
|  Publico: Broad, 18-65, Brasil          |
|                                          |
|  Orcamento: R$ 300/dia                  |
|  [====verde====][==amarelo==][cinza] R$500|
|  Ativo R$0 | Reservado R$375 | Rest R$125|
|                                          |
|  [Aprovar] [Ajustar] [Rejeitar]         |
|  > Detalhes tecnicos (colapsado)         |
+------------------------------------------+
```

### Sequencia de Implementacao

1. `ads-autopilot-analyze/index.ts` — Budget Guard + dedup + snapshot
2. `ads-autopilot-execute-approved/index.ts` — Revalidacao
3. `ActionApprovalCard.tsx` — Redesign visual
4. `AdsPendingActionsTab.tsx` — Barra de orcamento global
5. Deploy e teste

