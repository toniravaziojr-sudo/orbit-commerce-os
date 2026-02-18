

# Pipeline Orientado a Processo v5.12.4 — Correcao Completa + Guards Programaticos

## Resumo Executivo

Reestruturacao do Autopilot para implementar um pipeline de processo obrigatorio com 7 guards programaticos que impedem publicacao sem validacao completa. Corrige as 7 regressoes identificadas: publicacao sem aprovacao, estouro de orcamento, produto errado, publicos zerados, copys inexistentes, sessoes duplicadas e configs ignoradas.

## Diagnostico Atual vs Objetivo

| Problema | Estado Atual | Estado Alvo |
|---|---|---|
| Publicacao sem aprovacao | `human_approval_mode=auto` executa tudo | `first_activation` SEMPRE pede aprovacao |
| Budget estourado | Sem validacao de total alocado | Budget Guard: soma total antes de criar |
| Produto errado (TOF) | Heuristica generica de menor preco | Priority products do `user_instructions` |
| Publicos zerados | Fallback broad sem validacao | Remarketing OBRIGA Custom Audience |
| Copys genericas | Fallback `Conheca X!` aceito | Copy Guard: rejeita fallback |
| Sessoes duplicadas | Sem lock por conta | Lock por `ad_account_id` |
| Configs ignoradas | Configs sao contexto informativo | Hard gates programaticos |

---

## Parte A — Schema (Migracao SQL)

A tabela `ads_autopilot_artifacts` ja existe com a constraint UNIQUE correta `(tenant_id, campaign_key, artifact_type)`. Nao precisa de migracao de schema.

Adicionar coluna `lock_session_id` e `lock_expires_at` na tabela `ads_autopilot_account_configs` (se nao existirem) para lock por conta:

```sql
ALTER TABLE ads_autopilot_account_configs
  ADD COLUMN IF NOT EXISTS lock_session_id TEXT,
  ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;
```

---

## Parte B — `ads-autopilot-analyze` (v5.12.3 para v5.12.4)

Arquivo: `supabase/functions/ads-autopilot-analyze/index.ts` (~2762 linhas)

### B1. Lock por Conta (Anti-Concorrencia)

**Onde:** Dentro do loop `for (const acctConfig of runnableAccounts)` (linha ~1583)

**Mudanca:** Antes de iniciar analise de cada conta, adquirir lock na tabela `ads_autopilot_account_configs` via `lock_session_id`. Se ja locked por outra sessao recente (< 10 min), pular esta conta com log. Liberar no finally.

```text
Fluxo:
1. SELECT lock_session_id, lock_expires_at FROM ads_autopilot_account_configs WHERE id = acctConfig.id
2. Se locked e nao expirado -> skip conta
3. UPDATE lock_session_id = sessionId, lock_expires_at = now + 10min
4. ... executar analise ...
5. FINALLY: UPDATE lock_session_id = null WHERE lock_session_id = sessionId
```

### B2. Budget Guard (Antes de Criar Campanha)

**Onde:** Dentro do bloco `create_campaign` (linha ~1844), ANTES de chamar `meta-ads-campaigns`

**Mudanca:** Nova funcao `checkBudgetGuard(supabase, tenantId, acctConfig, proposedBudgetCents)`:

1. Buscar TODAS campanhas Meta da conta com status IN ('ACTIVE', 'PAUSED') criadas pela IA (nome comeca com `[AI]`)
2. Somar `daily_budget_cents` de todas + o `proposedBudgetCents`
3. Se total > `acctConfig.budget_cents`:
   - Se nao ha user_command confirmed com override: `status = "rejected"`, motivo = "Orcamento total (R$ X) excederia limite de R$ Y"
   - Se ha override confirmado: permitir, registrar `override=true` no action_data
4. Retornar `{ allowed: boolean, total_allocated: number, limit: number }`

### B3. First Activation = Approval Obrigatorio

**Onde:** Bloco de `human_approval_mode` (linha ~1799-1807)

**Mudanca:** Adicionar regra:
```
if (trigger_type === "first_activation" && isCreateAction) {
  needsApproval = true; // SEMPRE, independente do human_approval_mode
}
```

Isso garante que a primeira ativacao NUNCA auto-execute campanhas novas.

### B4. Targeting Guard (Remarketing sem Custom Audience)

**Onde:** Apos construir `targeting` no bloco create_campaign (linha ~1903-1950)

**Mudanca:** Nova validacao ANTES de criar adset:
```
if (campaignFunnel === "bof" || args.template === "remarketing") {
  if (!targeting.custom_audiences || targeting.custom_audiences.length === 0) {
    actionRecord.status = "rejected";
    actionRecord.rejection_reason = "Remarketing requer Custom Audience. Nenhum publico encontrado.";
    // Skip campaign creation entirely
  }
}
```

