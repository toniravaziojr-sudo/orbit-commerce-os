
# v5.11.2 — Pipeline Orientado a Processo + Integridade Operacional

## Status: ✅ IMPLEMENTADO E DEPLOYED

## Mudanças Realizadas

### 1. Migração SQL — `ads_autopilot_artifacts` ✅
- Tabela criada com campos: tenant_id, campaign_key, artifact_type, data (JSONB), status
- Índices: tenant+run, tenant+key, tenant+type
- Unique constraint para UPSERT: (tenant_id, campaign_key, artifact_type)
- RLS habilitado com policy service_role

### 2. `ads-autopilot-creative` v1.2.1 → v1.3.0 ✅
- Aceita `funnel_stage` e `strategy_run_id` no body
- INSERT em `ads_creative_assets` ANTES de invocar `creative-image-generate` (status=generating)
- Usa `meta.image_job_id` (key correta para match no creative-image-generate)
- Marca asset como `failed` se invoke falhar ou success=false
- Retorna `asset_id` no response

### 3. `ads-autopilot-analyze` v5.11.1 → v5.11.2 ✅
- **PAUSED-first**: Campaigns e adsets SEMPRE criados como PAUSED
- **Ativação pós-validação**: Só promove para ACTIVE+start_time após ad criado e Graph validado
- **Rollback defensivo**: Se campaign criada mas sem ad, pausa automaticamente e grava rollback_data
- **Produto por funil** (genérico): TOF=menor preço, BOF/MOF=maior preço, tanto em create_campaign quanto generate_creative
- **Artefatos persistidos**: strategy, copy, campaign_plan salvos em ads_autopilot_artifacts por campaign_key
- **config_snapshot**: budget_cents, funnel_splits, strategy_mode, human_approval_mode gravados no action_data
- **Insights legíveis**: Prompt atualizado (max 4 frases, sem IDs, R$) + sanitização server-side (regex para IDs longos, limite 500 chars)
- **Regra de produto por funil no prompt**: Genérica, sem hardcode de loja

### 4. `ads-chat` v5.11.0 → v5.11.2 ✅
- Debug log no início do handler (method + url)
- Redeploy forçado para resolver "Failed to fetch"

## Pendente (pós-deploy)
- [ ] Pausar campanhas órfãs: 120241927804640057, 120241927806510057
- [ ] Rodar queries de aceite após 1-2 ciclos reais
- [ ] Implementar user_command artifacts no ads-chat (Parte 4 do plano - prioridade do usuário via chat)

## Queries de Aceite

Aceite 1: Zero campanhas órfãs ACTIVE
Aceite 2: Assets com image_job_id evoluindo (generating → ready)
Aceite 3: Produto de entrada no TOF / kits no BOF
Aceite 4: Executed real (cadeia completa com todos IDs)
Aceite 5: Artefatos persistidos por campaign_key
