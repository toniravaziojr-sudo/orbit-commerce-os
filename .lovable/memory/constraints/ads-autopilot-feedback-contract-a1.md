---
name: ads-autopilot-feedback-contract-a1-a2
description: Contrato de feedback humano do Ads Autopilot (Etapa 7.mem A.1 + UI A.2) — motivo obrigatório, isolamento por tenant, sem influência sobre a IA
type: constraint
---

# Captura de Feedback Humano do Ads Autopilot — A.1

Backend (contrato + armazenamento) entregue em 2026-06-07 como Subfase A.1 da Etapa 7.mem (memória dupla). Nenhuma UI alterada nesta entrega.

## Regras invioláveis

1. **Motivo obrigatório no ponto de gravação.** Toda escrita no histórico de feedback exige pelo menos um código de motivo da lista controlada. Sem motivo, a base bloqueia (trigger) e o ponto de gravação também bloqueia.
2. **Catálogo é fonte única de verdade dos motivos.** Códigos vivem em tabela dedicada, com flag de ativo. É proibido criar enum rígido em outro lugar, e é proibido aceitar código fora do catálogo.
3. **Isolamento estrito por tenant.** Leitura e escrita restritas ao próprio tenant via políticas de acesso. Service role só opera com filtro explícito de tenant.
4. **Feedback é imutável.** Sem UPDATE/DELETE pelo usuário. Diff só é aceito quando a decisão é “editou e aprovou”.
5. **Feedback não muda a sugestão original.** Não altera status, não dispara execução, não chama Meta, não toca em kill_switch, human_approval_mode, autonomy_mode nem is_ai_enabled. Não influencia veredito da IA nesta fase.
6. **Snapshot imutável.** O contexto da sugestão (campanha, objetivo, métricas, política, observação) é copiado no momento da decisão e nunca alterado.
7. **A.1 não torna o motivo obrigatório no fluxo real ainda.** A obrigatoriedade no clique do usuário entra apenas em A.2, junto com a UI de captura aprovada visualmente.

## Decisões aceitas (contrato)

- `approved`
- `rejected`
- `needs_revision`
- `edited_then_approved`

Os quatro estados são aceitos desde já mesmo que a UI ainda exponha só dois. Permite evolução sem migração.

## Por quê

A IA de tráfego só vira regenerativa quando cada decisão humana virar input estruturado para a Memória do Tenant. Sem captura estruturada desde já, aprendizado é perdido a cada ciclo. A.1 garante que o histórico nasça correto, isolado e auditável, antes de qualquer influência sobre a IA.

## Como aplicar em PRs futuros

- Qualquer novo ponto que grave feedback deve passar pelo único ponto de gravação (não escrever direto na tabela a partir do cliente sem validação).
- Qualquer novo tipo de motivo deve ser adicionado ao catálogo, com texto em PT-BR e categoria correta. Nunca via enum.
- Subfases B+ podem **ler** o histórico, mas não podem alterar o contrato sem nova entrega documentada.
