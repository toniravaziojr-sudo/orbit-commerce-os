---
name: ads-autopilot-tenant-memory-writer-c
description: Writer determinístico que transforma feedback humano (A.1/A.2) em preferências aprendidas do tenant (B), sem influenciar a IA na Subfase C
type: constraint
---

# Tenant Memory Writer do Ads Autopilot — Subfase C

Entregue em 2026-06-07 como Subfase C da Etapa 7.mem (memória dupla). Não influencia a IA nesta fase.

## Regras invioláveis

1. **Writer é determinístico.** Sem LLM, sem inferência de texto livre. Toda decisão (promoção, rebaixamento, peso, confiança) vem de função pura testável.
2. **Idempotência por ledger.** Cada feedback só pode ser aplicado uma vez a cada padrão (`tenant + feedback + sales_platform + ads_platform + memory_type + scope + key`). Reexecutar o Writer nunca duplica `evidence_count`.
3. **Não altera o feedback original.** Feedback continua imutável (A.1).
4. **Não influencia a IA na Subfase C.** Não altera veredito, sugestão, prompt, Policy Engine, Governance Layer, Campaign Verdict Layer, Action Derivation, executor, status de sugestão, `kill_switch`, `human_approval_mode`, `autonomy_mode` nem `is_ai_enabled`. Não chama Meta. Não ativa autoexecução.
5. **Isolamento estrito por tenant.** Writer é invocado server-to-server com `tenant_id` obrigatório. Ledger e memória só são visíveis pelos membros do próprio tenant. Outros tenants não acessam.
6. **Sem cron novo nesta subfase.** Execução é manual/controlada.
7. **`should_become_preference=true` tem peso maior (2.0)** e adiciona bônus de confiança (até +0,15). Sozinho não basta para virar `active`.
8. **Promoção a `active`** exige `total >= 5`, `consistência >= 80%`, `recent_contradictions < 3`. 3 contradições recentes (30 dias) rebaixam `active` → `provisional`. `archived` é preservado.
9. **Mapa de reason_code → memory_type é fonte única.** Códigos fora do mapa não geram memória por motivo nesta subfase (mas o feedback ainda gera `approved/rejected_action_pattern` quando há `action_type`).
10. **Memória nunca é apagada fisicamente pelo Writer.** Só rebaixada ou arquivada explicitamente.

## Por quê

A IA de tráfego só vira regenerativa quando feedbacks humanos viram padrões reconhecíveis da loja. O Writer é o único caminho oficial para isso. Determinismo é exigido para que a Subfase D (leitura observacional) e a Subfase F (influência real) sejam auditáveis e reversíveis.

## Como aplicar em PRs futuros

- Novos `reason_codes` devem ser adicionados ao mapa do Writer **e** ao catálogo A.1, com tipo de memória correspondente.
- Mudar thresholds (`5`, `80%`, `3 contradições`, `2 evidências`) exige nova entrega documentada e atualização dos testes anti-regressão.
- Subfases D+ podem **ler** o ledger e a memória, mas não podem alterar o contrato do Writer sem nova entrega.
- Qualquer rotina nova que grave memória do tenant **deve passar pelo Writer** — nunca escrever direto em `ads_autopilot_tenant_memory` a partir de outros caminhos.
