---
name: Cold Customer Exclusion — Advisory, Not Blocking
description: Em campanhas frias, IA sempre propõe exclusão de clientes como padrão; usuário pode remover sem bloqueio; remarketing fica livre
type: constraint
---

# Exclusão de Clientes em Públicos Frios — Padrão da IA, Override do Usuário

**Vigência:** 2026-06-17 em diante.

## Regra

- **Público frio / topo de funil / prospecção:** a IA deve **sempre** propor `audience_exclusions.customers=true` como padrão de estruturação.
- **Auto-injeção:** quando o público de Clientes existe na conta Meta E a proposta ainda contém `audience_exclusions.customers=true`, o publicador injeta o ID na lista de exclusões antes de chamar a Meta.
- **Override do usuário:** se o usuário remover `audience_exclusions.customers` durante a revisão (proposta vai sem essa flag), o sistema **respeita e publica**. Apenas registra log do override.
- **Público de Clientes não sincronizado:** **não bloqueia mais**. Vira recomendação informativa (`customer_audience_status="missing_in_account_advisory"`).
- **Remarketing / outros funis:** a IA decide livremente excluir ou não conforme estratégia. Nunca obrigatório.

## O que é PROIBIDO

1. Marcar `audience_exclusions.customers` como campo `h2_structural` no `objectiveFieldContract.ts` — bloqueia remarketing indevidamente.
2. Push de `cold_audience_requires_customer_exclusion` em `reason_codes` do Quality Gate — vira erro bloqueante.
3. Return `success:false` com `reason_code: cold_audience_requires_customer_exclusion` ou `cold_adset_requires_customer_audience` em `ads-autopilot-execute-approved`.
4. Marcar `status='failed'` em `ads_autopilot_actions` por ausência de exclusão em frio.

## O que DEVE existir

1. Strategist sempre emite a flag em conjuntos frios (regra existente, preservada).
2. Executor (`ads-autopilot-execute-approved`) auto-injeta o ID quando proposta contém `customers=true` e público existe.
3. Logs explícitos:
   - `Cold campaign user-override: customer exclusion REMOVED` — quando usuário removeu.
   - `Cold campaign advisory: customer audience not synced` — quando público não existe.
4. Quality Gate registra `customer_audience_status` em `details` para observabilidade (nunca em `reason_codes`).

## Anti-regressão

Bug original (15-17/06/2026): contrato de objetivo `sales` exigia `audience_exclusions.customers` como `h2_structural`, o que travava aprovação de **toda** campanha de Vendas — incluindo remarketing — quando a exclusão não estava aplicada. Adicionalmente, dois bloqueios em `ads-autopilot-execute-approved` (campanha + adset) abortavam publicação quando o público de Clientes não existia.

Antes de qualquer mudança nesta área, validar:

- [ ] `objectiveFieldContract.ts` → `sales.adset_required` **NÃO** contém `f("audience_exclusions.customers", "h2_structural")`.
- [ ] `qualityGate.ts` → bloco `if (isCold(args))` **NÃO** faz `reason_codes.push("cold_audience_requires_customer_exclusion")`.
- [ ] `ads-autopilot-execute-approved/index.ts` → não retorna `success:false` com `cold_audience_requires_customer_exclusion` nem `cold_adset_requires_customer_audience`.
- [ ] Teste E2E: campanha de Remarketing com 1 conjunto deve aprovar e publicar sem exigir exclusão.
- [ ] Teste E2E: campanha Fria com usuário removendo exclusão na revisão deve publicar normalmente.
