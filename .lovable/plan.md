
# Correcao Estrutural v5.11.0 — Pipeline de Criativos e Integridade Operacional

## Problema

O sistema de trafego IA tem 4 falhas estruturais confirmadas no codigo:

1. **Linha 2003**: `actionRecord.status = "executed"` e atribuido SEMPRE, mesmo sem `ad_id` ou `adset_id`
2. **Linhas 1926-1940**: Fallback cego `existingAds?.[0]?.creative_id` pega primeiro criativo aleatorio
3. **Linha 1910**: `platform_ad_id` recebe o ID do AdCreative (ambiguidade de nomenclatura)
4. **Sem persistencia**: `usedCreativeIds` e `mediaBlocked` existem apenas em memoria, resetando entre rounds

---

## FASE 1: Migracao SQL

### 1A. Novas colunas em `ads_creative_assets`

```sql
ALTER TABLE ads_creative_assets
  ADD COLUMN IF NOT EXISTS funnel_stage TEXT CHECK (funnel_stage IN ('tof','mof','bof','test','leads')),
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS platform_adcreative_id TEXT,
  ADD COLUMN IF NOT EXISTS expected_image_hash TEXT,
  ADD COLUMN IF NOT EXISTS expected_video_id TEXT;
```

### 1B. Novas colunas em `ads_autopilot_sessions`

```sql
ALTER TABLE ads_autopilot_sessions
  ADD COLUMN IF NOT EXISTS used_asset_ids JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS used_adcreative_ids JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS media_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS media_block_reason TEXT,
  ADD COLUMN IF NOT EXISTS strategy_run_id TEXT;
```

Duas listas separadas:
- `used_asset_ids`: UUIDs internos de `ads_creative_assets.id` (Nivel 1 ready)
- `used_adcreative_ids`: IDs Meta de AdCreative (Nivel 2 published)

---

## FASE 2: `ads-autopilot-analyze/index.ts` (v5.11.0)

### 2A. Helper `classifyCampaignFunnel(campaign)`

Classifica campanhas existentes na Meta por estagio de funil baseado no nome e objetivo. Enriquece cada campanha com `funnel_classification` antes de enviar ao prompt.

### 2B. Estado persistente (antes da linha 1426)

No inicio do loop de contas:
1. Carregar `used_asset_ids`, `used_adcreative_ids`, `media_blocked`, `strategy_run_id` da sessao
2. Inicializar `Set<string>` para cada lista
3. Se `strategy_run_id` nao existir, gerar e persistir
4. Se `media_blocked === true`, bloquear APENAS fluxo de upload/generate (Nivel 1)
5. Nivel 2 (published com `platform_adcreative_id`) continua funcionando com media_blocked

### 2C. Update atomico de listas

Apos cada uso de criativo, append atomico com dedup via SQL para evitar lost update e duplicatas em retries.

### 2D. Selecao deterministica (substitui linhas 1813-1940)

**Nivel 1 -- Assets IA `ready`:**
- `ads_creative_assets` com `status='ready'`, `product_id` match, `funnel_stage` compativel, `asset_url IS NOT NULL`
- **Filtro**: `id NOT IN used_asset_ids` (UUIDs de asset)
- Se `media_blocked === true`: pular Nivel 1 (depende de upload)
- Se encontrar: seguir fluxo upload -> AdCreative na Meta

**Nivel 2 -- Assets IA `published`:**
- `ads_creative_assets` com `status='published'`, `platform_adcreative_id IS NOT NULL`, `product_id` match, `funnel_stage` compativel
- **Filtro**: `platform_adcreative_id NOT IN used_adcreative_ids`
- **Funciona mesmo com `media_blocked=true`**

**Se nenhum compativel: NAO criar campanha.** Status = `pending_creatives` com motivo claro.

### 2E. Regra `creative_test`

Para campanhas de teste: buscar APENAS em `ads_creative_assets` com `session_id` igual ao da sessao atual. Se nao houver: status `pending_creatives`.

### 2F. Gravar `platform_adcreative_id` e `expected_image_hash` (linhas 1902-1912)

Ao criar AdCreative na Meta, gravar `platform_adcreative_id` (ID correto) e `expected_image_hash`. Para video, gravar `expected_video_id`.

### 2G. Pos-condicoes estritas (linhas 2003-2021)

Substituir `actionRecord.status = "executed"` fixo por logica condicional:

- campaign_id + adset_id + ad_id verificados via GET = "executed"
- campaign_id + adset_id sem ad_id (creative job) = "pending_creatives"
- campaign_id sem adset_id = "partial_failed"
- Nenhum ID = "failed"

