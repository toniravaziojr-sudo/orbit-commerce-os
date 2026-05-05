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

## 📌 PINNED — Profile Enrichment Policy — validação real PENDENTE (2026-05-05)

**Status macro:**
- Implementação ✅ aplicada (função `enrich_customer_from_order` + extensão do trigger `after_order_approved_sync`).
- Backfill manual do pedido #409 (Respeite o Homem) ✅ validado: cadastro do cliente populado com CPF, nascimento e endereço completo.
- **Validação real em produção PENDENTE:** aguardando entrada de um novo pedido aprovado para confirmar que o trigger dispara automaticamente fim-a-fim (sem intervenção manual).

**Combinado com o usuário:**
- Quando entrar um pedido novo aprovado, o usuário avisa.
- Lovable então valida: (a) trigger disparou, (b) `enrich_customer_from_order` rodou sem warning, (c) cadastro do cliente foi atualizado com os dados do pedido novo (pessoais campo-a-campo + endereço como bloco atômico se CEP veio), (d) e-mail intocado.

**Tenant de validação:** Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`).

**Fonte de verdade documental:**
- `docs/especificacoes/ecommerce/clientes.md` §3.1 e §4.6.1
- `docs/especificacoes/storefront/checkout.md`
- `docs/especificacoes/sistema/automacao-patterns.md` (histórico 2026-05-05)
- `mem://features/customers/profile-enrichment-policy-standard`

---

## Auto #1) Motor Universal de Créditos — Fase 3 shadow mode youtube-upload (PAUSADO, aguardando conexão YouTube real)

**Status macro:**
- Fase 0/1/2A/2B ✅ executadas e validadas.
- Fase 3 (primeiro plug em shadow): youtube-upload **plugado em shadow mode v2**, v1 segue como única cobrança real.

**Bloqueio atual:**
- Query de tenants com YouTube conectado retornou **0** em produção. Nenhum upload pode ser executado ainda.
- **NO-GO** para iniciar janela de 7 dias até existir 1 upload piloto + 1 upload não-piloto validados.

**Restrições ativas (NÃO violar ao retomar):**
- Não ativar live (`motor_v2_enabled` segue `false`). Não fazer cutover. Não plugar outras funções pagas em shadow ainda. Não criar trigger `on_tenant_created` nem fazer backfill de wallet dos 4 tenants legados restantes nesta fase.

**Docs fonte de verdade:**
- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/catalogo-precos-creditos.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`
- `docs/especificacoes/sistema/ux-creditos-lojista.md`

---

## Auto #2) IA de Atendimento — AI Provider Routing (PAUSADO, aguardando OpenAI quota)

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
