---
name: Recent topics (auto rotativo + fixos manuais)
description: Cache de assuntos recentes. Regra híbrida — 2 slots automáticos rotativos + N slots fixos manuais (pinned). Não é fonte de verdade — só ponteiro para retomar trabalho.
type: reference
---

# Regra de operação

- **Slots automáticos:** guardo automaticamente os 2 últimos assuntos tratados. Quando entra um terceiro, o mais antigo desses dois é descartado (após auditoria pré-descarte conforme política da memória).
- **Slots fixos (📌 PINNED):** quando o usuário pedir explicitamente "guardar na memória recente", o assunto vira **fixo** e NUNCA é removido pela rotação. Só sai quando o usuário pedir explicitamente para remover.
- **Sem limite** para slots fixos — podem crescer indefinidamente.
- Slots fixos não contam para o limite de 2 automáticos.

---

# Assuntos recentes

## 📌 PINNED — Profile Enrichment Policy — ✅ VALIDADA E LIMPA + ⏳ pendente verificação de divergência real (2026-05-05)

**Status macro:**
- Implementação ✅ aplicada e validada em produção real (pedidos #410 e #411, Respeite o Homem): trigger `after_order_approved_sync` → `enrich_customer_from_order` populou CPF, nascimento, telefone, nome e bloco completo de endereço sem tocar em e-mail.
- Higiene ✅ aplicada: removido bloco "ENRICH" duplicado em `trg_recalc_customer_on_order`. Agora `enrich_customer_from_order` é fonte única de enriquecimento. Anti-regressão registrada em `mem://features/customers/profile-enrichment-policy-standard`.

**⏳ Pendente de validação observacional (aguardando pedido real com divergência):**
- #410 e #411 vieram 100% idênticos ao cadastro — não exercitaram o caminho de sobrescrita.
- Quando entrar um próximo pedido aprovado em `respeiteohomem` (ou qualquer tenant) com algum campo diferente do cadastro (CPF, telefone, nome, nascimento ou endereço), validar:
  1. Campos pessoais não-vazios do pedido SOBRESCREVERAM o cadastro (não preservaram o antigo).
  2. Se o pedido trouxe CEP, o bloco de endereço inteiro foi substituído (sem mistura CEP novo + bairro velho).
  3. E-mail permaneceu intocado.
- Expectativa confirmada com o usuário: o pedido mais novo é fonte de verdade — divergência = sobrescrita, sem alerta, sem histórico (limitação conhecida e aceita por enquanto).

**Próximo passo:** seguir com SendGrid. Verificação de divergência fica em standby até entrar pedido real elegível.

---

## 📌 PINNED — Motor Universal de Créditos — ROLLOUT EM ANDAMENTO (Lote 3 entregue 2026-05-06)

**Status macro:** Motor universal de cobrança real por consumo plugado em produção via 2 helpers padronizados:
- `_shared/credits/with-motor.ts` (`withCreditMotor`) — pré-pago síncrono (token-based ANTES da chamada).
- `_shared/credits/charge-after.ts` (`chargeAfter`) — pós-pago postpaid (reserve+capture imediato após operação concluída). Falha NUNCA bloqueia o fluxo.
- Flag por tenant: `tenant_credit_motor_config.motor_v2_enabled`. Tenant piloto: **respeite-o-homem**.
- Painel admin: `/platform/external-costs` → aba **Economia por tenant** (RPC `admin_tenant_economics` calcula custo provider vs receita créditos com margem).

**Lotes migrados (concluídos):**
1. **IA core:** `ai-generate-embedding`, `ai-product-description`, `generate-seo`, `ai-block-fill`, `ai-essential-pages`, `ai-landing-page-generate`.
2. **Ads:** `ads-autopilot-strategist`, `ads-autopilot-guardian`.
3. **Comunicação/E-mail:** `send-system-email`, `email-send`, `meta-whatsapp-send` (template marketing/utility/auth), `ai-support-transcribe` (Whisper por minuto).
4. **Fiscal completo:** `fiscal-emit` (só se autorizada), `fiscal-cancel`, `fiscal-cce`, `fiscal-inutilizar`, `fiscal-send-nfe-email`, `fiscal-check-status`, `fiscal-sync-focus-nfe`.
5. **Scrape:** `firecrawl-scrape` (com `tenant_id` no body via `GuidedImportWizard.tsx`).
6. **Lote 3 (último — 2026-05-06):**
   - `ai-support-chat`: cobrança POR TURNO em tokens reais OpenAI (input + output separados, jobId `${newMessage.id}:in/out`).
   - `creative-video-generate`: cobrança por segundo do tier (`premium`→`fal.kling-video.per_second.pro`, `audio_native`→`fal.veo-3.1.per_second.standard.audio`, default→`fal.veo-3.1.per_second.fast.noaudio`).
   - `ai-page-architect`: contrato passou a aceitar `tenantId` no body; cobra Gemini Flash (`gemini.gemini-2.5-flash.per_1m_tokens_in/out`). Callers atualizados: `src/pages/Pages.tsx` e `src/components/builder/HomeStructureDialog.tsx` (este último ganhou `useAuth().currentTenant`).

**Próximo lote (retomar daqui):**
- `creative-image-generate` — já tem motor v2 LIVE validado em A3.3 (ledger v2 ativo via `_shared/credits/live-v2.ts`); avaliar migração para padrão `chargeAfter` e remover hardcodes residuais.
- `ads-autopilot-creative-generate` — cobrança por imagem/variação gerada.
- Restantes de mídia: `media-generate-video`, `media-video-generate`, `creative-generate`, `creative-process`, `meta-ads-creatives`.

**Decisões pendentes do usuário (NÃO assumir):**
- Quais planos (Gratuito/Básico/Médio/Completo) terão acesso a quais features e quantos créditos bônus mensais cada plano recebe.
- Compra de créditos extras = soma ao saldo atual do tenant ✅ confirmado conceitualmente.

**Restrições ativas (NÃO violar ao retomar):**
- Não ativar `motor_v2_enabled` em tenant que não seja o piloto sem autorização explícita.
- Não alterar `service_pricing` sem aprovação.
- Não criar trigger `on_tenant_created` nem fazer backfill de wallet em tenants legados.
- Falhas de cobrança continuam não bloqueantes — manter padrão `chargeAfter` postpaid como default.

**Memória técnica detalhada:** `mem://features/platform/motor-universal-creditos-rollout`.

**Docs fonte de verdade:**
- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/catalogo-precos-creditos.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`
- `docs/especificacoes/sistema/ux-creditos-lojista.md`

---

## 📌 PINNED — IA de Atendimento — AI Provider Routing (PAUSADO, aguardando OpenAI quota)

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
