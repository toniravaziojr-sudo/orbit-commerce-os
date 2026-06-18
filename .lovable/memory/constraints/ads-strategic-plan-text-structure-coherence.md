---
name: Plano Estratégico — Texto da IA nunca pode contradizer a estrutura
description: Em qualquer ação/conjunto do plano estratégico, o texto livre da IA (reason, audience_description) deve ser reescrito para casar com a estrutura final de exclusão de clientes após a normalização.
type: constraint
---

# Regra (Onda H.6)

No plano estratégico do Gestor de Tráfego IA, **a estrutura final de exclusão de clientes vence sempre**. O texto livre que o LLM gerou (`audience_exclusions.reason`, `adset.audience_description`) deve ser **reescrito** pelo normalizador para refletir exatamente a decisão estrutural — nunca pode aparecer um texto dizendo "clientes não serão excluídos" quando a estrutura está excluindo (ou vice-versa).

## Default de exclusão (recap)

1. Tráfego frio / prospecção → exclui clientes.
2. Teste criativo de **carro-chefe** → exclui clientes por padrão de segurança.
3. Teste de **produto novo/lançamento** → mantém clientes (skip determinístico).
4. Teste criativo com `exclusion_override_reason` ≥ 12 caracteres → respeita override do LLM.
5. **Aprendizado ATIVO do tenant** com regra "teste criativo não exclui clientes" → sobrepõe o item 2 e mantém clientes (skip = `creative_test_tenant_learning`).

## Pipeline obrigatório

- `tenant_signals.creative_test_skip_customer_exclusion` deve ser carregado dos aprendizados ativos em **toda** chamada de `normalizeAndValidateStrategicPlanForApproval` (estrategista E approval endpoint).
- O normalizador (`normalizeStrategicPlanAction` + `enforceProspectingAdsetCustomerExclusions`) recebe os sinais e:
  - aplica a decisão estrutural,
  - chama `rewriteTextsToMatchExclusion` para limpar frases contraditórias e injetar sufixo determinístico ("Exclui clientes existentes." / "Clientes mantidos no público — aprendizado ativo da IA para testes criativos.").
- O validador aceita `exclusion_skipped_reason ∈ STRUCTURE_AWARE_SKIP_REASONS` (`test_for_new_or_launch_product` ou `creative_test_tenant_learning`) sem exigir override manual.

## Proibido

- Salvar plano em `ads_autopilot_actions` sem ter passado pelo normalizador com `tenant_signals` carregado.
- Reescrever a regra de "teste criativo não exclui clientes" como default universal — só vale com aprendizado ATIVO do tenant.
- Deixar `audience_description` ou `reason` do LLM intactos quando o normalizador mexer em `audience_exclusions.customers`.

## Por que

2026-06-18: plano gerado para o tenant Respeite o Homem mostrava conjuntos com badge "Exclui: Clientes" e simultaneamente o texto "Clientes não serão excluídos, conforme regra de IA para testes criativos". Causa: o LLM honrava o aprendizado da IA no texto, mas o normalizador (corretamente, por default de segurança) mantinha a exclusão estrutural; nenhum passo reescrevia o texto. Lojista via duas decisões opostas no mesmo card.

Correção entrega: (a) sinal do tenant derivado dos aprendizados ativos passa a sobrepor o default quando aplicável; (b) qualquer normalização passa a reescrever também os textos.