Para TOF sem interesses E sem Lookalike:
```
if (campaignFunnel === "tof" && !targeting.custom_audiences && !targeting.flexible_spec) {
  // Enviar para pending_approval com instrucao para definir targeting
  actionRecord.status = "pending_approval";
  actionRecord.rejection_reason = "TOF sem interesses nem Lookalike. Defina targeting.";
}
```

### B5. Copy Guard (Antes de Criar Ad)

**Onde:** Bloco de criacao de Ad (linha ~2128-2158), antes de montar `linkData`

**Mudanca:**
```
const copyText = aiAsset?.copy_text;
const headline = aiAsset?.headline;
const isFallbackCopy = !copyText || copyText.startsWith("Conheca ") || copyText.length < 20;
const isFallbackHeadline = !headline;

if (isFallbackCopy || isFallbackHeadline) {
  // NAO criar ad, marcar como pending_copy
  actionRecord.status = "pending_creatives";
  actionRecord.error_message = "Copy ou headline ausente/generica. Gerar copy antes de publicar.";
  // Rollback campaign+adset
}
```

### B6. Regex de Variantes Corrigido

**Onde:** `selectFocusProducts` (linha ~315)

**Mudanca:** Corrigir regex para capturar parenteses:
```
const variantPatterns = /\s*\(\d+x\)|\s*\(FLEX\)|\s*\(Dia\)|\s*\(Noite\)|\s+Dia$|\s+Noite$|\s+dia$|\s+noite$/i;
```

### B7. Priority Products do user_instructions

**Onde:** Funcao `selectFocusProducts` e seu uso (linhas ~311-336 e ~2020-2029)

**Mudanca:** Nova funcao `extractPriorityProducts(userInstructions, products)`:

1. Parsear `user_instructions` buscando nomes de produtos mencionados
2. Para cada produto do catalogo, verificar se o nome aparece no texto (case-insensitive, fuzzy match simples)
3. Retornar lista de `priority_products` com o contexto (TOF/BOF/etc se mencionado)

Na selecao de produto para campanha (linha ~2020):
```
// Se user_instructions menciona produtos prioritarios, usar eles primeiro
const priorityProducts = extractPriorityProducts(acctConfig.user_instructions, context.products);
if (priorityProducts.length > 0 && (campaignFunnel === "tof" || campaignFunnel === "cold")) {
  topProduct = priorityProducts[0];
} else {
  // Fallback para heuristica de preco
  topProduct = focus.tof[0];
}
```

### B8. Artifacts Gate (Validacao Completa Antes de Publicar)

**Onde:** ANTES da ativacao (linha ~2348)

**Mudanca:** Verificar que existem artifacts `strategy`, `copy`, `creative_prompt` e `campaign_plan` com status `ready` para o `campaign_key`. Se algum estiver faltando, nao ativar.

### B9. Auto Mode Nao Bypassa Guards

**Onde:** Linha ~1806-1807

**Mudanca:** Remover comentario que diz "auto = nothing needs approval". Auto AINDA respeita todos os guards (budget, targeting, copy). A unica diferenca e que acoes validadas sao executadas sem ir para `pending_approval`.

---

## Parte C — `ads-autopilot-creative` (v1.3.0 para v1.4.0)

Arquivo: `supabase/functions/ads-autopilot-creative/index.ts` (~298 linhas)

### C1. Aceitar Copy e Creative Prompt como Input

**Mudanca:** Novos campos no body:
- `copy_text`, `headline`, `description`, `cta` (da etapa de copy)
- `creative_prompt` (da etapa de creative_prompt)

Gravar estes campos no asset ao criar:
```
const { data: newAsset } = await supabase.from("ads_creative_assets").insert({
  ...existing,
  copy_text: body.copy_text || null,
  headline: body.headline || null,
  cta_type: body.cta || null,
  meta: { ...assetMeta, creative_prompt_ref: body.creative_prompt || null, copy_ref: body.copy_text ? "inline" : null },
});
```

### C2. Garantir image_job_id no Asset

Ja implementado em v1.3.0 — manter.

---

## Parte D — `ads-chat` (v5.11.4 para v5.12.4)

Arquivo: `supabase/functions/ads-chat/index.ts` (~3557 linhas)

### D1. User Command Override Completo

As tools `persist_user_command` e `confirm_user_command` ja existem (linhas 552-587, 681-686). O que falta:

