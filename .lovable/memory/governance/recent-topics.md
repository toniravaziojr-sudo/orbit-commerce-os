---
name: Recent topics (rotativo, máx 2)
description: Cache rotativo dos 2 últimos assuntos tratados. Não é fonte de verdade — só ponteiro para retomar trabalho.
type: reference
---

# Assuntos recentes (rotativo)

## 1) Motor Universal de Créditos — Fase 3 shadow mode youtube-upload (EM ANDAMENTO, aguardando conexão YouTube real)

**Status macro:**
- Fase 0 (documental) ✅ aprovada.
- Fase 1 (fundação) ✅ executada e validada.
- Fase 2A (motor v2) ✅ executada e validada.
- Fase 2B (catálogo + UI admin de preços/custos) ✅ executada e validada.
- Fase 3 (primeiro plug em shadow): youtube-upload **plugado em shadow mode v2**, v1 segue como única cobrança real. Aguardando 1 upload piloto + 1 upload não-piloto para iniciar janela de observação de 7 dias.

**O que já foi feito na Fase 3:**
- youtube-upload instrumentado em shadow mode: registra `service_usage_events` com `motor_version=v2`, `mode=shadow`, `pricing_model=fixed_credits`, `v1_credits`, `v2_credits_estimated`, `delta_abs`, `delta_pct`, `divergence_alert`, `idempotency_key`. v2 NÃO escreve em `credit_ledger` nem debita `credit_wallet`.
- Tenant piloto **Respeite o Homem** (`d1a4d0ed-8842-495e-b741-540a9a345b25`) configurado em `tenant_credit_motor_config`: `motor_v2_enabled=false`, `shadow_service_keys=['platform.youtube_upload']`, `live_service_keys=[]`, `live_categories=[]`.
- Auditoria de `credit_wallet` revelou gap estrutural: **5 tenants legados sem carteira** (piloto + 4 outros), criados antes do auto-provisionamento via `start-create-basic-account`. Não existe trigger `on_tenant_created`.
- **Carteira de teste provisionada** para o piloto: `balance_credits=500`, `reserved_credits=0`, `lifetime_purchased=0`, `lifetime_consumed=0`. Linha em `credit_ledger`: `transaction_type=adjust`, `credits_delta=+500`, `metadata.not_customer_purchase=true`, `metadata.technical_test_balance=true`, `reason=phase_3_shadow_validation` (NÃO é receita).
- Validações READ-ONLY OK: snapshot pré-upload limpo (0 eventos shadow), config motor intacta, RLS em `service_pricing` confirmado (tenant não lê `cost_usd`/markup/margin).

**Onde paramos exatamente (bloqueio atual):**
- Query de tenants com YouTube conectado retornou **0** em produção (nem `youtube_connections` legado nem `google_connections` com scope `youtube`). Nenhum upload pode ser executado ainda.
- Recomendação atual: **NO-GO** para iniciar janela de 7 dias até existir 1 upload piloto + 1 upload não-piloto validados.

**O que falta fazer (próximos passos combinados):**
1. Usuário conecta YouTube no tenant piloto (Respeite o Homem) via OAuth. Pode exigir cadastro como Test User no Consent Screen (modo Testing) ou ativar `billing_feature_flags.youtube_enabled_for_all_tenants`.
2. Usuário conecta YouTube em 1 tenant não-piloto com wallet ≥ 20 créditos e SEM `platform.youtube_upload` em `shadow_service_keys`.
3. Executar 1 upload curto (≤30s, vídeo privado) em cada tenant; registrar UTC + VideoId/JobId.
4. Lovable roda Validações B/C/D/E/F:
   - B: `service_usage_events` no piloto = 1 evento shadow com campos esperados, sem linha v2 em `credit_ledger`, débito v1 normal em `credit_wallet`.
   - C: `service_usage_events` no não-piloto = 0 eventos shadow.
   - D: idempotência (re-execução com mesmo `videoId`/`jobId` não duplica).
   - E: logs `[shadow-v2]` presentes em youtube-upload.
   - F: nenhum `cost_usd`/markup vazado para o tenant.
5. Se OK → **iniciar janela de observação de 7 dias** com query diária agregando delta_pct, divergence_alert, shadow_error.
6. Após 7 dias estáveis → planejar próximo plug (futuras funções pagas, ainda em shadow), só depois cutover gradual para live.

**Restrições ativas (NÃO violar ao retomar):**
- Não ativar live (`motor_v2_enabled` segue `false`).
- Não fazer cutover.
- Não plugar outras funções pagas em shadow ainda.
- Não alterar pacotes de crédito.
- Não expor custo real (USD/markup/margem) para tenant.
- Não alterar cobrança v1.
- Não criar trigger `on_tenant_created` nem fazer backfill de wallet dos 4 tenants legados restantes nesta fase (gap estrutural documentado, fica para fase própria).

**Gaps documentais pendentes:**
- `docs/especificacoes/sistema/ux-creditos-lojista.md` deve registrar o gap estrutural de `credit_wallet` em tenants legados e a pendência de trigger + backfill (fase própria, fora da Fase 3).

**Docs fonte de verdade:**
- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/catalogo-precos-creditos.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`
- `docs/especificacoes/sistema/ux-creditos-lojista.md`

**Arquivos tocados na Fase 3 até aqui:**
- `supabase/functions/youtube-upload/index.ts` (instrumentação shadow).
- 2 migrations Fase 3 (config motor piloto + provisionamento wallet de teste).
- `src/integrations/supabase/types.ts` (regen automático).
- Docs acima.

---

## 2) IA de Atendimento — AI Provider Routing (PAUSADO, aguardando OpenAI quota)

**Onde paramos exatamente:**
- Fase 1 (TPR via ai-router com Gemini Native primário, OpenAI Native, Lovable Gateway só fallback) ✅ FECHADA e validada (smoke test 2026-05-04, `provider=gemini` real).
- Fase 1.1 (observabilidade resiliente do TPR) ✅ FECHADA. `ai_support_turn_log.metadata.tpr` é fonte canônica de auditoria; `metadata.composer_error` sanitizado é persistido mesmo quando o composer falha.
- **Bloqueio atual:** `OPENAI_API_KEY` retornando `insufficient_quota` (HTTP 429) no composer principal. Validação observacional dos 5–10 turnos não pode rodar até a chave/saldo ser regularizado.
- **Próximo passo combinado:** usuário regulariza `OPENAI_API_KEY`, manda "Oi" na IA Teste, Lovable roda query de validação do caminho de sucesso. Após sucesso, liberar validação observacional de 5–10 turnos reais.

**Restrições ativas (NÃO violar ao retomar):**
- Não iniciar Fase 2.
- Não migrar composer para ai-router.
- Não alterar chamadas OpenAI diretas do composer/ai-support-chat.
- Não mexer em Catalog Probe / search_products / Orchestrator.
- Não promover Onda 1C para `active` (segue `dry_run`).
- Não alterar prompt nem UI.

**Fonte de verdade documental:** `docs/especificacoes/ia/ai-provider-routing.md` + `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (Reg #27).

**Memórias técnicas relacionadas:** `infrastructure/ai/provider-router-standard`, `constraints/sales-pipeline-tpr-and-output-gates`.
