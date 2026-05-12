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

## 🟢 AUTO — WhatsApp Inbound PII + HMAC SHA-256 (F2.13.2.C-CODE GO + F2.13.3-CODE Fase A em log) — 2026-05-11

**Onde paramos exatamente:**

- **F2.13.2.C-CODE ✅ GO operacional (11/05/2026 20:52Z).**
  - `meta-whatsapp-webhook` agora grava `raw_payload = NULL` em novos inbounds de `whatsapp_inbound_messages`. Colunas estruturadas (from_phone, to_phone, message_type, message_content, external_message_id, timestamp, processing_status) seguem íntegras.
  - Validado com inbound real do número 5573998034875 (não-Agenda) durante janela controlada com IA do tenant Respeite o Homem temporariamente desligada (`is_enabled=false` por ~9 min, restaurada para `true` em 20:52:40Z; `sales_mode_enabled` intacto).
  - Sem acionamento de Agenda, AI Support, IA, cobrança ou outros tenants.
  - Cron `cleanup_whatsapp_inbound_raw_payload_30d` mantido como rede de segurança para registros antigos.

- **F2.13.3-CODE Fase A ✅ GO em modo LOG (11/05/2026).**
  - HMAC SHA-256 de `x-hub-signature-256` validado contra `META_APP_SECRET` (lido de `platform_credentials`) sobre `rawBodyText` já capturado antes do `req.json()`.
  - Comparação timing-safe via Web Crypto. **Nenhuma rejeição** nesta fase: log apenas (`hmac_status` ∈ valid|invalid|missing|malformed|secret_missing), apenas `sig_prefix` (8 chars) é logado — nunca a assinatura completa nem o secret.
  - GET handshake (`hub.verify_token`) já era validado antes — sem alteração.
  - Testes sintéticos Deno (7 cenários) ✅. Logs reais em produção mostraram `hmac_status=missing` e `hmac_status=invalid` corretamente, sem quebrar fluxo.
  - Docs atualizados: `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` §9 e `docs/especificacoes/transversais/politica-pii-logs.md` §11.

**Próximo passo combinado (retomar daqui em alguns dias):**
- Aguardar **janela observacional de 72h** em modo log para confirmar zero falsos negativos (todo inbound legítimo da Meta com `hmac_status=valid`).
- Após janela limpa, abrir **F2.13.3-B em PLANNER** para mover de log-mode para enforcement (rejeitar com 401 quando `hmac_status ≠ valid`).
- Depois disso, **F2.13.3-C** = cleanup do código de log-mode + fechamento documental.

**Restrições ativas (NÃO violar ao retomar):**
- Não ativar enforcement (rejeição por HMAC) sem GO explícito após análise da janela de 72h.
- Não alterar fluxo de roteamento (Agenda / AI Support / sales mode).
- Não voltar a gravar `raw_payload` populado em novos registros.
- Não logar assinatura completa nem `META_APP_SECRET` — apenas `sig_prefix`.
- Não mexer em GET verification (já estável).
- Não desligar IA de outros tenants para teste; janela controlada foi específica do Respeite o Homem.

**Docs fonte de verdade:**
- `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` (§9 HMAC log-mode)
- `docs/especificacoes/transversais/politica-pii-logs.md` (§11 redação de secrets)

**Código:**
- `supabase/functions/meta-whatsapp-webhook/index.ts` (raw_payload=null + HMAC log-mode integrado)

---

## 🟢 AUTO — Ajustes Gerais — Onda 3 Billing SaaS vs Pagamentos das Lojas (2026-05-12)

**Onde paramos exatamente:**
- Onda 3.0 (PLANNER) concluída: separação formal entre Domínio A (Billing SaaS da plataforma — gateway exclusivo Mercado Pago, recebedor = tenant admin) e Domínio B (pagamentos das lojas dos tenants — multi-gateway: MP, Pagar.me e outros). Caso especial Respeite o Homem mantido intocado.
- Onda 3.0.1 (preflight read-only) + 3.0.2 (saneamento documental) ✅ aplicadas. Sem alterar código funcional, edge functions, UI, schema ou cobranças.
- Doc novo criado: `docs/especificacoes/sistema/billing-saas-vs-loja.md` (normativo, Layer 3).
- Doc atualizado: `docs/especificacoes/sistema/planos-billing.md` com bloco normativo de separação + referência cruzada.

**Estado atual confirmado no banco/código (preflight read-only):**
- `platform_credentials.mercadopago_client_id` e `mercadopago_client_secret`: ❌ ausentes.
- `payment_providers` do tenant admin (`cc000000-…0001`): ❌ ausente — recebedor SaaS não conectado.
- `payment_providers` em geral: 2 registros, ambos `provider='pagarme'` (Amazgan + Respeite o Homem, Domínio B).
- Divergência canônica do provider MP (BLOQUEIO): helper procura `'mercadopago'`, callback OAuth grava `'mercado_pago'`. Sem padronização, billing fica silenciosamente quebrado mesmo após OAuth bem-sucedido.

**Decisões aprovadas pelo operador (registradas em `billing-saas-vs-loja.md` §5):**
- Billing SaaS exclusivo Mercado Pago.
- Sandbox primeiro; produção só após validação.
- Pix de validação: R$ 100, expiração 1h, reembolso até 24h.
- Cartão da assinatura: 1x, sem parcelamento nesta fase.
- Trocar cartão: substituição direta (sem histórico).
- Cartão recusado: erro amigável + fallback Pix.
- Inadimplência: mantém regra atual (SaaS Billing Protocol v2.3).
- Tenants legados com `payment_provider='pagarme'`: histórico inerte; recadastro via fluxo MP novo.
- Qualquer texto/UI novo de pagamento exige aprovação prévia do operador.

**Próximo passo combinado (retomar daqui):**
- Sub-onda 3.0.1.a: operador cadastra `MP_CLIENT_ID` + `MP_CLIENT_SECRET` da plataforma em `/platform-integrations` (UI já existe). Decidir antes: sandbox ou produção primeiro.
- Sub-onda 3.0.1.b: padronizar a chave canônica do provider MP (proposta: adotar `'mercado_pago'` snake_case em helper, doc e chamadas em `billing-*`). Sem mudar comportamento de Domínio B.
- Só então emitir runbook de OAuth para conectar a conta MP recebedora da plataforma no tenant admin.
- Depois: Onda 3.0.3 (Pix do plano via MP), 3.0.4 (cartão via MP), 3.0.5 (trocar cartão), 3.0.6 (webhook/reconciliação).

**Restrições ativas (NÃO violar ao retomar):**
- Não usar Pagar.me em fluxos novos de Billing SaaS.
- Não tocar em registros `payment_providers` de tenants (Domínio B), em especial Respeite o Homem.
- Não criar cobrança real até sandbox validado.
- Não alterar UI/copy de pagamento sem aprovação prévia.
- Não conectar OAuth MP da plataforma enquanto a divergência canônica não for padronizada.
- Não migrar tenants legados Pagar.me automaticamente.

**Docs fonte de verdade:**
- `docs/especificacoes/sistema/billing-saas-vs-loja.md` (novo, normativo)
- `docs/especificacoes/sistema/planos-billing.md` (atualizado)
- `docs/especificacoes/sistema/hub-integracoes.md` (modelo MP integrador + recebedor)

**Memórias técnicas relacionadas:** `infrastructure/payments/gateway-separation-and-multi-provider-canonical`, `constraints/mercadopago-2-contextos-credentials`, `infrastructure/payments/multi-gateway-assignment-standard`, `features/saas/protocolo-billing-e-inadimplencia-v2-3`.
