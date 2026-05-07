---
name: IA de Atendimento — frente em andamento
description: Frente ativa de implementação/evolução do sistema de IA de Atendimento e Vendas (pipeline base, Arch18, gates). Independente do Motor de Créditos (que apenas contabiliza o consumo).
type: preference
---

## Contexto ativo

Implementação contínua do **sistema de IA de Atendimento e Vendas** (`ai-support-chat` + `_shared/sales-pipeline/`).
Esta frente é **independente** do Motor de Créditos — o motor apenas mede o gasto do atendimento, não faz parte da pipeline funcional.

## Onde estamos

- **Arch18 Fase A — Catalog Base Forced** ativa apenas no piloto Respeite o Homem (flag `arch18_catalog_base_forced` em `ai_support_config.metadata`).
- Pipeline base já tem: TPR (Gemini Flash-Lite), State Machine (greeting→recommendation→product_detail→comparison→decision), Working Memory (shadow), Focus Snapshot, Catalog Probe, Output Gates (Price Scrubber, Greeting Mirror, Checkout URL Enforcer, Action Invention Scrubber), Anti-repetição semântica, Handoff terminal idempotente, Variant Gate, Ambiguous Input Detector, Turn Orchestrator consolidado.
- Modo Vendas (`sales_mode_enabled`) ativa 11 tools de comércio conversacional no WhatsApp.

## Doc formal (fonte de verdade)

- `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` — changelog Reg # de toda a pipeline.
- `docs/especificacoes/crm/crm-atendimento.md` — §4.2 handoff, §4.6 scrubber, §4.8 ambiguous.
- `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md` — modo vendas.
- `docs/especificacoes/ia/motor-contexto-comercial.md` — contexto comercial.
- `docs/especificacoes/ia/visao-ia-produto.md` — visão de produto.

## Memórias técnicas relacionadas (já indexadas)

- `mem://features/ai/sales-mode-conversational-commerce`
- `mem://features/ai/sales-pipeline-v2-9-working-memory-shadow-mode`
- `mem://features/ai/sales-pipeline-v2-10-focus-snapshot-and-exact-match`
- `mem://features/ai/arch18-fase-a-catalog-base-forced`
- `mem://features/ai/arch18-fase-b-policy-compiler`
- `mem://features/ai/arch18-fase-b2-model-roles`
- `mem://features/ai/sales-pipeline-anti-repetition-and-family-focus`
- `mem://constraints/sales-pipeline-tpr-and-output-gates`
- + 11 constraints de gates/scrubbers/handoff em `mem://constraints/`.

## Próximo passo (a combinar com o operador)

Sem plano ativo aberto. Última onda entregue foi Arch18 Fase A no piloto. Candidatos naturais: promover Fase A para outros tenants OU avançar para Arch18 Fase B (Policy Compiler) / B2 (Model Roles). Nada deve ser executado sem GO explícito.

## Restrições firmes

- Nada novo nesta frente sem autorização do operador.
- Toda mudança em pipeline/gates exige Reg # no `ia-atendimento-changelog.md`.
- Mudanças com risco de regressão cross-módulo viram constraint em `mem://constraints/` antes de fechar.
- Piloto continua sendo só Respeite o Homem para flags Arch18.