### 2H. Validacao pos-criacao via Graph API GET

Apos criar ad, fazer GET para confirmar existencia e verificar midia:
- Imagem: `object_story_spec.link_data.image_hash`
- Video: `object_story_spec.video_data.video_id`
- Carousel: `child_attachments` ou `asset_feed_spec`

Comparar com `expected_image_hash`/`expected_video_id`. Se nao bater: `partial_failed`.

Salvar no `action_data`: `selected_asset_id`, `selected_platform_adcreative_id`, `funnel_stage`, `strategy_run_id`, `expected_*`, `graph_validation_result`.

### 2I. Idempotency key com batch_index (linha 1588)

```
action_hash = strategy_run_id + ad_account_id + action_type + product_id + funnel_stage + template + batch_index
```

`batch_index` e um contador sequencial por combinacao unica de (action_type + product_id + funnel_stage + template) no run. Tratar conflito UNIQUE como noop.

### 2J. Deteccao e bloqueio de erro de midia (linhas 1916-1918)

Ao detectar erro de upload: persistir `media_blocked = true` + razao no banco. Bloqueia Nivel 1 (upload) mas NAO Nivel 2 (published). Status: `blocked_media_permission`.

### 2K. System prompt (apos linha 1167)

Adicionar regras de criativos: unicidade por sessao, generate_creative antes de create_campaign, TOF nao serve para BOF e vice-versa, identificar funil antes de decidir.

---

## FASE 3: `ads-chat/index.ts`

### 3A. Propagar `funnel_stage` e `session_id` (funcao `generateCreativeImage`, linha 2006-2013)

Aceitar `funnel_stage` como argumento, normalizar para valores validos, gravar no body enviado ao `ads-autopilot-creative`.

### 3B. Selecao deterministica no `createMetaCampaign` (linhas 2065-2086)

Adicionar filtro por `funnel_stage` compativel e unicidade. Se nao houver criativo compativel: retornar erro claro.

### 3C. `strategy_run_id` no chat

Gerar no primeiro round, reutilizar em "continuar", propagar para funcoes de ferramenta.

---

## Secao Tecnica

### Arquivos Afetados

| Arquivo | Mudancas |
|---------|---------|
| Migracao SQL | Novas colunas em `ads_creative_assets` e `ads_autopilot_sessions` |
| `supabase/functions/ads-autopilot-analyze/index.ts` | Correcoes 2A-2K, VERSION v5.11.0 |
| `supabase/functions/ads-chat/index.ts` | Correcoes 3A-3C |

### Sequencia de Implementacao

1. Executar migracao SQL
2. Implementar `classifyCampaignFunnel()` e enriquecer contexto
3. Carregar/persistir estado da sessao (usedAssetIds, usedAdcreativeIds, mediaBlocked, strategyRunId)
4. Update atomico com dedup para ambas as listas
5. Substituir fallback cego por selecao deterministica (Nivel 1 ready + Nivel 2 published)
6. Gravar `platform_adcreative_id` e `expected_image_hash/video_id`
7. Regra creative_test por session_id exato
8. Pos-condicoes estritas (executed so com cadeia completa verificada)
9. Validacao Graph API GET com verificacao de midia
10. Idempotency com strategy_run_id + batch_index + UNIQUE noop
11. Deteccao/bloqueio seletivo de erro de midia (Nivel 1 only)
12. System prompt com regras de criativos
13. Propagar funnel_stage, session_id e strategy_run_id no ads-chat
14. Bump version e deploy

### Checklist de Aceite

- Nenhuma acao "executed" sem campaign_id + adset_id + ad_id verificados via GET
- Validacao Graph confirma image_hash OU video_id OU child_attachments
- creative_test sem criativos da sessao = pending_creatives
- Campanhas em lotes: nenhum creative repetido no mesmo run
- Erro de midia: Nivel 1 bloqueado, Nivel 2 (published) continua funcionando
- "Continuar" reutiliza strategy_run_id, used_asset_ids e used_adcreative_ids
- funnel_stage normalizado com CHECK constraint
- platform_adcreative_id separado de platform_ad_id
- Assets ready filtrados por used_asset_ids (UUID); published por used_adcreative_ids (Meta ID)
- Idempotencia com batch_index: >1 acao do mesmo produto+funil+template nao colide
- Logs incluem: selected_asset_id, selected_platform_adcreative_id, funnel_stage, strategy_run_id, expected_*, graph_validation_result
