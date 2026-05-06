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

## 📌 PINNED — Motor Universal de Créditos — PAUSADO em A3.0.1 (testes funcionais das RPCs transacionais bloqueados por deploy de edge function)

**Linha do tempo completa do que foi feito:**

- **Fase 0/1/2A/2B** ✅ executadas e validadas (fundação: wallet, ledger, pricing, estimate_credits, charge_credits_v2, service_usage_events).
- **Fase 3 (shadow inicial youtube-upload)** ✅ plugado em shadow v2, mas bloqueado por ausência de tenant com YouTube conectado em produção. Foi superado por nova frente prioritária: IA Imagem Fal.AI medium_1024.

- **Fase A1 — Pre-router Shadow Sidecar** ✅ FECHADA. 10/10 jobs reais com 100% match de provider e service_key. Live desligado, wallet/ledger intocados.
- **Fase A2 — Reserva Sombra (Fal.AI medium_1024)** ✅ FECHADA. 9/9 eventos com aritmética correta (cost 0.034 + markup 50% = 6 créditos). Cobertura por testes unitários puros em `supabase/functions/_shared/credits/shadow-reservation_test.ts`.
- **Fase A2.1 — Fallback Shadow IA Imagem** ✅ implementada com gate ativo somente no tenant Respeite o Homem. Testes unitários em `supabase/functions/_shared/credits/fallback-shadow_test.ts`. Bloqueio: motor v10 dominou Fal.AI medium_1024 em todas as tentativas reais — nenhum winner Gemini/OpenAI/Lovable foi obtido por UI. Validação foi feita via teste Deno integrado sintético em `fallback-shadow_integration_test.ts` (sem chamar provider, sem gerar imagem, sem mexer em wallet/ledger). A2.1 considerada validada por evento sintético controlado.

- **Fase A3 PLANNER (1ª rodada)** — premissa errada: assumiu que `reserve_credits_v2`, `capture_reservation`, `release_reservation` não existiam (information_schema.routines retornou vazio). Recomendou criar RPCs do zero.
- **Fase A3.0 EXECUÇÃO (corretiva)** — re-auditoria via `pg_proc` confirmou que as 3 RPCs JÁ EXISTEM em produção (`SECURITY DEFINER`, `search_path=public`, gate service_role/backend, `p_units jsonb`). Funções correlatas também existem: `charge_credits_v2`, `consume_credits`, `refund_credits`, `reserve_credits` (v1), `add_credits`, `check_credit_balance_v2`, `estimate_credits_internal`, `estimate_credits_public`. Schemas `credit_wallet` e `credit_ledger` confirmados com todos os campos esperados. Plano original A3.0 (criar RPCs) descartado. Nada foi escrito.
- **Fase A3.0 RE-PLANNER** — replanejada como auditoria funcional read-only das RPCs existentes. Achados:
  - `reserve_credits_v2` usa `estimate_credits_internal` para checar saldo e bloquear pricing placeholder não-aprovado.
  - `capture_reservation` debita `balance_credits` e zera `reserved_credits`.
  - `release_reservation` zera reserva sem afetar balance.
  - Contrato de p_units para `fal.gpt-image-1.5.per_image.medium_1024` = `{"images": 1}` → 6 créditos.
  - Helper `_shared/credits/charge.ts` já existe, mas `creative-image-generate` ainda NÃO chama.
  - `service_usage_events` é responsabilidade das RPCs (criação + update com `cost_owner='tenant'`).
- **Fase A3.0.1 EXECUÇÃO (testes funcionais isolados)** — criada edge function `supabase/functions/a3-rpc-test/index.ts` com 10 cenários (dry-run, reserve, idempotência, capture, release, saldo insuficiente, conflito capture-after-release, gate PRICE_NOT_APPROVED, etc). Baseline do Respeite o Homem capturado: balance=500, reserved=0, motor_v2_enabled=false. **BLOQUEIO ATUAL: edge function retorna 404 persistente após criação — deploy não propagou.** Nenhum teste rodou. Nenhum dado sintético criado.

**Onde paramos exatamente:**
- A3.0.1 NÃO executada por falha de deploy da edge function `a3-rpc-test`.
- Recomendação aberta: ou re-tentar deploy de `a3-rpc-test`, ou pivotar para script Deno standalone executado via `supabase--test_edge_functions`.
- **NO-GO para Fase A3.1** (plug live de `creative-image-generate` no motor para Fal.AI medium_1024) até A3.0.1 passar nos 10 cenários.

**Estado da plataforma neste momento:**
- `motor_v2_enabled` = `false` (live desligado universalmente).
- Wallet do Respeite o Homem: balance=500, reserved=0 — INTOCADA.
- `service_pricing` inalterado.
- `creative-image-generate` NÃO plugado no motor (continua usando o fluxo legado).
- Nenhuma imagem foi gerada por iniciativa do motor. Nenhum provider foi chamado.

**Restrições ativas (NÃO violar ao retomar):**
- Não ativar live (`motor_v2_enabled` segue `false`).
- Não plugar `creative-image-generate` em live.
- Não criar/sobrescrever as 3 RPCs existentes.
- Não mexer em wallet/ledger reais.
- Não alterar `service_pricing`.
- Não gerar imagem real.
- Não chamar provider real.
- Não criar trigger `on_tenant_created` nem fazer backfill de wallet dos tenants legados.
- Quando rodar A3.0.1, isolar/limpar dados sintéticos ao final.

**Próximo passo ao retomar:**
- Decidir entre: (A) re-tentar deploy de `supabase/functions/a3-rpc-test/index.ts` e investigar 404; (B) migrar os 10 cenários para teste Deno standalone (`*_integration_test.ts`) e executar via `supabase--test_edge_functions` com tenant sintético; (C) executar os cenários diretamente via `supabase--read_query` + `supabase--migration` em transações isoladas.
- Após A3.0.1 verde nos 10 cenários → PLANNER da Fase A3.1 (plug live controlado de `creative-image-generate` para Fal.AI medium_1024 apenas no Respeite o Homem).

**Docs fonte de verdade:**
- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/catalogo-precos-creditos.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/motor-creditos-fase-a2-1-fallback-shadow.md`
- `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`
- `docs/especificacoes/sistema/ux-creditos-lojista.md`

**Arquivos técnicos relevantes:**
- `supabase/functions/_shared/credits/shadow-reservation.ts` + `_test.ts` (A2)
- `supabase/functions/_shared/credits/fallback-shadow.ts` + `_test.ts` + `_integration_test.ts` (A2.1)
- `supabase/functions/_shared/credits/charge.ts` (helper para reserve/capture/release — já existe, ainda não usado pelo creative-image-generate)
- `supabase/functions/a3-rpc-test/index.ts` (criada para A3.0.1, deploy bloqueado em 404)

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
