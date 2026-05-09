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

---

## 🟢 AUTO — F2 Motor de Créditos / platform_cost_ledger — F2.6 GO (07/05/2026)

**Onde paramos exatamente:**
- F2.5 `send-system-email` ✅ GO (2 envios reais SendGrid validados em 07/05).
- F2.6 `command-insights-generate` v1.1.0 ✅ GO funcional final em 07/05/2026.
  - Validação real ponta a ponta no tenant **Respeite o Homem** (`d1a4d0ed-8842-495e-b741-540a9a345b25`).
  - 4 insights gerados, 564 tokens_in / 313 tokens_out / 0 cached, `cost_usd=0.00095170`, `cost_brl=0.0052`.
  - Linha real `platform_cost_ledger.id=4f496e29-af52-430b-a64c-2cad148ff69c`, `service_key=command-insights-generate`, `category=ai_text`.
  - Idempotência confirmada: 2ª chamada bloqueada antes do Gemini, sem 2ª linha.
  - Tenant não cobrado: `credit_wallet`, `credit_ledger`, `service_usage_events` intactos.
  - `/platform/credits` enxerga; `/platform/external-costs` íntegro.
- `ai-learning-aggregator` reclassificado como **não aplicável** (sem provider externo).
- Doc atualizado: seção 13 "Evidência F2.6 — 2026-05-07" em `docs/especificacoes/plataforma/motor-creditos-fase-f2-platform-cost-ledger.md`.

**Achados paralelos pendentes (NÃO corrigir sem autorização):**
- Cron `generate-weekly-insights`: anon key vs service-role → cai em Manual call → 401 silencioso. Refatorar a edge (não o cron).
- `get_auth_user_email`: `permission denied` na tela `/platform/emails` (Templates). Task `b70aa82b`.

**Próximo passo combinado:** abrir **F2.7 em modo PLANNER** (somente diagnóstico). Mapear próxima edge candidata a `recordPlatformCost` (`cost_owner=platform`, provider externo, ainda não plugada).

**Restrições ativas:**
- Toda nova fase começa em PLANNER; só executa após GO explícito.
- Validação real sempre em 1 tenant.
- Não apagar linhas reais de `platform_cost_ledger`.
- Não corrigir cron nem `get_auth_user_email` sem autorização.

**Docs fonte de verdade:**
- `docs/especificacoes/plataforma/motor-creditos-fase-f2-platform-cost-ledger.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`

**Código:**
- `supabase/functions/command-insights-generate/index.ts` (v1.1.0)
- `supabase/functions/_shared/credits/charge.ts` → `recordPlatformCost`

---

## 🟢 AUTO — Edge HTML First-Touch Attribution + Fiscal CNPJ Swap (2026-05-09)

**Onde paramos exatamente:**
- Diagnóstico dos 4 pedidos do tenant Respeite o Homem: todos com `attribution_source=unknown`, `landing_page=/checkout`, referrer same-domain, UTMs/click IDs vazios — primeiro toque perdido.
- **Causa raiz:** Edge HTML (Content-First) renderiza home/categoria/produto/carrinho sem React; o hook `useAttribution` só rodava em `/checkout`, sobrescrevendo tudo com landing=`/checkout`.
- **Correção aplicada e deployed:**
  1. `supabase/functions/storefront-html/index.ts` → bloco "FIRST-TOUCH ATTRIBUTION CAPTURE (Edge HTML)" injetado em `generateMarketingPixelScripts` (script inline + cookie `_sf_attr` 90d, pula rotas checkout-like).
  2. `src/hooks/useAttribution.ts` → React agora só lê e só atualiza com novo click ID/UTM; nunca sobrescreve com `/checkout`.
  3. Anti-regressão: `mem://constraints/edge-html-attribution-capture`.
  4. Doc atualizado: `docs/especificacoes/marketing/marketing-integracoes.md` seção "Captura de First-Touch (Edge HTML — obrigatório)".
- **Validação observacional pendente:** novo pedido entrando via `?utm_source=google&gclid=TEST123` (ou tráfego real de Ads) deve mostrar em `order_attribution`: `gclid` preenchido, `landing_page` ≠ `/checkout`, `attribution_source=google_ads`.

**Assunto anterior do mesmo loop (Fiscal CNPJ swap):**
- Constraint criada: `mem://constraints/fiscal-cnpj-swap-and-focus-link-cleanup` — ao trocar CNPJ do emitente, edges `fiscal-upload-certificate`, `fiscal-remove-certificate`, `fiscal-emit`, `fiscal-submit` devem limpar vínculo Focus NFe órfão. Doc `docs/especificacoes/erp/erp-fiscal.md` atualizado.

**Restrições ativas:**
- Não tocar em `checkout-create-order` (já lê `order_attribution` corretamente do payload).
- Não fazer backfill nos 4 pedidos antigos (atribuição perdida — só novos pedidos serão corretos).
- Não remover o `if (isCheckoutLike) return null` do `useAttribution` (poluiria first-touch).

**Próximo passo:** aguardar novo pedido real do Respeite o Homem para validar observacionalmente o `order_attribution` populado.