1. **No `ads-autopilot-analyze`:** Ao iniciar analise, buscar user_commands `confirmed` para o tenant/account e injeta-los no contexto da IA como overrides
2. **No budget guard:** Se existe user_command confirmed com `budget_override=true`, permitir ultrapassar limite registrando override
3. **No targeting guard:** Se existe user_command confirmed aceitando broad targeting, permitir

### D2. System Prompt Update

Reforcar no system prompt do chat que:
- Ao receber ordem do usuario, SEMPRE usar `persist_user_command`
- Se detectar conflito, usar `requires_confirmation: true`
- Apos confirmacao, executar sem bloqueios mas com registro

---

## Parte E — Documentacao

Arquivo: `docs/regras/edge-functions.md`

Registrar:
- v5.12.4 do analyze com os 7 guards
- v1.4.0 do creative com copy/prompt input
- v5.12.4 do ads-chat com user_command integrado

---

## Sequencia de Implementacao

1. Migracao SQL (adicionar lock columns na account_configs)
2. `ads-autopilot-analyze` v5.12.4 (guards + lock + priority products + regex fix)
3. `ads-autopilot-creative` v1.4.0 (copy/prompt input)
4. `ads-chat` v5.12.4 (user_command integration no system prompt)
5. Documentacao
6. Deploy de todas as functions
7. Queries de aceite

## Queries de Aceite (Pos-Deploy)

```sql
-- 1. Zero campanhas orfas ACTIVE sem ads
SELECT c.meta_campaign_id, c.name, c.status
FROM meta_ad_campaigns c
WHERE c.name LIKE '[AI]%' AND c.status = 'ACTIVE'
AND NOT EXISTS (SELECT 1 FROM meta_ad_ads a WHERE a.meta_campaign_id = c.meta_campaign_id);

-- 2. Budget guard: total alocado vs config
SELECT ac.ad_account_id, ac.budget_cents as config_limit,
  SUM(c.daily_budget_cents) as total_allocated
FROM ads_autopilot_account_configs ac
JOIN meta_ad_campaigns c ON c.ad_account_id = ac.ad_account_id
  AND c.status IN ('ACTIVE', 'PAUSED') AND c.name LIKE '[AI]%'
WHERE ac.tenant_id = ac.tenant_id
GROUP BY ac.ad_account_id, ac.budget_cents
HAVING SUM(c.daily_budget_cents) > ac.budget_cents;

-- 3. Nenhum ad com copy fallback
SELECT a.id, a.action_data->>'copy_text' as copy
FROM ads_autopilot_actions a
WHERE a.action_type = 'create_campaign' AND a.status = 'executed'
AND (a.action_data->>'copy_text' IS NULL OR a.action_data->>'copy_text' LIKE 'Conheca%');

-- 4. Remarketing sem custom audience
SELECT a.id, a.action_data->>'funnel_stage' as funnel, a.status
FROM ads_autopilot_actions a
WHERE a.action_type = 'create_campaign'
AND a.action_data->>'template' = 'remarketing'
AND a.status = 'executed'
AND (a.action_data->'targeting'->>'custom_audiences') IS NULL;

-- 5. Artefatos completos para campanhas publicadas
SELECT a.campaign_key,
  COUNT(*) FILTER (WHERE a.artifact_type = 'strategy' AND a.status = 'ready') as strategy,
  COUNT(*) FILTER (WHERE a.artifact_type = 'copy' AND a.status = 'ready') as copy,
  COUNT(*) FILTER (WHERE a.artifact_type = 'campaign_plan' AND a.status = 'ready') as plan
FROM ads_autopilot_artifacts a
GROUP BY a.campaign_key
HAVING COUNT(*) FILTER (WHERE a.artifact_type = 'strategy' AND a.status = 'ready') = 0
   OR COUNT(*) FILTER (WHERE a.artifact_type = 'copy' AND a.status = 'ready') = 0;

-- 6. User commands com override registrado
SELECT campaign_key, status, data->>'detected_conflicts' as conflicts,
  data->>'override' as override_registered
FROM ads_autopilot_artifacts
WHERE artifact_type = 'user_command'
ORDER BY created_at DESC LIMIT 20;
```

## Como Testar Manualmente

1. Ativar IA em uma conta → verificar que campanhas vao para `pending_approval` (nao auto-executa)
2. Aprovar campanha → verificar que ela e criada PAUSED com copy, targeting e budget corretos
3. Via chat: "Crie uma campanha de remarketing com R$1000/dia" → verificar conflito detectado e `awaiting_confirmation`
4. Confirmar → verificar execucao com `override=true` registrado
5. Rodar queries de aceite acima → todas devem retornar 0 linhas

